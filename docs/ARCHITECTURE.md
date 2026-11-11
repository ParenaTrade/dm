# Cenkbey – Yayıncı Topluluk Platformu · Mimari

> Bu repo, çalışan referans uygulamadır: **Next.js 16 (App Router) + PostgreSQL (Drizzle) + LiveKit**.
> Supabase'e taşıma için birebir karşılıklar aşağıdadır (tablolar aynı, RPC = `src/lib/*` fonksiyonları).

## 1. Mimari diyagram

```
                 ┌──────────────────────── Vercel ────────────────────────┐
 Tarayıcı ──────▶│ Next.js App Router                                     │
 (izleyici/host/ │  • Server Components (sayfalar, geo: x-vercel-ip-country)│
  konuk)         │  • Server Actions (ödül, soru, admin – Origin/CSRF)     │
   │  ▲          │  • Route Handlers /api/*  (zod, rate limit, audit)      │
   │  │ polling  │  • /go/[slug]  sponsor tıklama log + 302                │
   │  │ 2.5–4 sn │  • /api/cron/* (Bearer CRON_SECRET)  ◀── Vercel Cron     │
   │  │          └──────┬───────────────────────────┬─────────────────────┘
   │  │                 │ SQL (tek atomik nokta:    │ livekit-server-sdk
   │  │                 │ applyCoinDelta FOR UPDATE)│ (token, kick, mute)
   │  │          ┌──────▼──────┐             ┌──────▼──────┐
   │  └──────────│ PostgreSQL  │             │  LiveKit    │◀─ webhook (imzalı)
   │             │ (Drizzle)   │             │  SFU/WebRTC │   /api/livekit/webhook
   └──WebRTC────────────────────────────────▶│ channel-<id>│
                 └─────────────┘             └─────────────┘
```

