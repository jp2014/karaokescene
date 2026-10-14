import { sql } from 'drizzle-orm';
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
  /** Uploaded photo (selfie, venue picture). Falls back to the generated emoji avatar. */
  avatarUrl: text('avatar_url'),
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

export const VENUE_TYPES = ['Bar', 'Lounge', 'Restaurant', 'Karaoke Booths', 'Live Band Karaoke', 'Full Time Karaoke'] as const;
export type VenueType = (typeof VENUE_TYPES)[number];
/** Business hours for one weekday. Minutes from local midnight; close may exceed 1440. */
export type OpenHours = { day: number; openMin: number; closeMin: number };
export type HappyHour = { days: number[]; startMin: number; endMin: number; details: string };

export const venues = sqliteTable('venues', {
  id: text('id').primaryKey(),
  /** The venue's account. KJ-listed venues get a placeholder account until the owner claims it. */
  ownerId: text('owner_id').notNull(),
  claimed: integer('claimed', { mode: 'boolean' }).notNull().default(true),
  /** The KJ who listed this venue, when it wasn't created by its owner. */
  createdById: text('created_by_id'),
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
  photoUrl: text('photo_url'),
  venueTypes: text('venue_types', { mode: 'json' }).$type<VenueType[]>().notNull().default(sql`'[]'`),
  hours: text('hours', { mode: 'json' }).$type<OpenHours[]>().notNull().default(sql`'[]'`),
  happyHours: text('happy_hours', { mode: 'json' }).$type<HappyHour[]>().notNull().default(sql`'[]'`),
  foodAvailable: integer('food_available', { mode: 'boolean' }).notNull().default(false),
  /** Menu as an uploaded PDF or an external link. */
  menuUrl: text('menu_url'),
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
  {
    kjId: text('kj_id').notNull(),
    venueId: text('venue_id').notNull(),
    /** Auto Promote: post every upcoming night 24 hours before it starts. */
    autoPromote: integer('auto_promote', { mode: 'boolean' }).notNull().default(false),
  },
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
  /** Drink Special Auto Post (Premier): announce it on each of its days. */
  autoPost: integer('auto_post', { mode: 'boolean' }).notNull().default(false),
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
  imageUrl: text('image_url'),
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

/**
 * A singer's song submission to the KJ running the show. The app does not mirror the KJ's
 * own rotation software: the KJ just accepts a submission once it's in their system.
 */
export const songRequests = sqliteTable('song_requests', {
  id: text('id').primaryKey(),
  kjSessionId: text('kj_session_id').notNull(),
  singerId: text('singer_id').notNull(),
  songId: text('song_id').notNull(),
  source: text('source').$type<'list' | 'roulette' | 'search' | 'kj'>().notNull(),
  status: text('status').$type<'submitted' | 'accepted' | 'declined' | 'withdrawn'>().notNull(),
  createdAt: ts('created_at').notNull(),
  decidedAt: ts('decided_at'),
});

/** Venue Coupons: awarded by a venue to a singer, redeemed once when the venue scans the QR. */
export const coupons = sqliteTable(
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
