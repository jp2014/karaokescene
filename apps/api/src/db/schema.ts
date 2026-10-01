import { sqliteTable, text, integer, real, primaryKey, index } from 'drizzle-orm/sqlite-core';

/** All timestamps are epoch milliseconds. */
const ts = (name: string) => integer(name);

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

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
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
  isPro: integer('is_pro', { mode: 'boolean' }).notNull().default(false),
  ghostMode: integer('ghost_mode', { mode: 'boolean' }).notNull().default(false),
  privacy: text('privacy', { mode: 'json' }).$type<PrivacySettings>().notNull(),
  /** Last known location (from the device or a simulated location). */
  lat: real('lat'),
  lng: real('lng'),
  /** Growth loop: who brought this user in and how many people they've brought. */
  referredById: text('referred_by_id'),
  qrScans: integer('qr_scans').notNull().default(0),
  isPremium: integer('is_premium', { mode: 'boolean' }).notNull().default(false),
  createdAt: ts('created_at').notNull(),
});

export const sessions = sqliteTable('sessions', {
  token: text('token').primaryKey(),
  userId: text('user_id').notNull(),
  createdAt: ts('created_at').notNull(),
});

export const venues = sqliteTable('venues', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  tagline: text('tagline').notNull().default(''),
  description: text('description').notNull().default(''),
  address: text('address').notNull(),
  neighborhood: text('neighborhood').notNull(),
  city: text('city').notNull(),
  lat: real('lat').notNull(),
  lng: real('lng').notNull(),
  hue: integer('hue').notNull().default(280),
  isPremiere: integer('is_premiere', { mode: 'boolean' }).notNull().default(false),
  capacity: integer('capacity').notNull().default(80),
  vibes: text('vibes', { mode: 'json' }).$type<string[]>().notNull(),
});

/** Weekly recurring karaoke nights. Minutes are from local midnight; end may exceed 1440 (past midnight). */
export const karaokeNights = sqliteTable('karaoke_nights', {
  id: text('id').primaryKey(),
  venueId: text('venue_id').notNull(),
  kjId: text('kj_id'),
  dayOfWeek: integer('day_of_week').notNull(),
  startMin: integer('start_min').notNull(),
  endMin: integer('end_min').notNull(),
});

export const kjVenueLinks = sqliteTable(
  'kj_venue_links',
  { kjId: text('kj_id').notNull(), venueId: text('venue_id').notNull() },
  (t) => [primaryKey({ columns: [t.kjId, t.venueId] })],
);

/** "KJ Now": a KJ is on-site and running the show. */
export const kjSessions = sqliteTable('kj_sessions', {
  id: text('id').primaryKey(),
  kjId: text('kj_id').notNull(),
  venueId: text('venue_id').notNull(),
  startedAt: ts('started_at').notNull(),
  endedAt: ts('ended_at'),
});

export const checkins = sqliteTable(
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

export const events = sqliteTable('events', {
  id: text('id').primaryKey(),
  venueId: text('venue_id').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  kind: text('kind').$type<'karaoke' | 'competition' | 'theme' | 'scene'>().notNull(),
  startsAt: ts('starts_at').notNull(),
  endsAt: ts('ends_at').notNull(),
  createdAt: ts('created_at').notNull(),
});

export const specials = sqliteTable('specials', {
  id: text('id').primaryKey(),
  venueId: text('venue_id').notNull(),
  title: text('title').notNull(),
  price: text('price').notNull().default(''),
  details: text('details').notNull().default(''),
  days: text('days', { mode: 'json' }).$type<number[]>().notNull(),
  createdAt: ts('created_at').notNull(),
});

/** "Who's going": a user plans to be at a venue on a date (YYYY-MM-DD). */
export const rsvps = sqliteTable(
  'rsvps',
  { userId: text('user_id').notNull(), venueId: text('venue_id').notNull(), date: text('date').notNull() },
  (t) => [primaryKey({ columns: [t.userId, t.venueId, t.date] })],
);

export const galleryItems = sqliteTable('gallery_items', {
  id: text('id').primaryKey(),
  venueId: text('venue_id').notNull(),
  uploaderId: text('uploader_id').notNull(),
  kind: text('kind').$type<'photo' | 'video'>().notNull(),
  caption: text('caption').notNull().default(''),
  hue: integer('hue').notNull(),
  emoji: text('emoji').notNull(),
  featured: integer('featured', { mode: 'boolean' }).notNull().default(false),
  createdAt: ts('created_at').notNull(),
});

export const songs = sqliteTable('songs', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  artist: text('artist').notNull(),
  genre: text('genre').notNull(),
  decade: text('decade').notNull(),
});

