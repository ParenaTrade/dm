-- ============================================================
-- Berkbey Canlı Yayın Platformu — Supabase şeması
-- Supabase Dashboard → SQL Editor → New query → yapıştır → Run
-- Uygulama ilk istekte aynı şemayı idempotent olarak kurar,
-- ancak elle çalıştırmak tam kontrol sağlar.
-- ============================================================

create table if not exists public.users (
  id serial primary key,
  nickname text not null,
  nickname_lower text not null,
  email text,
  avatar_url text,
  role text not null default 'viewer',           -- host | moderator | guest | viewer
  accent text not null default '#a855f7',
  is_vip boolean not null default false,
  muted_until timestamptz,
  banned_until timestamptz,
  message_count integer not null default 0,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
alter table public.streams add column if not exists stage_layout text not null default 'screen';
alter table public.users add column if not exists email text;
alter table public.users add column if not exists avatar_url text;
alter table public.users add column if not exists full_name text;
drop index if exists public.users_nickname_lower_idx;
create index if not exists users_nickname_idx on public.users (nickname_lower);
create unique index if not exists users_email_idx on public.users (email);

create table if not exists public.sessions (
  id serial primary key,
  token text not null,
  user_id integer not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create unique index if not exists sessions_token_idx on public.sessions (token);

create table if not exists public.streams (
  id serial primary key,
  title text not null default 'Berkbey Canlı Yayın',
  category text not null default 'Sohbet',
  description text not null default '',
  status text not null default 'idle',           -- idle | live | ended
  guest_code text not null default 'BERK24',
  chat_locked boolean not null default false,
  slow_mode_seconds integer not null default 0,
  guest_limit integer not null default 3,
  host_nickname text not null default 'Berkbey',
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.stream_participants (
  id serial primary key,
  stream_id integer not null references public.streams(id) on delete cascade,
  user_id integer not null references public.users(id) on delete cascade,
  nickname text not null,
  role text not null default 'viewer',           -- host | guest | moderator | viewer
  status text not null default 'waiting',        -- waiting | live | left | removed
  camera_on boolean not null default false,
  mic_on boolean not null default false,
  hand_raised boolean not null default false,
  is_screen_sharing boolean not null default false,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists participants_stream_user_idx on public.stream_participants (stream_id, user_id);
create index if not exists participants_stream_idx on public.stream_participants (stream_id);

-- WebRTC sinyal kuyruğu (Realtime aktifken sadece yedek olarak kullanılır)
create table if not exists public.rtc_signals (
  id serial primary key,
  stream_id integer not null references public.streams(id) on delete cascade,
  from_user_id integer not null,
  to_user_id integer,
  kind text not null,                            -- offer | answer | candidate | bye
  body text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists signals_stream_to_idx on public.rtc_signals (stream_id, id);

create table if not exists public.chat_messages (
  id serial primary key,
  stream_id integer not null references public.streams(id) on delete cascade,
  user_id integer not null,
  nickname text not null,
  role text not null default 'viewer',
  accent text not null default '#a855f7',
  body text not null,
  status text not null default 'visible',        -- visible | deleted
  is_pinned boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists chat_stream_idx on public.chat_messages (stream_id, id);

create table if not exists public.moderators (
  id serial primary key,
  nickname_lower text not null,
  email text,
  nickname text not null,
  added_by text not null default 'Berkbey',
  can_delete boolean not null default true,
  can_ban boolean not null default true,
  note text not null default '',
  created_at timestamptz not null default now()
);
alter table public.moderators add column if not exists email text;
drop index if exists public.moderators_nickname_idx;
create unique index if not exists moderators_email_idx on public.moderators (email);
delete from public.moderators where email is null;
update public.users set role = 'viewer' where email is null and role in ('host', 'moderator');

create table if not exists public.schedule_items (
  id serial primary key,
  day text not null,
  time text not null,
  title text not null,
  category text not null default 'Sohbet',
  is_live boolean not null default false,
  order_index integer not null default 0
);

create table if not exists public.giveaways (
  id serial primary key,
  title text not null,
  prize text not null default '',
  status text not null default 'active',         -- active | done
  winner text not null default '',
  entries integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_log (
  id serial primary key,
  actor text not null,
  action text not null,
  target text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists activity_log_created_idx on public.activity_log (created_at desc);

-- ============================================================
-- Seed (yayıncı, moderatörler, yayın, program, çekilişler)
-- ============================================================
insert into public.streams (title, category, description, guest_code, host_nickname)
select 'Berkbey Canlı Yayın — Spor, Oyun, Eğlence & Sohbet', 'Sohbet',
       'Birlikte daha eğlenceli! Maç yorumu, oyun, eğlence ve sohbet için yayına katıl.',
       'BERK24', 'Berkbey'
where not exists (select 1 from public.streams);

insert into public.schedule_items (day, time, title, category, order_index)
select * from (values
  ('Pazartesi', '21:00', 'Haftanın Açılışı - Sohbet', 'Sohbet', 1),
  ('Çarşamba', '21:30', 'Canlı Casino Turnuvası', 'Casino', 2),
  ('Perşembe', '22:00', 'Konuk Programı - Sürpriz Misafir', 'Konuk', 3),
  ('Cuma', '23:00', 'Büyük Çekiliş Gecesi', 'Çekiliş', 4),
  ('Cumartesi', '20:00', 'Oyun Maratonu', 'Oyun', 5),
  ('Pazar', '19:00', 'Berkbey Ailesi Buluşması', 'Sohbet', 6)
) as v(day, time, title, category, order_index)
where not exists (select 1 from public.schedule_items);

insert into public.giveaways (title, prize, entries, status, winner)
select * from (values
  ('Haftalık Gold Çekiliş', '500 TL Hediye Çeki', 1284, 'active', ''),
  ('Konuk Ol & Kazan', 'Yayına Konuk Koltuğu', 342, 'active', ''),
  ('Geçmiş Çekiliş', 'Gaming Koltuk', 2100, 'done', 'KralModer')
) as v(title, prize, entries, status, winner)
where not exists (select 1 from public.giveaways);

-- ============================================================
-- Realtime: chat tablosunu yayına al (database change source olarak da
-- kullanılabilsin diye). Broadcast kanalları için zorunlu değildir.
-- ============================================================
do $$
begin
  alter publication supabase_realtime add table public.chat_messages;
exception
  when duplicate_object then null;
  when others then null;
end $$;

-- ============================================================
-- RLS: uygulama Postgres bağlantısını service/postgres rolüyle yaptığından
-- tablolara erişebilir. Anon tarayıcı erişimi yalnızca REST/Realtime
-- broadcast kanalı kullanır (satır okuma gerekmez). Şu anahtarlarla güvenli
-- varsayılan olarak tabloları kilitliyoruz:
-- ============================================================
alter table public.users enable row level security;
alter table public.sessions enable row level security;
alter table public.streams enable row level security;
alter table public.stream_participants enable row level security;
alter table public.rtc_signals enable row level security;
alter table public.chat_messages enable row level security;
alter table public.moderators enable row level security;
alter table public.schedule_items enable row level security;
alter table public.giveaways enable row level security;
alter table public.activity_log enable row level security;

-- Herkese açık yayın listesi + program (okuma)
create policy "public read schedule" on public.schedule_items
  for select using (true);
create policy "public read giveaways" on public.giveaways
  for select using (true);
create policy "public read streams" on public.streams
  for select using (true);
create policy "public read chat" on public.chat_messages
  for select using (status = 'visible');
create policy "public read participants" on public.stream_participants
  for select using (status <> 'removed');

-- Yazar işlemleri sunucu tarafı (postgres rolü) üzerinden yapılır; anon için
-- insert/update/delete politikası vermiyoruz.
