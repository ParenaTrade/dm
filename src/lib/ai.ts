/**
 * DampingVar AI Pazarlama Motoru
 *
 * Harici bir AI servisine KİLİTLENMEMİŞ, işletme verisinden deterministik
 * içerik üreten sunucu tarafı modül. Yapı, ileride bir LLM sağlayıcısına
 * bağlanacak şekilde tasarlandı (bkz. `ai_settings` tablosu: provider/model/api),
 * ancak V1'de üretim yerel şablon motoruyla yapılır → dış bağımlılık yok, maliyet yok.
 */

export type SectorKey = "restoran" | "market" | "magaza" | "hizmet" | "yapi";

export type SnapshotProduct = { name: string; priceCents: number; discountPriceCents?: number | null };
export type SnapshotService = { name: string; priceCents: number };
export type SnapshotCampaign = {
  title: string;
  type: string;
  discountPercent: number;
  discountAmountCents: number;
};

export type BusinessSnapshot = {
  name: string;
  sectorKey: SectorKey;
  category: string;
  district: string;
  city: string;
  description: string | null;
  rating: number;
  reviewCount: number;
  products: SnapshotProduct[];
  services: SnapshotService[];
  campaigns: SnapshotCampaign[];
  stats: {
    pageViews: number;
    campaignViews: number;
    qrGenerated: number;
    qrRedeemed: number;
    transactionCount: number;
    revenueCents: number;
    avgBasketCents: number;
    newCustomers: number;
    repeatRate: number;
    hourHistogram: number[];
    dayHistogram: number[];
  };
};

const SECTOR_LABEL: Record<SectorKey, string> = {
  restoran: "restoran & cafe",
  market: "market & bakkal",
  magaza: "mağaza & perakende",
  hizmet: "hizmet işletmesi",
  yapi: "yapı market & hırdavat",
};

const SECTOR_PRODUCT_HINT: Record<SectorKey, string> = {
  restoran: "öne çıkan tabağınız",
  market: "günlük temel ürününüz",
  magaza: "vitrindeki en çok ilgi gören ürününüz",
  hizmet: "en çok talep edilen hizmetiniz",
  yapi: "en çok satan malzemeniz",
};

const SECTOR_HASHTAGS: Record<SectorKey, string[]> = {
  restoran: ["#yemek", "#lezzet", "#dampingvar", "#yerel"],
  market: ["#market", "#indirim", "#dampingvar", "#mahalle"],
  magaza: ["#magaza", "#firsat", "#dampingvar", "#yerelisletme"],
  hizmet: ["#hizmet", "#randevu", "#dampingvar", "#guven"],
  yapi: ["#yapimarket", "#malzeme", "#dampingvar", "#tadilat"],
};

const SECTOR_CTA: Record<SectorKey, string[]> = {
  restoran: [
    "Masanı ayırt, DampingVar fırsatını kasada göster.",
    "Bugün geçerli dampingi kaçırma — kasa QR'ını okut.",
    "Yolun üstündeyiz, uğrayın, dampingi gösterin.",
  ],
  market: [
    "Alışverişten önce DampingVar'a bak, kasada avantajı yakala.",
    "Haftalık ihtiyacını dampingli al.",
    "Mahallenin damping noktası burada.",
  ],
  magaza: [
    "Vitrine uğra, dampingi kasada göster.",
    "Alışveriş yapmadan önce DampingVar'a bak.",
    "Aradığın ürün burada, avantajı da DampingVar'da.",
  ],
  hizmet: [
    "Randevunu al, DampingVar avantajını belirt.",
    "Bu hafta dampingli fiyat geçerli.",
    "Hizmetin kalitesi aynı, fiyat dampingli.",
  ],
  yapi: [
    "Malzemeyi dampingli al, işin yarısın.",
    "Projeni DampingVar ile ucuza getir.",
    "Toptan ihtiyacın için damping fırsatını incele.",
  ],
};

/* ------------------------------------------------------------------ *
 * 28 GÜNLÜK PLAN — sektör bazlı içerik temaları
 * ------------------------------------------------------------------ */

