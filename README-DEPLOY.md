# Berkbey — Vercel + Next.js + Supabase Canlı Yayın Platformu

cenkbey.com tarzı, **tam bağlantılı** canlı yayın platformu: yayıncı + konuk stüdyosu,
moderatörlü sohbet, moderatör kadrosu, program/çekiliş tabloları ve **Supabase Realtime**
ile gerçek zamanlı mesajlaşma. Supabase env değişkenleri girildiği anda otomatik olarak
"gerçek canlı" moda geçer; girilmezse REST polling ile aynen çalışmaya devam eder.

---

## 1. Supabase tarafı (tablolar)

**Otomatik (önerilen):** Uygulama ilk istekte `supabase/schema.sql` ile birebir aynı
şemayı idempotent olarak kurar (`src/lib/bootstrap.ts`). Hiçbir şey yapman gerekmez.

**Elle:** Supabase Dashboard → **SQL Editor** → New query → `supabase/schema.sql`
dosyasının içeriğini yapıştır → **Run**.

Tablolar:

| Tablo | Görev |
| --- | --- |
| `users` | Takma ad, rol (host/moderator/guest/viewer), susturma & yasak süreleri |
| `sessions` | Cookie tabanlı oturum token'ları |
| `streams` | Yayın başlığı, kategori, durum, konuk kodu, yavaş mod, sohbet kilidi |
| `stream_participants` | Sahnede/ bekleyen/ çıkarılan katılımcılar, kamera-mikrofon durumu |
| `rtc_signals` | WebRTC offer/answer/ICE kuyruğu (Realtime yedek kanalı) |
| `chat_messages` | Sohbet mesajları + silme/sabitleme durumu |
| `moderators` | Moderatör kadrosu |
| `schedule_items` | Haftalık yayın programı (ana sayfa) |
| `giveaways` | Çekilişler |
| `activity_log` | Moderasyon olay kaydı |

## 2. Environment Variables (Vercel)

Vercel → Project → **Settings → Environment Variables** (Production + Preview + Development):

```
SUPABASE_DB_URL=postgresql://postgres.<ref>:<ŞİFRE>@aws-0-<bölge>.pooler.supabase.com:6543/postgres
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role>   # opsiyonel
ADMIN_EMAILS=berk@gmail.com,diger@gmail.com   # admin (yayıncı) e-posta adresleri
```

- `SUPABASE_DB_URL`: Database → Connection string → **URI**, Transaction pooler (6543)
  seçilirse serverless'ta en iyi sonucu verir. Uygulama TLS'i otomatik açar.
- `NEXT_PUBLIC_*`: tarayıcıya açılır; **Realtime** köprüsünü aktive eder.

## 3. Deploy

```bash
# A) GitHub'a push → Vercel → Import Git Repository → Deploy
# B) veya CLI
npm i -g vercel
vercel --prod
```

Build komutları değişmez: `next build`. Tüm API route'ları `runtime = "nodejs"`.

## 4. Doğrulama

- `/api/health` → veritabanı bağlantısı, provider (supabase), TLS, pooler bilgisi.
- `/api/system` → tablo tablo satır sayısı + Realtime anahtar/REST kontrolü.
- `/durum` → görsel "Canlı Sistem Durumu" panosu (deployment, Realtime, tablolar, env rehberi).

`⚡ REALTIME` rozeti görünüyororsa chat ve WebRTC sinyalleri Supabase Realtime
websocket'i üzerinden **anlık** gidiyor demektir; `↻ POOLING` görünüyorsa anahtarlar
yok ve sistem yedek modda çalışıyor (yine canlı, ~1.5 sn gecikme).

## 5. E-posta + şifre ile kayıt/giriş (e-posta onaylı)

Giriş ve kayıt Supabase Auth ile yapılır (ücretsiz). Akış: e-posta yaz → kayıtlıysa şifre ile giriş,
değilse kayıt formu (Ad Soyad + şifre) açılır → "Kaydet" → e-postana onay bağlantısı gelir → bağlantıya
tıklayınca otomatik giriş yapılır. Onaylanmamış e-posta ile oturum açılamaz.

