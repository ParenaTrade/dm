"use client";

import { CrudAdmin, type CrudConfig } from "./CrudAdmin";

const PLACEMENTS = [
  { value: "all", label: "Tüm yayınlarda" },
  { value: "oyun", label: "Yalnız oyun yayınlarında" },
  { value: "mac", label: "Yalnız maç yayınlarında" },
  { value: "sohbet", label: "Yalnız sohbet yayınlarında" },
];

const SPONSORS: CrudConfig = {
  title: "Sponsorlar",
  hint: "Marka logosu ve affiliate (iş ortaklığı) adresi. Tıklamalar /go üzerinden sayılır.",
  endpoint: "/api/sponsors",
  titleKey: "name",
  subtitleKey: "url",
  imageKey: "logoUrl",
  fields: [
    { key: "name", label: "Marka adı", required: true },
    { key: "logoUrl", label: "Marka logosu", type: "image" },
    {
      key: "url",
      label: "Affiliate adresi",
      required: true,
      wide: true,
      placeholder: "https://site.com/?ref=berkbey&sub={click_id}",
      hint: "{click_id} yazarsan tıklama kodu oraya konur; yazmazsan aşağıdaki parametre adıyla eklenir.",
    },
    { key: "clickParam", label: "Tıklama kodu parametresi", placeholder: "subid", hint: "Affiliate ağın hangi adı bekliyorsa (subid, sub1, clickid...)" },
    { key: "orderIndex", label: "Sıra", type: "number" },
    { key: "description", label: "Kısa açıklama", type: "textarea", placeholder: "Sponsor sayfasında görünür" },
    { key: "active", label: "Yayında", type: "checkbox" },
  ],
  defaults: { name: "", logoUrl: "", url: "", clickParam: "subid", orderIndex: 0, description: "", active: true },
};

const PROMOS: CrudConfig = {
  title: "Promosyonlar",
  hint: "Bonus, freespin, kayıp bonusu. Yayında logo + metinle döner, tıklayınca affiliate siteye gider.",
  endpoint: "/api/content",
  query: "?kind=promo",
  extra: { kind: "promo" },
  titleKey: "title",
  subtitleKey: "subtitle",
  badgeKey: "badge",
  fields: [
    { key: "sponsorId", label: "Sponsor (logo ve link buradan gelir)", type: "sponsor" },
    {
      key: "badge",
      label: "Etiket",
      type: "select",
      options: [
        { value: "", label: "—" },
        { value: "Hoş geldin bonusu", label: "Hoş geldin bonusu" },
        { value: "Freespin", label: "Freespin" },
        { value: "Kayıp bonusu", label: "Kayıp bonusu" },
        { value: "Yatırım bonusu", label: "Yatırım bonusu" },
        { value: "Özel", label: "Özel" },
      ],
    },
    { key: "title", label: "Başlık", required: true, placeholder: "Hoş geldin bonusu" },
    { key: "subtitle", label: "Vurgu metni", placeholder: "%100 bonus + 50 freespin" },
    { key: "body", label: "Açıklama", type: "textarea" },
    { key: "terms", label: "Şartlar (kartta görünür)", type: "textarea", placeholder: "Çevrim şartı, süre, min. yatırım, geçerli ülkeler..." },
    { key: "linkUrl", label: "Özel affiliate adresi (boşsa sponsorunki)", wide: true },
    { key: "placement", label: "Yayında gösterilsin", type: "select", options: PLACEMENTS },
    { key: "orderIndex", label: "Sıra", type: "number" },
    { key: "active", label: "Yayında", type: "checkbox" },
  ],
  defaults: { sponsorId: "", badge: "", title: "", subtitle: "", body: "", terms: "", linkUrl: "", placement: "all", orderIndex: 0, active: true },
};

