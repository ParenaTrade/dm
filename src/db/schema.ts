import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/** Kullanıcılar: yayıncı, moderatör, konuk, izleyici */
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    nickname: text("nickname").notNull(),
    nicknameLower: text("nickname_lower").notNull(),
    email: text("email"),
    fullName: text("full_name"),
    avatarUrl: text("avatar_url"),
    role: text("role").notNull().default("viewer"), // host | moderator | viewer (guest = sahne koltuğu, katılımcı tablosunda)
    accent: text("accent").notNull().default("#a855f7"),
    isVip: boolean("is_vip").notNull().default(false),
    mutedUntil: timestamp("muted_until", { withTimezone: true }),
    bannedUntil: timestamp("banned_until", { withTimezone: true }),
    messageCount: integer("message_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("users_email_idx").on(table.email),
    index("users_nickname_idx").on(table.nicknameLower),
  ],
);

/** Taraf bazlı oturumlar (cookie token) */
export const sessions = pgTable(
  "sessions",
  {
    id: serial("id").primaryKey(),
    token: text("token").notNull(),
    userId: integer("user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("sessions_token_idx").on(table.token)],
);

/** Canlı yayınlar */
export const streams = pgTable("streams", {
  id: serial("id").primaryKey(),
  title: text("title").notNull().default("Berkbey Canlı Yayın"),
  category: text("category").notNull().default("Sohbet"),
  description: text("description").notNull().default(""),
  status: text("status").notNull().default("idle"), // idle | live | ended
  guestCode: text("guest_code").notNull().default("BERK24"),
  chatLocked: boolean("chat_locked").notNull().default(false),
  slowModeSeconds: integer("slow_mode_seconds").notNull().default(0),
  guestLimit: integer("guest_limit").notNull().default(3),
  hostNickname: text("host_nickname").notNull().default("Berkbey"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Yayın katılımcıları (yayıncı / konuk / izleyici) */
export const participants = pgTable(
  "stream_participants",
  {
    id: serial("id").primaryKey(),
    streamId: integer("stream_id").notNull(),
    userId: integer("user_id").notNull(),
    nickname: text("nickname").notNull(),
    role: text("role").notNull().default("viewer"), // host | guest | viewer
    status: text("status").notNull().default("waiting"), // waiting | live | left | removed
    cameraOn: boolean("camera_on").notNull().default(false),
    micOn: boolean("mic_on").notNull().default(false),
    handRaised: boolean("hand_raised").notNull().default(false),
    isScreenSharing: boolean("is_screen_sharing").notNull().default(false),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("participants_stream_user_idx").on(table.streamId, table.userId),
    index("participants_stream_idx").on(table.streamId),
  ],
);

/** WebRTC sinyal kuyruğu (offer / answer / ice) */
export const rtcSignals = pgTable(
  "rtc_signals",
  {
    id: serial("id").primaryKey(),
    streamId: integer("stream_id").notNull(),
    fromUserId: integer("from_user_id").notNull(),
    toUserId: integer("to_user_id"),
    kind: text("kind").notNull(), // offer | answer | candidate | bye | state
    body: text("body").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("signals_stream_to_idx").on(table.streamId, table.id)],
);

/** Sohbet mesajları */
export const chatMessages = pgTable(
  "chat_messages",
  {
    id: serial("id").primaryKey(),
    streamId: integer("stream_id").notNull(),
    userId: integer("user_id").notNull(),
    nickname: text("nickname").notNull(),
    role: text("role").notNull().default("viewer"),
    accent: text("accent").notNull().default("#a855f7"),
    body: text("body").notNull(),
    status: text("status").notNull().default("visible"), // visible | deleted
    isPinned: boolean("is_pinned").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("chat_stream_idx").on(table.streamId, table.id)],
);

/** Moderatör kadrosu */
export const moderators = pgTable(
  "moderators",
  {
    id: serial("id").primaryKey(),
    nicknameLower: text("nickname_lower").notNull(),
    email: text("email"),
    nickname: text("nickname").notNull(),
    addedBy: text("added_by").notNull().default("Berkbey"),
    canDelete: boolean("can_delete").notNull().default(true),
    canBan: boolean("can_ban").notNull().default(true),
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("moderators_email_idx").on(table.email)],
);

/** Yayın programı */
export const scheduleItems = pgTable("schedule_items", {
  id: serial("id").primaryKey(),
  day: text("day").notNull(),
  time: text("time").notNull(),
  title: text("title").notNull(),
  category: text("category").notNull().default("Sohbet"),
  isLive: boolean("is_live").notNull().default(false),
  orderIndex: integer("order_index").notNull().default(0),
});

/** Çekilişler / hediyeler */
export const giveaways = pgTable("giveaways", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  prize: text("prize").notNull().default(""),
  status: text("status").notNull().default("active"), // active | done
  winner: text("winner").notNull().default(""),
  entries: integer("entries").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Panel olay kaydı */
export const activityLog = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  target: text("target").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
