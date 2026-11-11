/**
 * Veritabanı şeması (Drizzle / PostgreSQL).
 * Supabase sürümündeki tabloların birebir karşılığıdır; RLS yerine tüm yazma
 * işlemleri sunucu tarafında yetki kontrolü yapan route/server action'lardan geçer.
 * Bakiye değişiklikleri YALNIZCA src/lib/coins.ts → applyCoinDelta() ile yapılır.
 */
import {
  pgTable, uuid, text, integer, bigint, boolean, timestamp, jsonb, serial,
  primaryKey, uniqueIndex, index,
} from "drizzle-orm/pg-core";

const ts = (n: string) => timestamp(n, { withTimezone: true });
const big = (n: string) => bigint(n, { mode: "number" });

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull(),
  passwordHash: text("password_hash").notNull(),
  avatarUrl: text("avatar_url"),
  level: integer("level").notNull().default(1),
  xp: integer("xp").notNull().default(0),
  coinBalance: big("coin_balance").notNull().default(0),
  birthYear: integer("birth_year"),
  ageConfirmedAt: ts("age_confirmed_at"),
  role: text("role").notNull().default("user"), // user|mod|host|admin
  referredBy: uuid("referred_by"),
  bannedUntil: ts("banned_until"),
  hideOnLeaderboard: boolean("hide_on_leaderboard").notNull().default(false),
  totpSecret: text("totp_secret"),
  totpEnabled: boolean("totp_enabled").notNull().default(false),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("profiles_username_lower").on(t.username)]);

export const sessions = pgTable("sessions", {
  token: text("token").primaryKey(),
  userId: uuid("user_id").notNull(),
  expiresAt: ts("expires_at").notNull(),
});

export const channels = pgTable("channels", {
  id: serial("id").primaryKey(),
  ownerId: uuid("owner_id").notNull(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  category: text("category").notNull().default("Slots"),
  isLive: boolean("is_live").notNull().default(false),
  startedAt: ts("started_at"),
  lastLiveAt: ts("last_live_at"),
  thumbnailUrl: text("thumbnail_url"),
  activeSponsorId: integer("active_sponsor_id"),
  sponsorUntil: ts("sponsor_until"),
  currentGameId: integer("current_game_id"),
  offlineBanner: text("offline_banner").notNull().default("OFFLINE – Her gün 20:00'da"),
  camPosition: text("cam_position").notNull().default("top-left"),
  viewerCount: integer("viewer_count").notNull().default(0),
  status: text("status").notNull().default("active"), // active|suspended
});

export const streamSessions = pgTable("stream_sessions", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").notNull(),
  startedAt: ts("started_at").notNull().defaultNow(),
  endedAt: ts("ended_at"),
  peakViewers: integer("peak_viewers").notNull().default(0),
  livekitRoom: text("livekit_room").notNull(),
});

export const streamGuests = pgTable("stream_guests", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").notNull(),
  userId: uuid("user_id").notNull(),
  status: text("status").notNull().default("invited"), // invited|accepted|live|removed
  canPublishVideo: boolean("can_publish_video").notNull().default(true),
  canPublishAudio: boolean("can_publish_audio").notNull().default(true),
  invitedAt: ts("invited_at").notNull().defaultNow(),
});

