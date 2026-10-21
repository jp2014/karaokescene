import { sql } from 'drizzle-orm';
import { bigint, boolean, doublePrecision, index, integer, jsonb, pgSchema, primaryKey, text, uuid } from 'drizzle-orm/pg-core';

/**
 * Everything lives in the `app` schema. On Supabase only `public` is exposed through the
 * Data API, so these tables are reachable only through our API (which runs as the owner).
 */
export const app = pgSchema('app');
const table = app.table;

/** All timestamps are epoch milliseconds. */
const ts = (name: string) => bigint(name, { mode: 'number' });

export type Role = 'singer' | 'kj' | 'venue';
export type Visibility = 'everyone' | 'friends' | 'nobody';
export type PrivacySettings = {
  hometown: Visibility;
  ageRange: Visibility;
  favoriteNight: Visibility;
  yearsSinging: Visibility;
  proStatus: Visibility;
  songList: Visibility;
};

export const users = table('users', {
  id: text('id').primaryKey(),
  /** The Supabase Auth user (auth.users.id) this profile belongs to. Null for seeded demo accounts. */
  authId: uuid('auth_id').unique(),
  role: text('role').$type<Role>().notNull(),
  handle: text('handle').notNull().unique(),
  displayName: text('display_name').notNull(),
  bio: text('bio').notNull().default(''),
  avatarHue: integer('avatar_hue').notNull().default(300),
  avatarEmoji: text('avatar_emoji').notNull().default('🎤'),
  /** Uploaded photo (selfie, venue picture). Falls back to the generated emoji avatar. */
  avatarUrl: text('avatar_url'),
  hometown: text('hometown'),
  ageRange: text('age_range'),
  favoriteNight: text('favorite_night'),
  yearsSinging: integer('years_singing'),
  isPro: boolean('is_pro').notNull().default(false),
  ghostMode: boolean('ghost_mode').notNull().default(false),
  privacy: jsonb('privacy').$type<PrivacySettings>().notNull(),
  /** Last known location (from the device or a simulated location). */
  lat: doublePrecision('lat'),
  lng: doublePrecision('lng'),
  /** Growth loop: who brought this user in and how many people they've brought. */
  referredById: text('referred_by_id'),
  qrScans: integer('qr_scans').notNull().default(0),
  isPremium: boolean('is_premium').notNull().default(false),
  createdAt: ts('created_at').notNull(),
});

export const VENUE_TYPES = ['Bar', 'Lounge', 'Restaurant', 'Karaoke Booths', 'Live Band Karaoke', 'Full Time Karaoke'] as const;
export type VenueType = (typeof VENUE_TYPES)[number];
/** Business hours for one weekday. Minutes from local midnight; close may exceed 1440. */
export type OpenHours = { day: number; openMin: number; closeMin: number };
export type HappyHour = { days: number[]; startMin: number; endMin: number; details: string };

export const venues = table('venues', {
  id: text('id').primaryKey(),
  /** The venue's account. KJ-listed venues get a placeholder account until the owner claims it. */
  ownerId: text('owner_id').notNull().unique(),
  claimed: boolean('claimed').notNull().default(true),
  /** The KJ who listed this venue, when it wasn't created by its owner. */
  createdById: text('created_by_id'),
  /** When the owner claimed a KJ-listed venue (self-serve, so it's recorded). */
  claimedAt: ts('claimed_at'),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  tagline: text('tagline').notNull().default(''),
  description: text('description').notNull().default(''),
  address: text('address').notNull(),
  neighborhood: text('neighborhood').notNull(),
  city: text('city').notNull(),
  lat: doublePrecision('lat').notNull(),
  lng: doublePrecision('lng').notNull(),
  hue: integer('hue').notNull().default(280),
  isPremiere: boolean('is_premiere').notNull().default(false),
  capacity: integer('capacity').notNull().default(80),
  vibes: jsonb('vibes').$type<string[]>().notNull(),
  photoUrl: text('photo_url'),
  venueTypes: jsonb('venue_types').$type<VenueType[]>().notNull().default([]),
  hours: jsonb('hours').$type<OpenHours[]>().notNull().default([]),
  happyHours: jsonb('happy_hours').$type<HappyHour[]>().notNull().default([]),
  foodAvailable: boolean('food_available').notNull().default(false),
  /** Menu as an uploaded PDF or an external link. */
  menuUrl: text('menu_url'),
});

/** Weekly recurring karaoke nights. Minutes are from local midnight; end may exceed 1440 (past midnight). */
export const karaokeNights = table('karaoke_nights', {
  id: text('id').primaryKey(),
  venueId: text('venue_id').notNull(),
  kjId: text('kj_id'),
  dayOfWeek: integer('day_of_week').notNull(),
  startMin: integer('start_min').notNull(),
  endMin: integer('end_min').notNull(),
});