const PLAN_THEMES: Record<SectorKey, string[]> = {
  restoran: [
    "İşletme tanıtımı",
    "En çok satan tabak",
    "Damping kampanyası",
    "Mutfaktan kısa video",
    "Müşteri yorumu",
    "İşletmenin hikayesi",
    "Haftalık menü fırsatı",
    "Menü karşılaştırması",
    "15 saniyelik Reels",
    "Müşteriye soru: favori tat?",
    "Yeni menü / yeni tat",
    "Öğle menüsü kampanyası",
    "Mahallenin lezzet durağı",
    "Haftalık performans özeti",
    "Şefin önerisi",
    "İçecek + tabak ikilisi",
    "Aile menüsü",
    "Paket servis tanıtımı",
    "Fotoğraf galerisi",
    "Saat kampanyası (18:00–20:00)",
    "Mutfak arkası",
    "Yorum teşekkür paylaşımı",
    "Hafta sonu özel",
    "Yerel etkinlik paylaşımı",
    "Ürün hikayesi: hamurdan tabağa",
    "Kampanya hatırlatma",
    "Müşteri çağrısı",
    "Ayın damping özeti",
  ],
  market: [
    "Mahalle marketi tanıtımı",
    "Haftanın indirimli ürünü",
    "Damping kampanyası",
    "Raflardan kısa video",
    "Müşteri yorumu",
    "Bakkalın hikayesi",
    "Haftalık ihtiyaç listesi",
    "Marka karşılaştırması",
    "15 saniyelik Reels",
    "Müşteriye soru: en çok ne alıyorsun?",
    "Yeni gelen ürünler",
    "Kampanya: temel gıda",
    "Mahalleye özel fiyat",
    "Haftalık performans özeti",
    "Kahvaltılık köşesi",
    "İkili alımda avantaj",
    "Aile boyu alışveriş",
    "Kasada damping deneyimi",
    "Raf düzeni fotoğrafı",
    "Akşam saatleri kampanyası",
    "Tedarikçi / ürün kaynağı",
    "Müşteri teşekkürü",
    "Hafta sonu kampanyası",
    "Yerel üretici paylaşımı",
    "Taze ürün hikayesi",
    "Kampanya hatırlatma",
    "Müşteri çağrısı",
    "Ayın damping özeti",
  ],
  magaza: [
    "Mağaza tanıtımı",
    "Vitrinin yıldızı",
    "Damping kampanyası",
    "Ürün videosu",
    "Müşteri yorumu",
    "Mağazanın hikayesi",
    "Haftalık fırsat",
    "Ürün karşılaştırması",
    "Kısa video: nasıl kullanılır",
    "Müşteri sorusu",
    "Yeni sezon / yeni ürün",
    "Kampanya: seçili ürünler",
    "Yerel içerik: mahallenin esnafı",
    "Haftalık performans",
    "Kombin / set önerisi",
    "Aynı ürün, dampingli fiyat",
    "Hediye rehberi",
    "Kampanya koşulları anlatımı",
    "Vitrin fotoğrafı",
    "Saat kampanyası",
    "Kulisten fotoğraf",
    "Müşteri teşekkürü",
    "Hafta sonu özel",
    "Mağaza içi deneyim",
    "Ürün hikayesi",
    "Kampanya hatırlatma",
    "Müşteri çağrısı",
    "Ayın damping özeti",
  ],
  hizmet: [
    "İşletme ve ekip tanıtımı",
    "En çok talep edilen hizmet",
    "Damping kampanyası",
    "Hizmet videosu",
    "Müşteri yorumu",
    "İşletmenin hikayesi",
    "Haftalık randevu fırsatı",
    "Paket karşılaştırması",
    "Kısa video: süreç",
    "Müşteriye soru",
    "Yeni hizmet",
    "Kampanya: ilk ziyaret",
    "Yerel hizmet tanıtımı",
    "Haftalık performans",
    "Uzman tavsiyesi",
    "Hizmet + bakım ikilisi",
    "Arkadaşına öner",
    "Kampanya koşulları",
    "Öncesi / sonrası",
    "Saat kampanyası",
    "Ekip arkası",
    "Müşteri teşekkürü",
    "Hafta sonu randevu",
    "Yerel işbirliği",
    "Hizmet hikayesi",
    "Kampanya hatırlatma",
    "Randevu çağrısı",
    "Ayın damping özeti",
  ],
  yapi: [
    "İşletme tanıtımı",
    "En çok satan malzeme",
    "Damping kampanyası",
    "Depo / reyon videosu",
    "Müşteri yorumu",
    "İşletmenin hikayesi",
    "Haftalık malzeme fırsatı",
    "Marka karşılaştırması",
    "Kısa video: nasıl uygulanır",
    "Ustaya soru",
    "Yeni gelen malzeme",
    "Kampanya: proje paketi",
    "Yerel ustalara selam",
    "Haftalık performans",
    "Uzman tavsiyesi",
    "Malzeme + işçilik ikilisi",
    "Toptan alım avantajı",
    "Kampanya koşulları",
    "Depo fotoğrafı",
    "Sabah saatleri kampanyası",
    "Tedarik / stok bilgisi",
    "Müşteri teşekkürü",
    "Hafta sonu kampanyası",
    "Yerel proje paylaşımı",
    "Malzeme hikayesi",
    "Kampanya hatırlatma",
    "Müşteri çağrısı",
    "Ayın damping özeti",
  ],
};