export const streamEvents = pgTable("stream_events", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").notNull(),
  type: text("type").notNull(),
  payload: jsonb("payload"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const sponsors = pgTable("sponsors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logoUrl: text("logo_url"),
  bannerUrl: text("banner_url"),
  color: text("color").notNull().default("#dc2626"),
  category: text("category").notNull().default("other"), // casino|gaming|tech|other
  description: text("description").notNull().default(""),
  ctaText: text("cta_text").notNull().default("Bonusu Al"),
  affiliateUrl: text("affiliate_url").notNull(),
  promoCode: text("promo_code"),
  isFeatured: boolean("is_featured").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

/** sponsorId veya category bazlı ülke kuralı. */
export const sponsorGeoRules = pgTable("sponsor_geo_rules", {
  id: serial("id").primaryKey(),
  sponsorId: integer("sponsor_id"),
  category: text("category"),
  countryCode: text("country_code").notNull(),
  visible: boolean("visible").notNull().default(false),
});

export const sponsorClicks = pgTable("sponsor_clicks", {
  id: serial("id").primaryKey(),
  sponsorId: integer("sponsor_id").notNull(),
  userId: uuid("user_id"),
  channelId: integer("channel_id"),
  country: text("country"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const sponsorGames = pgTable("sponsor_games", {
  id: serial("id").primaryKey(),
  sponsorId: integer("sponsor_id").notNull(),
  title: text("title").notNull(),
  launchUrl: text("launch_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  isActive: boolean("is_active").notNull().default(true),
});

export const chatRooms = pgTable("chat_rooms", {
  room: text("room").primaryKey(),
  slowModeSeconds: integer("slow_mode_seconds").notNull().default(0),
  minLevel: integer("min_level").notNull().default(3),
});

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  room: text("room").notNull(),
  userId: uuid("user_id").notNull(),
  body: text("body").notNull(),
  replyTo: integer("reply_to"),
  pinned: boolean("pinned").notNull().default(false),
  deletedBy: uuid("deleted_by"),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("chat_room_idx").on(t.room, t.id)]);

export const chatBans = pgTable("chat_bans", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull(),
  room: text("room").notNull(),
  until: ts("until"),
  reason: text("reason"),
  byUser: uuid("by_user"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

/** Append-only bakiye defteri. UPDATE/DELETE yapılmaz. */
export const coinLedger = pgTable("coin_ledger", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull(),
  delta: big("delta").notNull(),
  reason: text("reason").notNull(),
  refType: text("ref_type"),
  refId: text("ref_id"),
  idempotencyKey: text("idempotency_key").unique(),
  balanceAfter: big("balance_after").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("ledger_user_idx").on(t.userId, t.id)]);

export const userSeeds = pgTable("user_seeds", {
  userId: uuid("user_id").primaryKey(),
  serverSeed: text("server_seed").notNull(),
  clientSeed: text("client_seed").notNull(),
  nonce: integer("nonce").notNull().default(0),
  prevServerSeed: text("prev_server_seed"),
  prevServerSeedHash: text("prev_server_seed_hash"),
});

export const originalsRounds = pgTable("originals_rounds", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull(),
  game: text("game").notNull(),
  bet: big("bet").notNull(),
  serverSeedHash: text("server_seed_hash").notNull(),
  clientSeed: text("client_seed").notNull(),
  nonce: integer("nonce").notNull(),
  state: jsonb("state"),
  status: text("status").notNull().default("finished"), // active|finished
  result: jsonb("result"),
  payout: big("payout").notNull().default(0),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const tournaments = pgTable("tournaments", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // daily|weekly
  startsAt: ts("starts_at").notNull(),
  endsAt: ts("ends_at").notNull(),
  prizePool: integer("prize_pool").notNull(),
  winnersCount: integer("winners_count").notNull().default(10),
  status: text("status").notNull().default("active"), // active|finished
});

export const tournamentScores = pgTable("tournament_scores", {
  tournamentId: integer("tournament_id").notNull(),
  userId: uuid("user_id").notNull(),
  score: big("score").notNull().default(0),
}, (t) => [primaryKey({ columns: [t.tournamentId, t.userId] })]);

export const predictions = pgTable("predictions", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id"),
  title: text("title").notNull(),
  type: text("type").notNull().default("yesno"), // hunt|yesno|range
  options: jsonb("options").$type<string[]>().notNull(),
  closesAt: ts("closes_at").notNull(),
  status: text("status").notNull().default("open"), // open|settled|cancelled
  result: text("result"),
  totalPool: big("total_pool").notNull().default(0),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const predictionEntries = pgTable("prediction_entries", {
  id: serial("id").primaryKey(),
  predictionId: integer("prediction_id").notNull(),
  userId: uuid("user_id").notNull(),
  option: text("option").notNull(),
  amount: big("amount").notNull(),
  payout: big("payout"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const quests = pgTable("quests", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull(), // social|daily
  title: text("title").notNull(),
  rewardCoin: integer("reward_coin").notNull(),
  rules: jsonb("rules").$type<{ event: string; target: number; url?: string }>().notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

/** period: günlük görevlerde 'YYYY-MM-DD', sosyal görevlerde 'once' → sıfırlama kendiliğinden olur. */
export const userQuests = pgTable("user_quests", {
  userId: uuid("user_id").notNull(),
  questId: integer("quest_id").notNull(),
  period: text("period").notNull(),
  progress: integer("progress").notNull().default(0),
  completedAt: ts("completed_at"),
  claimedAt: ts("claimed_at"),
}, (t) => [primaryKey({ columns: [t.userId, t.questId, t.period] })]);

export const claims = pgTable("claims", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull(),
  source: text("source").notNull(),
  amount: integer("amount").notNull(),
  status: text("status").notNull().default("pending"), // pending|claimed
  uniqueKey: text("unique_key").unique(),
  createdAt: ts("created_at").notNull().defaultNow(),
  claimedAt: ts("claimed_at"),
});

export const questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull(),
  body: text("body").notNull(),
  isAnonymous: boolean("is_anonymous").notNull().default(false),
  votes: integer("votes").notNull().default(0),
  status: text("status").notNull().default("pending"), // pending|answered|selected
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const questionVotes = pgTable("question_votes", {
  questionId: integer("question_id").notNull(),
  userId: uuid("user_id").notNull(),
}, (t) => [primaryKey({ columns: [t.questionId, t.userId] })]);

export const promotions = pgTable("promotions", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  type: text("type").notNull().default("event"),
  startsAt: ts("starts_at").notNull(),
  endsAt: ts("ends_at").notNull(),
  bannerUrl: text("banner_url"),
  sponsorId: integer("sponsor_id"),
  ctaUrl: text("cta_url"),
  isFeatured: boolean("is_featured").notNull().default(false),
});

export const storeItems = pgTable("store_items", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  imageUrl: text("image_url"),
  ticketPrice: integer("ticket_price").notNull(),
  maxTickets: integer("max_tickets").notNull(),
  endsAt: ts("ends_at").notNull(),
  winnerId: uuid("winner_id"),
  isActive: boolean("is_active").notNull().default(true),
});

export const storeTickets = pgTable("store_tickets", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id").notNull(),
  userId: uuid("user_id").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull().default("info"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const featureFlags = pgTable("feature_flags", {
  key: text("key").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
});

export const siteSettings = pgTable("site_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const watchPresence = pgTable("watch_presence", {
  userId: uuid("user_id").notNull(),
  channelId: integer("channel_id").notNull(),
  lastSeen: ts("last_seen").notNull().defaultNow(),
  minutesToday: integer("minutes_today").notNull().default(0),
  day: text("day").notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.channelId] })]);

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  actorId: uuid("actor_id"),
  action: text("action").notNull(),
  oldValue: jsonb("old_value"),
  newValue: jsonb("new_value"),
  ip: text("ip"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const deletionRequests = pgTable("deletion_requests", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: ts("created_at").notNull().defaultNow(),
});