export const kjVenueLinks = table(
  'kj_venue_links',
  {
    kjId: text('kj_id').notNull(),
    venueId: text('venue_id').notNull(),
    /** Auto Promote: post every upcoming night 24 hours before it starts. */
    autoPromote: boolean('auto_promote').notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.kjId, t.venueId] })],
);

/** "KJ Now": a KJ is on-site and running the show. */
export const kjSessions = table(
  'kj_sessions',
  {
    id: text('id').primaryKey(),
    kjId: text('kj_id').notNull(),
    venueId: text('venue_id').notNull(),
    startedAt: ts('started_at').notNull(),
    endedAt: ts('ended_at'),
  },
  // Lookups are for the open session (by KJ, by venue, or all of them for "KJ Now").
  (t) => [
    index('kj_sessions_open_kj_idx').on(t.kjId).where(sql`${t.endedAt} is null`),
    index('kj_sessions_open_venue_idx').on(t.venueId).where(sql`${t.endedAt} is null`),
  ],
);

export const checkins = table(
  'checkins',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    venueId: text('venue_id').notNull(),
    method: text('method').$type<'geo' | 'qr' | 'manual'>().notNull(),
    checkedInAt: ts('checked_in_at').notNull(),
    checkedOutAt: ts('checked_out_at'),
    checkoutReason: text('checkout_reason').$type<'manual' | 'auto-leave' | 'closing'>(),
  },
  (t) => [
    index('checkins_venue_idx').on(t.venueId, t.checkedOutAt),
    // Every heartbeat and most screens ask for one person's open check-in; map counts read all open ones.
    index('checkins_user_idx').on(t.userId, t.venueId),
    index('checkins_open_idx').on(t.checkedInAt).where(sql`${t.checkedOutAt} is null`),
  ],
);

export const events = table('events', {
  id: text('id').primaryKey(),
  venueId: text('venue_id').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  kind: text('kind').$type<'karaoke' | 'competition' | 'theme' | 'scene'>().notNull(),
  startsAt: ts('starts_at').notNull(),
  endsAt: ts('ends_at').notNull(),
  createdAt: ts('created_at').notNull(),
});

export const specials = table('specials', {
  id: text('id').primaryKey(),
  venueId: text('venue_id').notNull(),
  title: text('title').notNull(),
  price: text('price').notNull().default(''),
  details: text('details').notNull().default(''),
  days: jsonb('days').$type<number[]>().notNull(),
  /** Premier reminders to share a special on its days. */
  autoPost: boolean('auto_post').notNull().default(false),
  createdAt: ts('created_at').notNull(),
});

/** "Who's going": a user plans to be at a venue on a date (YYYY-MM-DD). */
export const rsvps = table(
  'rsvps',
  { userId: text('user_id').notNull(), venueId: text('venue_id').notNull(), date: text('date').notNull() },
  (t) => [primaryKey({ columns: [t.userId, t.venueId, t.date] })],
);

export const galleryItems = table('gallery_items', {
  id: text('id').primaryKey(),
  venueId: text('venue_id').notNull(),
  uploaderId: text('uploader_id').notNull(),
  kind: text('kind').$type<'photo' | 'video'>().notNull(),
  caption: text('caption').notNull().default(''),
  /** Uploaded photo/video in object storage. Null for generated art (hue + emoji). */
  mediaUrl: text('media_url'),
  hue: integer('hue').notNull(),
  emoji: text('emoji').notNull(),
  featured: boolean('featured').notNull().default(false),
  createdAt: ts('created_at').notNull(),
});

export const songs = table(
  'songs',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    artist: text('artist').notNull(),
    genre: text('genre').notNull(),
    decade: text('decade').notNull(),
    /**
     * Position in the base catalog (apps/api/catalog/base-songs.csv, 1 = most popular), which
     * makes the song public before any KJ imports it. Null for songs only KJs or singers added.
     */
    baseRank: integer('base_rank'),
  },
  (t) => [
    // Songbook imports match songs case-insensitively by title + artist. Hashed, because a B-tree
    // entry can't exceed ~2.7KB and nothing ever bounded these fields; queries add md5 equality.
    index('songs_title_artist_md5_idx').on(sql`md5(lower(${t.title}))`, sql`md5(lower(${t.artist}))`),
    // Ascending, so nulls sort last: the catalog's default listing reads it in order.
    index('songs_base_rank_idx').on(t.baseRank),
  ],
);

/** The base catalog version last synced (scripts/sync-base-songs.ts), so unchanged releases skip it. */
export const catalogSyncs = table('catalog_syncs', {
  name: text('name').primaryKey(),
  sha256: text('sha256').notNull(),
  songs: integer('songs').notNull(),
  syncedAt: ts('synced_at').notNull(),
});