const DAY_TASKS = [
  "İşletmenizi 3 cümleyle tanıtın: kim olduğunuz, nerede olduğunuz, neden gelinmesi gerektiği.",
  "En çok satan ürününüzü tek görselle paylaşın, fiyatını ve dampingli fiyatını yazın.",
  "Aktif damping kampanyanızı duyurun: koşulları net, süre belirtili.",
  "15 saniyelik dikey video: ürünün hazırlanışı veya hizmetin akışı.",
  "Gerçek bir müşteri yorumunu alıntıyı tasarımıyla paylaşın.",
  "İşletmenizin kuruluş hikâyesini anlatın — samimi ve kısa.",
  "Bu hafta geçerli tek bir fırsatı öne çıkarın (tek mesaj, tek CTA).",
  "İki ürününüzü karşılaştırın: hangi müşteri için hangisi doğru?",
  "Kısa video serisi: 3 kare, 1 CTA.",
  "Takipçilerinize tek soru sorun, yorumlarda yanıt isteyin.",
  "Yeni gelen ürün/hizmeti ilk kez duyurun.",
  "Saat veya gün bazlı kampanya tanıtımı.",
  "Mahallenizden / ilçenizden bir detay paylaşın (yerel aidiyet).",
  "Haftalık performansınızı paylaşın: kaç kişi gördü, kaç kişi geldi.",
  "Uzman önerisi: müşterinin işine yarayacak 1 ipucu.",
  "İki ürün/hizmeti birleştirin, set fiyatı verin.",
  "Tek seferlik, aciliyeti olan bir fırsat oluşturun.",
  "Kampanya koşullarını şeffaf şekilde maddelerle yazın.",
  "Görsel galerisi: 3 fotoğraf, tek başlık.",
  "Düşük yoğunluklu saatler için özel kampanya duyurusu.",
  "Perde arkası: ekip, hazırlık, günlük rutin.",
  "Bir müşteriye teşekkür edin (izinsiz isim paylaşmayın).",
  "Hafta sonuna özel kampanya.",
  "Bir yerel etkinlik veya işbirliği paylaşın.",
  "Ürünün/hizmetin hikâyesini anlatın: nereden geliyor, nasıl hazırlanıyor.",
  "Aktif kampanyanın bitişine 2 gün kaldığını hatırlatın.",
  "Net bir müşteri çağrısı: bugün uğrayın / arayın / yazın.",
  "Ayın damping özeti: en çok kullanılan kampanya, en çok gelen müşteri kitlesi.",
];

const DAY_CHANNELS = [
  "Instagram Gönderi",
  "Instagram Gönderi",
  "WhatsApp Durum",
  "Instagram Reels",
  "Instagram Gönderi",
  "Facebook Gönderi",
  "WhatsApp Durum",
  "Instagram Gönderi",
  "TikTok",
  "Instagram Story",
  "Instagram Gönderi",
  "WhatsApp Durum",
  "Instagram Story",
  "Instagram Story",
  "Instagram Gönderi",
  "Instagram Story",
  "WhatsApp Durum",
  "Instagram Gönderi",
  "Instagram Story",
  "WhatsApp Durum",
  "Instagram Reels",
  "Instagram Gönderi",
  "WhatsApp Durum",
  "Facebook Gönderi",
  "Instagram Gönderi",
  "Instagram Story",
  "Tüm kanallar",
  "Instagram Gönderi",
];

