import { sql } from "drizzle-orm";
import { db } from "@/db";
import { moderators, giveaways, scheduleItems, streams, users } from "@/db/schema";

/**
 * Supabase / Vercel'de sıfırdan çalışabilmesi için tablolar idempotent şekilde
 * oluşturulur (drizzle-kit push alternatifi). Her cold-start'te bir kez çalışır.
 */
const DDL = [
  sql`CREATE TABLE IF NOT EXISTS users (
    id serial PRIMARY KEY,
    nickname text NOT NULL,
    nickname_lower text NOT NULL,
    role text NOT NULL DEFAULT 'viewer',
    accent text NOT NULL DEFAULT '#a855f7',
    is_vip boolean NOT NULL DEFAULT false,
    muted_until timestamptz,
    banned_until timestamptz,
    message_count integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now()
  )`,
  sql`CREATE UNIQUE INDEX IF NOT EXISTS users_nickname_lower_idx ON users (nickname_lower)`,
  sql`CREATE TABLE IF NOT EXISTS sessions (
    id serial PRIMARY KEY,
    token text NOT NULL,
    user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  sql`CREATE UNIQUE INDEX IF NOT EXISTS sessions_token_idx ON sessions (token)`,
  sql`CREATE TABLE IF NOT EXISTS streams (
    id serial PRIMARY KEY,
    title text NOT NULL DEFAULT 'Berkbey Canlı Yayın',
    category text NOT NULL DEFAULT 'Sohbet',
    description text NOT NULL DEFAULT '',
    status text NOT NULL DEFAULT 'idle',
    guest_code text NOT NULL DEFAULT 'BERK24',
    chat_locked boolean NOT NULL DEFAULT false,
    slow_mode_seconds integer NOT NULL DEFAULT 0,
    guest_limit integer NOT NULL DEFAULT 3,
    host_nickname text NOT NULL DEFAULT 'Berkbey',
    started_at timestamptz,
    ended_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  sql`CREATE TABLE IF NOT EXISTS stream_participants (
    id serial PRIMARY KEY,
    stream_id integer NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
    user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nickname text NOT NULL,
    role text NOT NULL DEFAULT 'viewer',
    status text NOT NULL DEFAULT 'waiting',
    camera_on boolean NOT NULL DEFAULT false,
    mic_on boolean NOT NULL DEFAULT false,
    hand_raised boolean NOT NULL DEFAULT false,
    is_screen_sharing boolean NOT NULL DEFAULT false,
    joined_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  sql`CREATE UNIQUE INDEX IF NOT EXISTS participants_stream_user_idx ON stream_participants (stream_id, user_id)`,
  sql`CREATE INDEX IF NOT EXISTS participants_stream_idx ON stream_participants (stream_id)`,
  sql`CREATE TABLE IF NOT EXISTS rtc_signals (
    id serial PRIMARY KEY,
    stream_id integer NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
    from_user_id integer NOT NULL,
    to_user_id integer,
    kind text NOT NULL,
    body text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  sql`CREATE INDEX IF NOT EXISTS signals_stream_to_idx ON rtc_signals (stream_id, id)`,
  sql`CREATE TABLE IF NOT EXISTS chat_messages (
    id serial PRIMARY KEY,
    stream_id integer NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
    user_id integer NOT NULL,
    nickname text NOT NULL,
    role text NOT NULL DEFAULT 'viewer',
    accent text NOT NULL DEFAULT '#a855f7',
    body text NOT NULL,
    status text NOT NULL DEFAULT 'visible',
    is_pinned boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  sql`CREATE INDEX IF NOT EXISTS chat_stream_idx ON chat_messages (stream_id, id)`,
  sql`CREATE TABLE IF NOT EXISTS moderators (
    id serial PRIMARY KEY,
    nickname_lower text NOT NULL,
    nickname text NOT NULL,
    added_by text NOT NULL DEFAULT 'Berkbey',
    can_delete boolean NOT NULL DEFAULT true,
    can_ban boolean NOT NULL DEFAULT true,
    note text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  sql`CREATE UNIQUE INDEX IF NOT EXISTS moderators_nickname_idx ON moderators (nickname_lower)`,
  sql`CREATE TABLE IF NOT EXISTS schedule_items (
    id serial PRIMARY KEY,
    day text NOT NULL,
    time text NOT NULL,
    title text NOT NULL,
    category text NOT NULL DEFAULT 'Sohbet',
    is_live boolean NOT NULL DEFAULT false,
    order_index integer NOT NULL DEFAULT 0
  )`,
  sql`CREATE TABLE IF NOT EXISTS giveaways (
    id serial PRIMARY KEY,
    title text NOT NULL,
    prize text NOT NULL DEFAULT '',
    status text NOT NULL DEFAULT 'active',
    winner text NOT NULL DEFAULT '',
    entries integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  sql`CREATE TABLE IF NOT EXISTS activity_log (
    id serial PRIMARY KEY,
    actor text NOT NULL,
    action text NOT NULL,
    target text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  sql`CREATE INDEX IF NOT EXISTS activity_log_created_idx ON activity_log (created_at DESC)`,
];

let bootstrapPromise: Promise<void> | null = null;

async function runBootstrap() {
  for (const statement of DDL) {
    await db.execute(statement);
  }

  // ---- seed ----
  await db
    .insert(users)
    .values({
      nickname: "Berkbey",
      nicknameLower: "berkbey",
      role: "host",
      accent: "#f5c542",
      isVip: true,
    })
    .onConflictDoNothing();

  const mods = [
    { nickname: "AyseMod", note: "Sohbet moderatörü" },
    { nickname: "KralModer", note: "Gece vardiyası" },
    { nickname: "NeoBerk", note: "Konuk onaylama" },
  ];
  for (const mod of mods) {
    await db
      .insert(moderators)
      .values({
        nickname: mod.nickname,
        nicknameLower: mod.nickname.toLocaleLowerCase("tr"),
        addedBy: "Berkbey",
        note: mod.note,
      })
      .onConflictDoNothing();
    await db
      .insert(users)
      .values({
        nickname: mod.nickname,
        nicknameLower: mod.nickname.toLocaleLowerCase("tr"),
        role: "moderator",
        accent: "#22d3ee",
      })
      .onConflictDoNothing();
  }

  const existingStreams = await db.select({ id: streams.id }).from(streams).limit(1);
  if (!existingStreams[0]) {
    await db.insert(streams).values({
      title: "Berkbey ile Canlı Sohbet & Casino Keyfi",
      category: "Sohbet",
      description: "Birlikte daha eğlenceli! Yayına katıl, sohbete yaz, konuk ol ve çekilişlere sende katıl.",
      guestCode: "BERK24",
      hostNickname: "Berkbey",
    });
  }

  const schedule = await db.select({ id: scheduleItems.id }).from(scheduleItems).limit(1);
  if (!schedule[0]) {
    await db.insert(scheduleItems).values([
      { day: "Pazartesi", time: "21:00", title: "Haftanın Açılışı - Sohbet", category: "Sohbet", orderIndex: 1 },
      { day: "Çarşamba", time: "21:30", title: "Canlı Casino Turnuvası", category: "Casino", orderIndex: 2 },
      { day: "Perşembe", time: "22:00", title: "Konuk Programı - Sürpriz Misafir", category: "Konuk", orderIndex: 3 },
      { day: "Cuma", time: "23:00", title: "Büyük Çekiliş Gecesi", category: "Çekiliş", orderIndex: 4 },
      { day: "Cumartesi", time: "20:00", title: "Oyun Maratonu", category: "Oyun", orderIndex: 5 },
      { day: "Pazar", time: "19:00", title: "Berkbey Ailesi Buluşması", category: "Sohbet", orderIndex: 6 },
    ]);
  }

  const gifts = await db.select({ id: giveaways.id }).from(giveaways).limit(1);
  if (!gifts[0]) {
    await db.insert(giveaways).values([
      { title: "Haftalık Gold Çekiliş", prize: "500 TL Hediye Çeki", entries: 1284, status: "active" },
      { title: "Konuk Ol & Kazan", prize: "Yayına Konuk Koltuğu", entries: 342, status: "active" },
      { title: "Geçmiş Çekiliş", prize: "Gaming Koltuk", entries: 2100, status: "done", winner: "KralModer" },
    ]);
  }
}

export async function ensureDatabase(): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = runBootstrap().catch((error) => {
      bootstrapPromise = null;
      throw error;
    });
  }
  return bootstrapPromise;
}

export async function tryEnsureDatabase(): Promise<{ ok: boolean; error?: string }> {
  try {
    await ensureDatabase();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
