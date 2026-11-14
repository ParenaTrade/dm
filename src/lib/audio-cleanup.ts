"use client";

/**
 * Mikrofon sesini otomatik temizler:
 *  1) Tarayıcının yerleşik gürültü bastırma / yankı engelleme / otomatik ses seviyesi
 *  2) Yüksek geçiren filtre (uğultu, klima, masa titreşimi)
 *  3) Gürültü kapısı (konuşma yokken fan / klavye / arka plan sesini kısar)
 *  4) Kompresör (ani yükselmeleri dengeler, ses hep aynı seviyede kalır)
 *
 * Herhangi bir adım başarısız olursa ham mikrofon akışı aynen döner (ses asla kesilmez).
 */

export const MIC_CONSTRAINTS: MediaTrackConstraints = {
  channelCount: 1,
  sampleRate: { ideal: 48000 },
  echoCancellation: { ideal: true },
  noiseSuppression: { ideal: true },
  autoGainControl: { ideal: true },
  // Chrome'a özel ek filtreler (desteklemeyen tarayıcılar yok sayar)
  ...({
    googEchoCancellation: true,
    googNoiseSuppression: true,
    googAutoGainControl: true,
    googHighpassFilter: true,
    googTypingNoiseDetection: true,
  } as Record<string, boolean>),
};

export type CleanedAudio = {
  stream: MediaStream;
  dispose: () => void;
};

const OPEN_THRESHOLD = 0.012; // ~ -38 dBFS: üstü konuşma sayılır
const CLOSE_THRESHOLD = 0.007; // ~ -43 dBFS: altı gürültü sayılır
const HOLD_MS = 350; // konuşma bitince kapıyı kapatmadan önce bekleme
const FLOOR_GAIN = 0.08; // kapı kapalıyken tamamen susturmaz, sadece kısar

export async function cleanMicStream(raw: MediaStream): Promise<CleanedAudio> {
  const passthrough: CleanedAudio = { stream: raw, dispose: () => undefined };
  const rawAudio = raw.getAudioTracks()[0];
  if (!rawAudio) return passthrough;

  try {
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return passthrough;

    const ctx = new Ctor({ latencyHint: "interactive" });
    if (ctx.state === "suspended") await ctx.resume().catch(() => undefined);
    // Tarayıcı izin vermediyse işlenmiş ses sessiz kalır: ham akışı kullan.
    if (ctx.state !== "running") {
      void ctx.close().catch(() => undefined);
      return passthrough;
    }

    const source = ctx.createMediaStreamSource(new MediaStream([rawAudio]));

    const highpass = ctx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 90;
    highpass.Q.value = 0.7;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 12000;

    const gate = ctx.createGain();
    gate.gain.value = FLOOR_GAIN;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -26;
    compressor.knee.value = 24;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.005;
    compressor.release.value = 0.25;

    const makeup = ctx.createGain();
    makeup.gain.value = 1.25;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;

    const dest = ctx.createMediaStreamDestination();

    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(analyser); // seviye ölçümü (kapı öncesi)
    lowpass.connect(gate);
    gate.connect(compressor);
    compressor.connect(makeup);
    makeup.connect(dest);

    const buf = new Float32Array(analyser.fftSize);
    let open = false;
    let lastVoice = 0;
    const timer = window.setInterval(() => {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      const now = performance.now();

      if (rms > (open ? CLOSE_THRESHOLD : OPEN_THRESHOLD)) {
        lastVoice = now;
        open = true;
      } else if (open && now - lastVoice > HOLD_MS) {
        open = false;
      }

      const target = open ? 1 : FLOOR_GAIN;
      gate.gain.setTargetAtTime(target, ctx.currentTime, open ? 0.015 : 0.12);
    }, 30);

    const processedTrack = dest.stream.getAudioTracks()[0];
    if (!processedTrack) throw new Error("no processed track");

    // Mikrofon aç/kapa düğmesi işlenmiş izi kontrol eder; ham izi de eşle.
    const out = new MediaStream([...raw.getVideoTracks(), processedTrack]);

    const dispose = () => {
      window.clearInterval(timer);
      try {
        source.disconnect();
      } catch {
        /* noop */
      }
      processedTrack.stop();
      rawAudio.stop();
      void ctx.close().catch(() => undefined);
    };

    // Cihaz çıkarılırsa/ham iz biterse işlenmiş izi de bitir.
    rawAudio.addEventListener("ended", () => processedTrack.stop());

    return { stream: out, dispose };
  } catch {
    return passthrough;
  }
}