export type PlanDay = {
  day: number;
  theme: string;
  task: string;
  channel: string;
  cta: string;
};

export function buildMarketingPlan(snapshot: BusinessSnapshot): PlanDay[] {
  const themes = PLAN_THEMES[snapshot.sectorKey] ?? PLAN_THEMES.magaza;
  const ctas = SECTOR_CTA[snapshot.sectorKey] ?? SECTOR_CTA.magaza;
  return themes.map((theme, i) => ({
    day: i + 1,
    theme,
    task: DAY_TASKS[i],
    channel: DAY_CHANNELS[i],
    cta: ctas[i % ctas.length],
  }));
}

/* ------------------------------------------------------------------ *
 * KAMPANYA ÖNERİSİ
 * ------------------------------------------------------------------ */

export type CampaignSuggestion = {
  title: string;
  description: string;
  discountPercent: number;
  minBasketCents: number;
  maxDiscountCents: number;
  timeStart: string | null;
  timeEnd: string | null;
  days: number[];
  audience: string;
  adCopy: string;
  rationale: string;
};

export function suggestCampaign(
  snapshot: BusinessSnapshot,
  goal: string
): CampaignSuggestion {
  const s = snapshot.stats;
  const hist = s.hourHistogram ?? [];
  const weakest = hist.length ? hist.indexOf(Math.min(...hist)) : 18;
  const strongest = hist.length ? hist.indexOf(Math.max(...hist)) : 12;
  const slotStart = Math.max(9, Math.min(21, weakest));
  const slotEnd = Math.min(23, slotStart + 2);
  const top = snapshot.products[0]?.name ?? SECTOR_PRODUCT_HINT[snapshot.sectorKey];
  const avg = Math.max(12000, s.avgBasketCents);
  const goalLower = goal.toLocaleLowerCase("tr-TR");

  let percent = 10;
  if (goalLower.includes("yeni müşteri") || goalLower.includes("müşteri say")) percent = 15;
  if (goalLower.includes("hızlı") || goalLower.includes("acil")) percent = 20;
  if (goalLower.includes("sadakat") || goalLower.includes("tekrar")) percent = 12;

  const timeStart = `${String(slotStart).padStart(2, "0")}:00`;
  const timeEnd = `${String(slotEnd).padStart(2, "0")}:00`;

  return {
    title: `${snapshot.district} ${percent}% Damping Saatleri`,
    description: `${timeStart}–${timeEnd} arasında ${snapshot.name} üzerinden gelen DampingVar müşterilerine sepette %${percent} damping avantajı. Kampanya yalnızca QR doğrulaması ile geçerlidir.`,
    discountPercent: percent,
    minBasketCents: Math.round((avg * 0.7) / 500) * 500,
    maxDiscountCents: Math.round((avg * percent) / 100 / 500) * 500,
    timeStart,
    timeEnd,
    days: [1, 2, 3, 4, 5],
    audience: `${snapshot.district} çevresinde, ${SECTOR_LABEL[snapshot.sectorKey]} arayan müşteriler`,
    adCopy: `${snapshot.name} — ${snapshot.district}. ${top} için bugün %${percent} damping. ${timeStart}–${timeEnd} arasında geçerli. Alışveriş yapmadan önce DampingVar'a bak.`,
    rationale: `Son 7 günde etkileşimin en düşük olduğu saat aralığı ${timeStart}–${timeEnd} (${s.pageViews} sayfa görüntülemenin yalnızca küçük bölümü bu saatte). Bu aralığa özel kampanya, mevcut ${s.qrRedeemed} QR kullanımına ek dönüşüm hedefler.`,
  };
}

/* ------------------------------------------------------------------ *
 * İÇERİK ÜRETİMİ
 * ------------------------------------------------------------------ */

export type GeneratedContent = {
  kind: string;
  platform: string;
  title: string;
  body: string;
  cta: string;
  variant?: string;
  meta?: Record<string, unknown>;
};

const hashtagLine = (s: BusinessSnapshot) =>
  [...(SECTOR_HASHTAGS[s.sectorKey] ?? []), `#${s.district.toLocaleLowerCase("tr-TR").replace(/\s/g, "")}`].join(" ");