const GAMES: CrudConfig = {
  title: "Oyunlar",
  hint: "Yayında oynanan oyunlar. Görsel ve (isteğe bağlı) oyun/affiliate bağlantısı.",
  endpoint: "/api/content",
  query: "?kind=game",
  extra: { kind: "game" },
  titleKey: "title",
  subtitleKey: "subtitle",
  imageKey: "imageUrl",
  fields: [
    { key: "title", label: "Oyun adı", required: true },
    { key: "subtitle", label: "Sağlayıcı / tür" },
    { key: "imageUrl", label: "Oyun görseli", type: "image" },
    { key: "body", label: "Açıklama", type: "textarea" },
    { key: "badge", label: "Etiket", placeholder: "Yeni, Popüler..." },
    { key: "sponsorId", label: "Sponsor", type: "sponsor" },
    { key: "linkUrl", label: "Özel bağlantı (boşsa sponsorunki)", wide: true },
    { key: "orderIndex", label: "Sıra", type: "number" },
    { key: "active", label: "Yayında", type: "checkbox" },
  ],
  defaults: { title: "", subtitle: "", imageUrl: "", body: "", badge: "", sponsorId: "", linkUrl: "", orderIndex: 0, active: true },
};

const MATCHES: CrudConfig = {
  title: "Maçlar",
  hint: "Yaklaşan ve canlı maç yayınları. Başlangıçtan 3 saat sonra listeden otomatik kalkar.",
  endpoint: "/api/content",
  query: "?kind=match",
  extra: { kind: "match" },
  titleKey: "title",
  subtitleKey: "subtitle",
  badgeKey: "badge",
  fields: [
    { key: "title", label: "Maç", required: true, placeholder: "Galatasaray - Fenerbahçe" },
    { key: "subtitle", label: "Lig / organizasyon", placeholder: "Süper Lig" },
    { key: "startsAt", label: "Başlangıç (Türkiye saati)", type: "datetime" },
    { key: "badge", label: "Etiket", placeholder: "Derbi, Canlı yorum..." },
    { key: "body", label: "Açıklama", type: "textarea" },
    { key: "sponsorId", label: "Sponsor", type: "sponsor" },
    { key: "linkUrl", label: "Özel bağlantı (boşsa sponsorunki)", wide: true },
    { key: "orderIndex", label: "Sıra", type: "number" },
    { key: "active", label: "Yayında", type: "checkbox" },
  ],
  defaults: { title: "", subtitle: "", startsAt: "", badge: "", body: "", sponsorId: "", linkUrl: "", orderIndex: 0, active: true },
};

const SCHEDULE: CrudConfig = {
  title: "Yayın Akışı",
  hint: "Ana sayfadaki program listesi. Gün, saat ve kategori (Oyun / Maç / Sohbet...) ile.",
  endpoint: "/api/schedule",
  titleKey: "title",
  subtitleKey: "category",
  fields: [
    { key: "day", label: "Gün", required: true, placeholder: "Pazartesi" },
    { key: "time", label: "Saat", required: true, placeholder: "21:00" },
    { key: "title", label: "Yayın başlığı", required: true, wide: true },
    {
      key: "category",
      label: "Kategori",
      type: "select",
      options: ["Oyun", "Maç Yorumu", "Spor", "Sohbet", "Eğlence", "Konuk Programı", "Çekiliş"].map((c) => ({ value: c, label: c })),
    },
    { key: "orderIndex", label: "Sıra", type: "number" },
  ],
  defaults: { day: "", time: "", title: "", category: "Oyun", orderIndex: 0 },
};

export const SponsorsAdmin = () => <CrudAdmin config={SPONSORS} />;
export const PromosAdmin = () => <CrudAdmin config={PROMOS} />;
export const GamesAdmin = () => <CrudAdmin config={GAMES} />;
export const MatchesAdmin = () => <CrudAdmin config={MATCHES} />;
export const ScheduleAdmin = () => <CrudAdmin config={SCHEDULE} />;