## 2. Tablolar
`src/db/schema.ts` – profiles, sessions, channels, stream_sessions, stream_guests, stream_events, sponsors,
sponsor_geo_rules (sponsor **veya** kategori bazlı), sponsor_clicks, sponsor_games, chat_rooms, chat_messages,
chat_bans, coin_ledger (append-only, idempotency_key unique), user_seeds, originals_rounds, tournaments,
tournament_scores, predictions, prediction_entries, quests, user_quests (period anahtarlı → cron'suz sıfırlama),
claims (unique_key), questions, question_votes, promotions, store_items, store_tickets, notifications,
feature_flags, site_settings, watch_presence, audit_logs, deletion_requests.

### Supabase sürümü için RLS + RPC (özet)
```sql
alter table profiles enable row level security;
create policy "own read"  on profiles for select using (true);
create policy "own write" on profiles for update using (auth.uid() = id)
  with check (auth.uid() = id
    and coin_balance = (select coin_balance from profiles where id = auth.uid())
    and level        = (select level        from profiles where id = auth.uid())
    and role         = (select role         from profiles where id = auth.uid()));

alter table coin_ledger enable row level security;
create policy "ledger own" on coin_ledger for select using (auth.uid() = user_id);   -- yazma yok (yalnız RPC)
alter table originals_rounds enable row level security;
create policy "rounds own" on originals_rounds for select using (auth.uid() = user_id);

alter table chat_messages enable row level security;
create policy "chat read" on chat_messages for select using (deleted_by is null);    -- yazma: post_chat RPC

alter table channels enable row level security;
create policy "ch read" on channels for select using (true);
create policy "ch host" on channels for update using (owner_id = auth.uid()
  or exists(select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

alter table stream_guests enable row level security;
create policy "guest self" on stream_guests for select using (user_id = auth.uid()
  or exists(select 1 from channels c where c.id = channel_id and c.owner_id = auth.uid()));

create or replace function apply_coin_delta(p_user uuid, p_delta bigint, p_reason text,
  p_ref_type text default null, p_ref_id text default null, p_key text default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_bal bigint; v_prev bigint;
begin
  if p_key is not null then
    select balance_after into v_prev from coin_ledger where idempotency_key = p_key;
    if found then return v_prev; end if;
  end if;
  select coin_balance into v_bal from profiles where id = p_user for update;
  if v_bal is null then raise exception 'Kullanıcı bulunamadı'; end if;
  if v_bal + p_delta < 0 then raise exception 'Yetersiz coin bakiyesi'; end if;
  update profiles set coin_balance = v_bal + p_delta where id = p_user;
  insert into coin_ledger(user_id, delta, reason, ref_type, ref_id, idempotency_key, balance_after)
  values (p_user, p_delta, p_reason, p_ref_type, p_ref_id, p_key, v_bal + p_delta);
  return v_bal + p_delta;
end $$;
revoke all on function apply_coin_delta from public, anon, authenticated;  -- yalnız service role
```

## 3. Sunucu fonksiyonları (edge function sözleşmeleri → bu repodaki karşılığı)

| Fonksiyon | Bu repoda | Girdi | Yetki | Çıktı |
|---|---|---|---|---|
| live-token | `POST /api/livekit/token` | `{channel, role: host\|guest\|viewer}` | host=sahip, guest=accepted/live, viewer=kanal canlı | `{token,url,room}` TTL 6s/2s/6s |
| guest-manage | `POST /api/studio` (invite/approve/remove/mute), `POST /api/guest` | zod | host / konuğun kendisi | `{ok}` + LiveKit kick/mute |
| stream-webhook | `POST /api/livekit/webhook` | LiveKit JWT imzalı gövde | WebhookReceiver | is_live, viewer_count, peak |
| award-watch-time | `POST /api/watch` (heartbeat 60 sn) | `{channelId}` | oturum | 1 coin + 2 XP/dk, 120 dk/gün |
| settle-prediction | `lib/predictions.ts` | `{id, result\|null}` | host/admin | parimutuel, FOR UPDATE, idempotent |
| tournament-rollover | `GET /api/cron/tournament-rollover` | – | Bearer CRON_SECRET | claims'e ödül |
| daily-quests-reset | gerekmiyor | – | – | `user_quests.period = YYYY-MM-DD` |
| moderate-chat | `POST /api/chat` içinde | `{room, body, replyTo}` | seviye ≥ min, ban yok | link/kelime filtresi, 2 sn + yavaş mod |
| notify-whatsapp | (kapsam dışı) | – | **JWT + admin zorunlu** olmalı | – |
| auto-confirm-escrows | (store flag) | – | **Bearer CRON_SECRET**, applyCoinDelta | – |

## 4. Canlı yayın bileşen ağacı
```
/yayin/[kanal] → StreamClient (4 sn durum polling, watch heartbeat, konuk daveti)
  └─ LiveStage (role)                       src/components/live/LiveStage.tsx
       ├─ MainVideo  (host ScreenShare, yoksa kamera)
       ├─ PipGroup   (sürükle → köşeye yapış, ⤡ boyut; host konumu channels.cam_position'a kaydeder)
       │    ├─ host kamera  └─ ≤3 konuk (yalnız status=live olanlar izleyiciye görünür)
       ├─ GameBadge · SponsorOverlay (süreli, geo filtreli, /go/[slug]?ch=)
       ├─ StatusBanner (yeniden bağlanıyor / tekrar dene) · Placeholder (OFFLINE banner)
       ├─ FullscreenChat (tam ekranda aç/kapa)
       └─ ControlBar (ses, kalite 1080/720/360/otomatik, bağlantı kalitesi, ⛶ tam ekran)
  └─ Chat room=channel:<id>
/studio → StudioClient (cihaz seçimi, kamera/mikrofon/ekran paylaşımı, yayını başlat/bitir,
          konuk yönetimi, spotlight, sponsor oyunu yeni sekmede + sekme paylaşımı, tahminler, olay log'u)
```

## 5. Coin / ledger akışı
```
aktivite (izleme, görev, turnuva, tahmin, originals)
   │
   ├─ görev/turnuva → claims(pending, unique_key) → "Topla" → claim FOR UPDATE → applyCoinDelta
   ├─ izleme        → applyCoinDelta(key = watch:user:ch:gün:dakika)
   ├─ originals     → openRound: nonce++ → applyCoinDelta(-bahis, key=orig:id:bet)
   │                  finish:    applyCoinDelta(+ödeme, key=orig:id:payout)
   └─ tahmin        → stake: applyCoinDelta(-x) · settle: applyCoinDelta(+pay, key=pred:id:entry)
applyCoinDelta = tek transaction: idempotency kontrol → SELECT … FOR UPDATE → negatif engel → UPDATE → ledger INSERT
Admin düzeltmesi: reason = admin_correction (ledger'a yazılır, audit log'lanır)
```
Coin'ler sanaldır: satın alma / nakde çevirme modülü YOKTUR.

## 6. Uyum
- Sponsor kategorileri + ülke kuralları (varsayılan: TR'de `casino` gizli), `/go` geo kontrolü.
- 18+ kapısı (modal + kayıt doğum yılı), sponsor sayfasında sorumlu oyun uyarısı.
- Store `store_enabled` varsayılan KAPALI.
- Admin TOTP 2FA (`ADMIN_REQUIRE_2FA=true`), audit log, KVKK silme talebi → anonimleştirme.