export const songListEntries = sqliteTable(
  'song_list_entries',
  {
    userId: text('user_id').notNull(),
    songId: text('song_id').notNull(),
    isGoTo: integer('is_go_to', { mode: 'boolean' }).notNull().default(false),
    addedAt: ts('added_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.songId] })],
);

export const songbookEntries = sqliteTable(
  'songbook_entries',
  { kjId: text('kj_id').notNull(), songId: text('song_id').notNull() },
  (t) => [primaryKey({ columns: [t.kjId, t.songId] })],
);

export const songRequests = sqliteTable('song_requests', {
  id: text('id').primaryKey(),
  kjSessionId: text('kj_session_id').notNull(),
  singerId: text('singer_id').notNull(),
  songId: text('song_id').notNull(),
  source: text('source').$type<'list' | 'roulette' | 'search'>().notNull(),
  status: text('status').$type<'queued' | 'up' | 'done' | 'skipped'>().notNull(),
  createdAt: ts('created_at').notNull(),
});

export const badgeAwards = sqliteTable('badge_awards', {
  id: text('id').primaryKey(),
  badgeKey: text('badge_key').notNull(),
  recipientId: text('recipient_id').notNull(),
  giverId: text('giver_id').notNull(),
  createdAt: ts('created_at').notNull(),
});

export const praise = sqliteTable('praise', {
  id: text('id').primaryKey(),
  fromId: text('from_id').notNull(),
  toId: text('to_id').notNull(),
  venueId: text('venue_id'),
  songId: text('song_id'),
  emoji: text('emoji').notNull(),
  message: text('message').notNull(),
  createdAt: ts('created_at').notNull(),
});

export const friendships = sqliteTable(
  'friendships',
  {
    requesterId: text('requester_id').notNull(),
    addresseeId: text('addressee_id').notNull(),
    status: text('status').$type<'pending' | 'accepted'>().notNull(),
    createdAt: ts('created_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.requesterId, t.addresseeId] })],
);

export const favorites = sqliteTable(
  'favorites',
  {
    userId: text('user_id').notNull(),
    targetType: text('target_type').$type<'user' | 'venue'>().notNull(),
    targetId: text('target_id').notNull(),
    createdAt: ts('created_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.targetType, t.targetId] })],
);

export const blocks = sqliteTable(
  'blocks',
  { userId: text('user_id').notNull(), blockedId: text('blocked_id').notNull(), createdAt: ts('created_at').notNull() },
  (t) => [primaryKey({ columns: [t.userId, t.blockedId] })],
);

export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  kind: text('kind').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull().default(''),
  link: text('link'),
  readAt: ts('read_at'),
  createdAt: ts('created_at').notNull(),
});

export const promoPosts = sqliteTable('promo_posts', {
  id: text('id').primaryKey(),
  authorId: text('author_id').notNull(),
  venueId: text('venue_id'),
  networks: text('networks', { mode: 'json' }).$type<string[]>().notNull(),
  body: text('body').notNull(),
  scheduledFor: ts('scheduled_for').notNull(),
  status: text('status').$type<'scheduled' | 'posted'>().notNull(),
  createdAt: ts('created_at').notNull(),
});

/** Key/value settings, used for things like the demo clock override. */
export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }).notNull(),
});