export function generateSocial(snap: BusinessSnapshot, platform: string): GeneratedContent {
  const top = snap.products[0]?.name ?? SECTOR_PRODUCT_HINT[snap.sectorKey];
  const price = snap.products[0] ? ` ${snap.products[0].discountPriceCents ? "dampingli fiyat" : "uygun fiyat"}la` : "";
  const campaign = snap.campaigns[0];
  return {
    kind: "SOCIAL",
    platform,
    title: `${snap.district}'de ${top} — ${snap.name}`,
    body:
      `${snap.name}, ${snap.district}'de ${SECTOR_LABEL[snap.sectorKey]} olarak hizmet veriyor.\n\n` +
      `Bugünün öne çıkanı: ${top}${price} sizi bekliyor.` +
      (campaign ? `\n\nAktif damping: ${campaign.title}` : "") +
      `\n\nAdres: ${snap.district}, ${snap.city}\nSaatler: ${snap.stats.transactionCount > 0 ? "bugün yoğunluk var, geç kalmayın" : "sizi bekliyoruz"}\n\n${hashtagLine(snap)}`,
    cta: "Alışveriş yapmadan önce DampingVar'a bak.",
    meta: { product: top, generatedFor: platform },
  };
}

export function generateStory(snap: BusinessSnapshot): GeneratedContent {
  const top = snap.products[0]?.name ?? SECTOR_PRODUCT_HINT[snap.sectorKey];
  return {
    kind: "STORY",
    platform: "Instagram Story",
    title: `${snap.name} · Story serisi`,
    body:
      `Kare 1: ${snap.district} · ${snap.name}\n` +
      `Kare 2: ${top} — damperli fiyatla bugün burada\n` +
      `Kare 3: QR'ı kasada göster, dampingi anında uygula\n` +
      `Kare 4: Yönü tarif et — "Yukarı kaydır" / "DM gönder"`,
    cta: "Kasada DampingVar QR'ını göster.",
  };
}

export type AdVariant = { variant: string; angle: string; headline: string; body: string };

export function generateAdVariants(snap: BusinessSnapshot): AdVariant[] {
  const top = snap.products[0]?.name ?? SECTOR_PRODUCT_HINT[snap.sectorKey];
  const camp = snap.campaigns[0]?.title ?? "Damping fırsatı";
  return [
    {
      variant: "A",
      angle: "Fiyat odaklı",
      headline: `${top}, dampingli fiyatla`,
      body: `${snap.name}'de ${camp}. Sepette net avantaj, kasada doğrulama. ${snap.district} · ${snap.city}.`,
    },
    {
      variant: "B",
      angle: "Avantaj odaklı",
      headline: `Aynı kalite, DampingVar avantajı`,
      body: `${snap.name} müşterileri DampingVar ile daha avantajlı. ${camp} bugün de geçerli.`,
    },
    {
      variant: "C",
      angle: "Lokasyon odaklı",
      headline: `${snap.district}'de damping noktası`,
      body: `${snap.name}, ${snap.district}'de sizi bekliyor. Yol üstü, kolay erişim. ${camp}.`,
    },
    {
      variant: "D",
      angle: "Ürün odaklı",
      headline: `${top} burada`,
      body: `${snap.name} imzasıyla ${top}. ${snap.rating.toFixed(1)} puan, ${snap.reviewCount} müşteri yorumu. ${camp}.`,
    },
    {
      variant: "E",
      angle: "Aciliyet / bugün",
      headline: `Bugün geçerli: ${camp}`,
      body: `Süre dolmadan DampingVar üzerinden kampanyayı aç, QR'ını kasada göster. ${snap.name} · ${snap.district}.`,
    },
  ];
}

export type VideoScript = {
  title: string;
  durationSec: number;
  scenes: { time: string; visual: string; voiceover: string }[];
  cta: string;
};

export function generateVideoScript(snap: BusinessSnapshot, focus?: string): VideoScript {
  const top = focus || snap.products[0]?.name || SECTOR_PRODUCT_HINT[snap.sectorKey];
  return {
    title: `${snap.name} — 15 saniyelik damping videosu`,
    durationSec: 15,
    scenes: [
      { time: "0–3 sn", visual: `${snap.district} sokak görünümü, işletme tabelası`, voiceover: `${snap.district}'de ${snap.name}.` },
      { time: "3–7 sn", visual: `${top} yakın çekim, hazırlanma anı`, voiceover: `${top}, bugün dampingli.` },
      { time: "7–11 sn", visual: `Fiyat kartı: normal fiyat üstü çizili, dampingli fiyat`, voiceover: `DampingVar müşterisine özel avantaj.` },
      { time: "11–15 sn", visual: `QR ekranda, kasa görüntüsü`, voiceover: `Kasada QR'ını göster, avantajı anında al.` },
    ],
    cta: "Alışveriş yapmadan önce DampingVar'a bak.",
  };
}

