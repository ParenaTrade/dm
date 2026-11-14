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
  // AGC KAPALI: konuşma bitince kazancı yükseltip uğultu/çınlamayı büyütüyordu
  autoGainControl: { ideal: false },
  // Chrome'a özel ek filtreler (desteklemeyen tarayıcılar yok sayar)
  ...({
    googEchoCancellation: true,
    googNoiseSuppression: true,
    googAutoGainControl: false,
    googAutoGainControl2: false,
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
const FLOOR_GAIN = 0.03; // kapı kapalıyken tamamen susturmaz, sadece kısar

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
    compressor.ratio.value = 2.5;
    compressor.attack.value = 0.005;
    compressor.release.value = 0.25;

    const makeup = ctx.createGain();
    makeup.gain.value = 1.0;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;

    // Çınlama (geri besleme) avcısı: sürekli tek frekansta yükselen sesi tespit edip keser.
    const spectrum = ctx.createAnalyser();
    spectrum.fftSize = 2048;
    spectrum.smoothingTimeConstant = 0.6;
    const MAX_NOTCHES = 4;
    const notches: { freq: number; filter: BiquadFilterNode; lastSeen: number }[] = [];
    const freqBuf = new Float32Array(spectrum.frequencyBinCount);
    const binHz = ctx.sampleRate / spectrum.fftSize;
    let candBin = -1;
    let candCount = 0;

    const dest = ctx.createMediaStreamDestination();

    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(analyser); // seviye ölçümü (kapı öncesi)
    lowpass.connect(spectrum); // çınlama tespiti (notch öncesi)

    // notch zinciri: lowpass -> [notch...] -> gate
    const rewire = () => {
      lowpass.disconnect();
      for (const n of notches) n.filter.disconnect();
      lowpass.connect(analyser);
      lowpass.connect(spectrum);
      let prev: AudioNode = lowpass;
      for (const n of notches) {
        prev.connect(n.filter);
        prev = n.filter;
      }
      prev.connect(gate);
    };
    rewire();

    gate.connect(compressor);
    compressor.connect(makeup);
    makeup.connect(dest);

    const buf = new Float32Array(analyser.fftSize);
    let open = false;
    let lastVoice = 0;
    let lastSpec = 0;
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

      // --- çınlama tespiti (yaklaşık 100 ms'de bir) ---
      if (now - lastSpec > 100) {
        lastSpec = now;
        spectrum.getFloatFrequencyData(freqBuf);
        const lo = Math.floor(300 / binHz);
        const hi = Math.min(freqBuf.length - 3, Math.floor(8000 / binHz));
        let peak = -Infinity;
        let peakBin = -1;
        let sumDb = 0;
        for (let i = lo; i <= hi; i++) {
          sumDb += freqBuf[i];
          if (freqBuf[i] > peak) {
            peak = freqBuf[i];
            peakBin = i;
          }
        }
        const avg = sumDb / (hi - lo + 1);
        const dominant = peak > -65 && peak - avg > 28;

        if (dominant && Math.abs(peakBin - candBin) <= 1) {
          candCount++;
          candBin = peakBin;
        } else if (dominant) {
          candBin = peakBin;
          candCount = 1;
        } else {
          candCount = 0;
          candBin = -1;
        }

        const hz = candBin * binHz;
        // ~1 sn boyunca aynı frekansta sabit tiz/uğultu => çınlama
        if (candCount >= 10) {
          const existing = notches.find((n) => Math.abs(n.freq - hz) < binHz * 2);
          if (existing) {
            existing.lastSeen = now;
          } else {
            const filter = ctx.createBiquadFilter();
            filter.type = "notch";
            filter.frequency.value = hz;
            filter.Q.value = 25;
            if (notches.length >= MAX_NOTCHES) notches.shift()?.filter.disconnect();
            notches.push({ freq: hz, filter, lastSeen: now });
            rewire();
          }
          candCount = 0;
        }

        // 8 sn çınlama görülmeyen notch'ı kaldır
        const before = notches.length;
        for (let i = notches.length - 1; i >= 0; i--) {
          if (now - notches[i].lastSeen > 8000 && notches[i].lastSeen !== 0) {
            // yalnızca kaynak gerçekten kesildiyse (kaynak notch öncesinde ölçülür)
            const b = Math.round(notches[i].freq / binHz);
            if (freqBuf[b] < avg + 12) notches.splice(i, 1)[0].filter.disconnect();
            else notches[i].lastSeen = now;
          }
        }
        if (notches.length !== before) rewire();
      }
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