export const songListEntries = table(
  'song_list_entries',
  {
    userId: text('user_id').notNull(),
    songId: text('song_id').notNull(),
    isGoTo: boolean('is_go_to').notNull().default(false),
    addedAt: ts('added_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.songId] })],
);

export const songbookEntries = table(
  'songbook_entries',
  { kjId: text('kj_id').notNull(), songId: text('song_id').notNull() },
  // song_id: "is this song in any songbook" (the public catalog).
  (t) => [primaryKey({ columns: [t.kjId, t.songId] }), index('songbook_entries_song_idx').on(t.songId)],
);

/**
 * A singer's song submission to the KJ running the show. The app does not mirror the KJ's
 * own rotation software: the KJ just accepts a submission once it's in their system.
 */
export const songRequests = table(
  'song_requests',
  {
    id: text('id').primaryKey(),
    kjSessionId: text('kj_session_id').notNull(),
    singerId: text('singer_id').notNull(),
    songId: text('song_id').notNull(),
    source: text('source').$type<'list' | 'roulette' | 'search' | 'kj'>().notNull(),
    status: text('status').$type<'submitted' | 'accepted' | 'declined' | 'withdrawn'>().notNull(),
    createdAt: ts('created_at').notNull(),
    decidedAt: ts('decided_at'),
  },
  (t) => [index('song_requests_session_idx').on(t.kjSessionId, t.singerId)],
);

/** Venue Coupons: awarded by a venue to a singer, redeemed once when the venue scans the QR. */
export const coupons = table(
  'coupons',
  {
    id: text('id').primaryKey(),
    /** Short code encoded in the QR (/q/c/<code>). */
    code: text('code').notNull().unique(),
    venueId: text('venue_id').notNull(),
    singerId: text('singer_id').notNull(),
    title: text('title').notNull(),
    details: text('details').notNull().default(''),
    expiresAt: ts('expires_at').notNull(),
    redeemedAt: ts('redeemed_at'),
    createdAt: ts('created_at').notNull(),
  },
  (t) => [index('coupons_singer_idx').on(t.singerId)],
);

export const badgeAwards = table(
  'badge_awards',
  {
    id: text('id').primaryKey(),
    badgeKey: text('badge_key').notNull(),
    recipientId: text('recipient_id').notNull(),
    giverId: text('giver_id').notNull(),
    createdAt: ts('created_at').notNull(),
  },
  (t) => [index('badge_awards_recipient_idx').on(t.recipientId)],
);

export const praise = table(
  'praise',
  {
    id: text('id').primaryKey(),
    fromId: text('from_id').notNull(),
    toId: text('to_id').notNull(),
    venueId: text('venue_id'),
    songId: text('song_id'),
    emoji: text('emoji').notNull(),
    message: text('message').notNull(),
    createdAt: ts('created_at').notNull(),
  },
  (t) => [index('praise_to_idx').on(t.toId, t.createdAt), index('praise_created_idx').on(t.createdAt)],
);

export const friendships = table(
  'friendships',
  {
    requesterId: text('requester_id').notNull(),
    addresseeId: text('addressee_id').notNull(),
    status: text('status').$type<'pending' | 'accepted'>().notNull(),
    createdAt: ts('created_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.requesterId, t.addresseeId] }), index('friendships_addressee_idx').on(t.addresseeId)],
);

export const favorites = table(
  'favorites',
  {
    userId: text('user_id').notNull(),
    targetType: text('target_type').$type<'user' | 'venue'>().notNull(),
    targetId: text('target_id').notNull(),
    createdAt: ts('created_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.targetType, t.targetId] }), index('favorites_target_idx').on(t.targetId)],
);

export const blocks = table(
  'blocks',
  { userId: text('user_id').notNull(), blockedId: text('blocked_id').notNull(), createdAt: ts('created_at').notNull() },
  (t) => [primaryKey({ columns: [t.userId, t.blockedId] }), index('blocks_blocked_idx').on(t.blockedId)],
);

export const notifications = table(
  'notifications',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    kind: text('kind').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull().default(''),
    link: text('link'),
    readAt: ts('read_at'),
    createdAt: ts('created_at').notNull(),
  },
  (t) => [index('notifications_user_idx').on(t.userId, t.createdAt)],
);

export const promoPosts = table('promo_posts', {
  id: text('id').primaryKey(),
  /** Source night or special, so deleting it cancels outstanding reminders. */
  sourceKey: text('source_key'),
  authorId: text('author_id').notNull(),
  venueId: text('venue_id'),
  networks: jsonb('networks').$type<string[]>().notNull(),
  body: text('body').notNull(),
  scheduledFor: ts('scheduled_for').notNull(),
  status: text('status').$type<'scheduled' | 'posted'>().notNull(),
  createdAt: ts('created_at').notNull(),
});

/** Devices registered for push (FCM tokens from the PWA, and later the native apps). */
export const pushTokens = table(
  'push_tokens',
  {
    token: text('token').primaryKey(),
    userId: text('user_id').notNull(),
    platform: text('platform').$type<'web' | 'ios' | 'android'>().notNull(),
    createdAt: ts('created_at').notNull(),
  },
  (t) => [index('push_tokens_user_idx').on(t.userId)],
);

/** Key/value settings, used for things like the demo clock override. */
export const appSettings = table('app_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
});