/* ------------------------------------------------------------------ *
 * PERFORMANS ANALİZİ & HAFTALIK RAPOR
 * ------------------------------------------------------------------ */

export function analysePerformance(snap: BusinessSnapshot): string[] {
  const s = snap.stats;
  const out: string[] = [];
  const conv = s.campaignViews ? (s.qrRedeemed / s.campaignViews) * 100 : 0;
  out.push(
    `İşletme sayfanız ${s.pageViews.toLocaleString("tr-TR")} kez görüntülendi; kampanyalarınız ${s.campaignViews.toLocaleString("tr-TR")} kez incelendi.`
  );
  out.push(
    `${s.qrGenerated} QR üretildi, ${s.qrRedeemed} tanesi gerçek satışla sonuçlandı (kampanya → QR dönüşümü %${conv.toFixed(1)}).`
  );
  if (s.revenueCents > 0) {
    out.push(
      `QR müşterilerinden toplam ${Math.round(s.revenueCents / 100).toLocaleString("tr-TR")} TL satış gerçekleşti; ortalama sepet ${Math.round(s.avgBasketCents / 100).toLocaleString("tr-TR")} TL.`
    );
  }
  const dayNames = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
  const bestDay = s.dayHistogram.indexOf(Math.max(...s.dayHistogram));
  const bestHour = s.hourHistogram.indexOf(Math.max(...s.hourHistogram));
  const weakHour = s.hourHistogram.indexOf(Math.min(...s.hourHistogram));
  out.push(
    `En yüksek dönüşüm ${dayNames[bestDay]} günü ${String(bestHour).padStart(2, "0")}:00–${String(bestHour + 2).padStart(2, "0")}:00 arasında gerçekleşti.`
  );
  out.push(
    `${String(weakHour).padStart(2, "0")}:00–${String(weakHour + 2).padStart(2, "0")}:00 aralığı en düşük etkileşimi gösteriyor; bu saatler için ayrı kampanya açılması önerilir.`
  );
  if (s.repeatRate > 0) {
    out.push(`Müşterilerinizin %${Math.round(s.repeatRate * 100)}'i tekrar ziyaret gerçekleştirdi — sadakat kampanyası için uygun bir taban var.`);
  }
  return out;
}

export function weeklyReport(snap: BusinessSnapshot): { headline: string; bullets: string[]; suggestions: string[] } {
  const s = snap.stats;
  const dayNames = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
  const bestDay = dayNames[s.dayHistogram.indexOf(Math.max(...s.dayHistogram))];
  const bestHour = s.hourHistogram.indexOf(Math.max(...s.hourHistogram));
  return {
    headline: `${snap.name} — haftalık büyüme raporu`,
    bullets: [
      `İşletme sayfanız ${s.pageViews.toLocaleString("tr-TR")} kez görüntülendi.`,
      `${s.campaignViews.toLocaleString("tr-TR")} kişi kampanyanızı inceledi.`,
      `${s.qrRedeemed} müşteri QR fırsatını kullandı ve doğrulandı.`,
      `QR müşterilerinden toplam ${Math.round(s.revenueCents / 100).toLocaleString("tr-TR")} TL satış gerçekleşti.`,
      `En yüksek dönüşüm ${bestDay} günü ${String(bestHour).padStart(2, "0")}:00–${String(bestHour + 2).padStart(2, "0")}:00 arasında gerçekleşti.`,
    ],
    suggestions: [
      `Gelecek hafta için 2 kampanya öneriyoruz: ${bestDay} ${String(bestHour).padStart(2, "0")}:00 saatli sadakat kampanyası ve hafta içi düşük saatlere yönelik damping.`,
      `Yeni müşteri kazanımı için ${snap.district} hedefli bir reklam varyasyonu (Lokasyon odaklı) yayına hazır.`,
    ],
  };
}

export function sectorLabel(key: string): string {
  return SECTOR_LABEL[(key as SectorKey)] ?? key;
}