1. Supabase → Authentication → Providers → **Email** açık olsun, **Confirm email** işaretli kalsın.
2. Authentication → URL Configuration → Site URL ve Redirect URLs'e
   `https://<alan-adın>/canli` ve `https://<alan-adın>/panel` ekle (yerelde `http://localhost:3000/**`).
3. Önemli: Supabase'in yerleşik e-posta servisi saatte yalnızca birkaç e-posta gönderir.
   Gerçek kullanımda Authentication → SMTP Settings'ten kendi SMTP'ni bağla (Resend, Brevo, Gmail SMTP vb.).
4. Vercel'de `ADMIN_EMAILS` tanımla. Bu e-postalarla kayıt olup onaylayan kişi **admin (yayıncı)** olur.

| Rol | Nasıl olunur |
| --- | --- |
| Admin / Yayıncı | E-postası `ADMIN_EMAILS` içinde |
| Moderatör | Admin, panelden e-postasını ekler; o e-postayla kayıt olup onaylayınca moderatör olur |
| Konuk | Kayıtlı herhangi bir hesap → `🎤 Konuk Ol` → admin/moderatör onaylar (kamera kapalı katılma seçeneği var) |
| İzleyici | Diğer tüm kayıtlı hesaplar |

## 6. Ekran davranışı (güncel)

- **Ana canlı ekran:** yayıncının paylaştığı oyun / maç / ekran (`🎮 Oyun / Maç / Ekran Paylaş`, ses dahil tarayıcı izin verirse).
  Ekran paylaşılmıyorsa yayıncı kamerası ana ekranı kaplar. Yayın başlamadıysa herkes **📴 Yayın Kapalı** görür.
- **Sol üst popup'lar:** moderatör (yayını sunan kişi) kamerası ve yayıncı kamerası. Moderatör canlı yayına girince kamerası
  otomatik açılır (mikrofon kapalı başlar, tek tıkla açılır) ve popup herkese görünür.
- **Büyüt / küçült:** yayıncı veya moderatör bir popup'a **çift tıklayınca** o kamera ana ekranı kaplar, ana ekrana tekrar
  çift tıklayınca eski düzene döner. Değişiklik **tüm izleyicilerde anında** güncellenir.
- Moderatör/konuk kameraları yayıncı üzerinden herkese aktarılır; konuklar ve moderatör kendi kamerasını görürken sahneyi de görür.
- **Gerçek zamanlı güncelleme:** yayın başlat/bitir, konuk isteği/onayı, ekran düzeni değişiklikleri Supabase Realtime ile anında
  duyurulur; Realtime yoksa 1,5 sn'lik yoklama devreye girer.
- **Sayfa yenileme:** yayıncı yenilerse kamerası otomatik geri gelir (ekran paylaşımı tarayıcı kuralı gereği yeniden başlatılmalı);
  izleyici/moderatör yenilerse bağlantı kendiliğinden yeniden kurulur.
- **Rumuz:** Kayıtta Ad Soyad (gizli) + Rumuz (herkese görünen). İzleyiciler yalnızca rumuz görür.
- Sistem durumu ayrıntıları yalnızca admin/moderatör panelinde; izleyiciler yalnızca **Aktif (yeşil)** / **Pasif (kırmızı)** düğmesini görür.
- Aynı tarayıcıda iki hesap tek oturumu paylaşır; farklı rolleri test etmek için gizli pencere veya başka tarayıcı kullan.

## 7. Notlar

- WebRTC peer-to-peer'dır; iki tarayıcı farklı ağlardaysa TURN gerekir. Aynı ağda
  ya da NAT'a izin veren ağlarda STUN (Google) yeterlidir. TURN eklemek için
  `src/components/studio/useLiveEngine.ts` içindeki `ICE_SERVERS` dizisine
  `turn:` kaydı ekle (kullanıcı adı/şifre env'den okunabilir).
- Realtime broadcast kanalları public'tir (RLS ile satır erişimi ayrıdır). Üretimde
  anon anahtar kısıtlaması + Supabase "Private channels" özelliğini kullanmayı planla.
