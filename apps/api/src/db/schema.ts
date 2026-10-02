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

export const venues = table('venues', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
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
  { kjId: text('kj_id').notNull(), venueId: text('venue_id').notNull() },
  (t) => [primaryKey({ columns: [t.kjId, t.venueId] })],
);

/** "KJ Now": a KJ is on-site and running the show. */
export const kjSessions = table('kj_sessions', {
  id: text('id').primaryKey(),
  kjId: text('kj_id').notNull(),
  venueId: text('venue_id').notNull(),
  startedAt: ts('started_at').notNull(),
  endedAt: ts('ended_at'),
});

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
  (t) => [index('checkins_venue_idx').on(t.venueId, t.checkedOutAt)],
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

export const songs = table('songs', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  artist: text('artist').notNull(),
  genre: text('genre').notNull(),
  decade: text('decade').notNull(),
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
  (t) => [primaryKey({ columns: [t.kjId, t.songId] })],
);

export const songRequests = table('song_requests', {
  id: text('id').primaryKey(),
  kjSessionId: text('kj_session_id').notNull(),
  singerId: text('singer_id').notNull(),
  songId: text('song_id').notNull(),
  source: text('source').$type<'list' | 'roulette' | 'search'>().notNull(),
  status: text('status').$type<'queued' | 'up' | 'done' | 'skipped'>().notNull(),
  createdAt: ts('created_at').notNull(),
});

export const badgeAwards = table('badge_awards', {
  id: text('id').primaryKey(),
  badgeKey: text('badge_key').notNull(),
  recipientId: text('recipient_id').notNull(),
  giverId: text('giver_id').notNull(),
  createdAt: ts('created_at').notNull(),
});

export const praise = table('praise', {
  id: text('id').primaryKey(),
  fromId: text('from_id').notNull(),
  toId: text('to_id').notNull(),
  venueId: text('venue_id'),
  songId: text('song_id'),
  emoji: text('emoji').notNull(),
  message: text('message').notNull(),
  createdAt: ts('created_at').notNull(),
});

export const friendships = table(
  'friendships',
  {
    requesterId: text('requester_id').notNull(),
    addresseeId: text('addressee_id').notNull(),
    status: text('status').$type<'pending' | 'accepted'>().notNull(),
    createdAt: ts('created_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.requesterId, t.addresseeId] })],
);

export const favorites = table(
  'favorites',
  {
    userId: text('user_id').notNull(),
    targetType: text('target_type').$type<'user' | 'venue'>().notNull(),
    targetId: text('target_id').notNull(),
    createdAt: ts('created_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.targetType, t.targetId] })],
);

export const blocks = table(
  'blocks',
  { userId: text('user_id').notNull(), blockedId: text('blocked_id').notNull(), createdAt: ts('created_at').notNull() },
  (t) => [primaryKey({ columns: [t.userId, t.blockedId] })],
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
