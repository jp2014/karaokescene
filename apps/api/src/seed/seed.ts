import { is } from 'drizzle-orm';
import { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { db, schema } from '../db/client.ts';
import { clock, localParts, localTimeToMs } from '../lib/clock.ts';
import { DEFAULT_CENTER } from '../lib/geo.ts';
import { newId } from '../lib/ids.ts';
import { BADGES } from '../modules/reputation/badges.ts';
import { DEFAULT_PRIVACY } from '../modules/profiles/service.ts';
import { liveNight } from '../modules/venues/schedule.ts';
import type { PrivacySettings, Visibility } from '../db/schema.ts';
import {
  AGE_RANGES, BIOS, GALLERY_CAPTIONS, HOMETOWNS, KJS, NIGHTS, NIGHTS_OF_WEEK, PRAISE_LINES, SINGER_NAMES, EXTRA_SINGERS, SONGS, SPECIALS, VENUES,
} from './data.ts';

/** Deterministic PRNG so every reset produces the same scene. */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const toMin = (hhmm: string, start?: number) => {
  const [h, m] = hhmm.split(':').map(Number);
  const v = h * 60 + m;
  return start != null && v <= start ? v + 1440 : v;
};

export const DEMO_USERS = { singer: 'usr_jess', kj: 'usr_velvetvox', venue: 'usr_neon-mic' } as const;

/**
 * Time-travel the demo clock to the coming Friday at 10:15pm (scene time) so the map is
 * full of live nights whenever you demo. The debug panel can switch back to real time.
 */
export async function setDemoClock() {
  const real = Date.now();
  const { dayOfWeek } = localParts(real);
  const target = localTimeToMs(real, (5 - dayOfWeek + 7) % 7, 22 * 60 + 15);
  await clock.setOffset(target - real);
}

export async function seed() {
  const r = rng(42);
  const pick = <T>(arr: readonly T[]) => arr[Math.floor(r() * arr.length)];
  const sample = <T>(arr: readonly T[], n: number) => [...arr].sort(() => r() - 0.5).slice(0, n);
  const jitter = (spread: number) => (r() - 0.5) * spread;

  // Wipe everything (order doesn't matter in SQLite without FKs).
  for (const table of Object.values(schema)) {
    if (is(table, SQLiteTable)) await db.delete(table);
  }

  await setDemoClock();
  const now = clock.now();
  const DAY = 86_400_000;

  // --- Songs ---------------------------------------------------------------
  const songs = SONGS.map((s) => ({ id: newId('sng'), title: s.title, artist: s.artist, genre: s.genre, decade: `${Math.floor(s.year / 10) * 10}s` }));
  await db.insert(schema.songs).values(songs);

  // --- Users -------------------------------------------------------------------
  type NewUser = typeof schema.users.$inferInsert;
  const users: NewUser[] = [];
  const baseUser = (u: Partial<NewUser> & Pick<NewUser, 'id' | 'role' | 'handle' | 'displayName'>): NewUser => ({
    bio: '',
    avatarHue: Math.floor(r() * 360),
    avatarEmoji: '🎤',
    privacy: DEFAULT_PRIVACY,
    createdAt: now - Math.floor(r() * 300) * DAY,
    ...u,
  });

  for (const v of VENUES) {
    users.push(baseUser({ id: `usr_${v.slug}`, role: 'venue', handle: v.slug, displayName: v.name, avatarEmoji: '🍸', avatarHue: v.hue, bio: v.tagline, lat: v.lat, lng: v.lng }));
  }
  for (const k of KJS) {
    const home = VENUES.find((v) => v.slug === k.venues[0])!;
    users.push(
      baseUser({
        id: `usr_${k.handle}`, role: 'kj', handle: k.handle, displayName: k.name, avatarEmoji: k.emoji, avatarHue: k.hue, bio: k.bio,
        isPro: true, yearsSinging: 5 + Math.floor(r() * 15), hometown: 'Omaha, NE', lat: home.lat, lng: home.lng,
        isPremium: k.handle === 'velvetvox', qrScans: Math.floor(r() * 30),
      }),
    );
  }
  const visibilities: Visibility[] = ['everyone', 'friends', 'nobody'];
  const singerIds: string[] = [];
  [...SINGER_NAMES, ...EXTRA_SINGERS].forEach(([name, emoji], i) => {
    const [first, last] = name.split(' ');
    const isJess = i === 0;
    const id = isJess ? DEMO_USERS.singer : `usr_${first.toLowerCase()}${last.toLowerCase()}`;
    singerIds.push(id);
    const near = pick(VENUES.slice(0, 15));
    const privacy: PrivacySettings = isJess
      ? DEFAULT_PRIVACY
      : { hometown: pick(visibilities), ageRange: pick(visibilities), favoriteNight: 'everyone', yearsSinging: 'everyone', proStatus: 'everyone', songList: r() > 0.3 ? 'everyone' : 'friends' };
    users.push(
      baseUser({
        id, role: 'singer', handle: isJess ? 'jess' : i < SINGER_NAMES.length ? `${first.toLowerCase()}${last[0].toLowerCase()}` : `${first.toLowerCase()}${last.toLowerCase()}`, displayName: name, avatarEmoji: emoji,
        bio: isJess ? 'Wednesday regular at the Neon Mic. Dolly, Heart and anything with a key change.' : pick(BIOS),
        hometown: isJess ? 'Omaha, NE' : pick(HOMETOWNS), ageRange: isJess ? '30–34' : pick(AGE_RANGES),
        favoriteNight: isJess ? 'Wednesday' : pick(NIGHTS_OF_WEEK), yearsSinging: isJess ? 9 : 1 + Math.floor(r() * 20),
        isPro: !isJess && r() > 0.88, ghostMode: i === 7 || i === 23, privacy,
        lat: near.lat + jitter(0.06), lng: near.lng + jitter(0.08),
        qrScans: isJess ? 7 : Math.floor(r() * 6), referredById: i > 30 && i < 38 ? DEMO_USERS.singer : null,
      }),
    );
  });
  await db.insert(schema.users).values(users);

  // --- Venues, KJs, nights --------------------------------------------------------
  await db.insert(schema.venues).values(
    VENUES.map((v) => ({
      id: `ven_${v.slug}`, ownerId: `usr_${v.slug}`, slug: v.slug, name: v.name, tagline: v.tagline, address: v.address, neighborhood: v.neighborhood,
      city: v.city, lat: v.lat, lng: v.lng, hue: v.hue, isPremiere: v.premiere, capacity: v.capacity, vibes: [...v.vibes],
      description: `${v.name} is a ${v.vibes.join(', ').toLowerCase()} spot in ${v.neighborhood}. ${v.tagline}. Sign up with the KJ, grab a drink special, and check in on Karaoke Scene so your friends know you're here.`,
    })),
  );
  await db.insert(schema.kjVenueLinks).values(KJS.flatMap((k) => k.venues.map((slug) => ({ kjId: `usr_${k.handle}`, venueId: `ven_${slug}` }))));
  const nights = NIGHTS.map(([slug, day, s, e, kj]) => {
    const startMin = toMin(s);
    return { id: newId('nit'), venueId: `ven_${slug}`, kjId: `usr_${kj}`, dayOfWeek: day, startMin, endMin: toMin(e, startMin) };
  });
  await db.insert(schema.karaokeNights).values(nights);
  for (const k of KJS) {
    const book = songs.filter(() => r() > 0.25);
    await db.insert(schema.songbookEntries).values(book.map((s) => ({ kjId: `usr_${k.handle}`, songId: s.id })));
  }

  // --- Song lists -------------------------------------------------------------------
  const lists: (typeof schema.songListEntries.$inferInsert)[] = [];
  for (const id of singerIds) {
    const n = id === DEMO_USERS.singer ? 14 : 4 + Math.floor(r() * 12);
    const chosen = id === DEMO_USERS.singer
      ? songs.filter((s) => ['Jolene', 'Alone', 'Total Eclipse of the Heart', 'Islands in the Stream', 'Dreams', 'Valerie', 'Love on Top', 'Edge of Seventeen', 'Before He Cheats', 'Shallow', "Don't Stop Me Now", 'Good Luck, Babe!', 'Barracuda', 'Rolling in the Deep'].includes(s.title))
      : sample(songs, n);
    chosen.forEach((s, j) => lists.push({ userId: id, songId: s.id, isGoTo: j < (id === DEMO_USERS.singer ? 3 : 2), addedAt: now - Math.floor(r() * 200) * DAY }));
  }
  await db.insert(schema.songListEntries).values(lists);

  // --- Social graph ---------------------------------------------------------------
  const friendPairs = new Set<string>();
  const friendships: (typeof schema.friendships.$inferInsert)[] = [];
  const addFriend = (a: string, b: string, status: 'accepted' | 'pending' = 'accepted') => {
    const key = [a, b].sort().join('|');
    if (a === b || friendPairs.has(key)) return;
    friendPairs.add(key);
    friendships.push({ requesterId: a, addresseeId: b, status, createdAt: now - Math.floor(r() * 100) * DAY });
  };
  singerIds.slice(1, 10).forEach((id) => addFriend(DEMO_USERS.singer, id));
  addFriend(singerIds[12], DEMO_USERS.singer, 'pending');
  addFriend(singerIds[18], DEMO_USERS.singer, 'pending');
  addFriend(DEMO_USERS.singer, singerIds[25], 'pending');
  for (let i = 0; i < 70; i++) addFriend(pick(singerIds.slice(1)), pick(singerIds.slice(1)));
  await db.insert(schema.friendships).values(friendships);
  await db.insert(schema.blocks).values({ userId: DEMO_USERS.singer, blockedId: singerIds[30], createdAt: now - 20 * DAY });

  const favs: (typeof schema.favorites.$inferInsert)[] = [
    { userId: DEMO_USERS.singer, targetType: 'venue', targetId: 'ven_neon-mic', createdAt: now },
    { userId: DEMO_USERS.singer, targetType: 'venue', targetId: 'ven_dundee-duet', createdAt: now },
    { userId: DEMO_USERS.singer, targetType: 'user', targetId: 'usr_velvetvox', createdAt: now },
    { userId: DEMO_USERS.singer, targetType: 'user', targetId: 'usr_kjronnie', createdAt: now },
  ];
  for (const id of singerIds.slice(1)) {
    favs.push({ userId: id, targetType: 'venue', targetId: `ven_${pick(VENUES).slug}`, createdAt: now });
    if (r() > 0.4) favs.push({ userId: id, targetType: 'user', targetId: `usr_${pick(KJS).handle}`, createdAt: now });
  }
  await db.insert(schema.favorites).values(favs).onConflictDoNothing();

  // --- History: past check-ins drive Peak Hours ---------------------------------------
  const checkins: (typeof schema.checkins.$inferInsert)[] = [];
  for (let d = 28; d >= 1; d--) {
    const dayMs = now - d * DAY;
    const dow = localParts(dayMs).dayOfWeek;
    for (const n of nights.filter((x) => x.dayOfWeek === dow)) {
      const venue = VENUES.find((v) => `ven_${v.slug}` === n.venueId)!;
      const crowd = Math.floor((venue.capacity / 8) * (0.6 + r() * 0.8) * (dow === 5 || dow === 6 ? 1.4 : 1));
      for (const userId of sample(singerIds, Math.min(crowd, singerIds.length))) {
        // Arrivals cluster around 1.5h after start (peak), departures 1-3h later.
        const arrive = n.startMin + Math.max(0, Math.round(90 + jitter(150)));
        const stay = 60 + Math.floor(r() * 120);
        const inAt = localTimeToMs(dayMs, 0, Math.min(arrive, n.endMin - 30));
        checkins.push({ id: newId('chk'), userId, venueId: n.venueId, method: pick(['geo', 'qr', 'manual'] as const), checkedInAt: inAt, checkedOutAt: inAt + stay * 60_000, checkoutReason: r() > 0.5 ? 'auto-leave' : 'manual' });
      }
    }
  }

  // --- Right now: live nights, KJ Now and crowds ----------------------------------------
  const kjSessions: (typeof schema.kjSessions.$inferInsert)[] = [];
  const requests: (typeof schema.songRequests.$inferInsert)[] = [];
  const busy = new Set<string>();
  const liveVenues = VENUES.filter((v) => liveNight(nights.filter((n) => n.venueId === `ven_${v.slug}`), now));
  liveVenues.forEach((v, idx) => {
    const night = liveNight(nights.filter((n) => n.venueId === `ven_${v.slug}`), now)!;
    // Leave one live venue without an on-site KJ to show the difference "KJ Now" makes.
    const kjHere = idx !== liveVenues.length - 1 && night.kjId && !kjSessions.some((s) => s.kjId === night.kjId);
    let sessionId: string | null = null;
    if (kjHere) {
      sessionId = newId('kjs');
      kjSessions.push({ id: sessionId, kjId: night.kjId!, venueId: `ven_${v.slug}`, startedAt: now - (40 + Math.floor(r() * 60)) * 60_000, endedAt: null });
    }
    const crowdSize = v.slug === 'neon-mic' ? 19 : Math.floor((v.capacity / 7) * (0.35 + r() * 1.0));
    const pool = singerIds.filter((id) => id !== DEMO_USERS.singer && !busy.has(id));
    const crowd = v.slug === 'neon-mic' ? [singerIds[1], singerIds[2], singerIds[7], ...sample(pool, crowdSize)] : sample(pool, crowdSize);
    for (const userId of new Set(crowd)) {
      if (busy.has(userId)) continue;
      busy.add(userId);
      checkins.push({ id: newId('chk'), userId, venueId: `ven_${v.slug}`, method: pick(['geo', 'qr', 'manual'] as const), checkedInAt: now - Math.floor(10 + r() * 80) * 60_000, checkedOutAt: null, checkoutReason: null });
      if (sessionId && r() > 0.45) {
        const mine = lists.filter((l) => l.userId === userId);
        const song = mine.length ? pick(mine).songId : pick(songs).id;
        requests.push({ id: newId('req'), kjSessionId: sessionId, singerId: userId, songId: song, source: pick(['list', 'roulette', 'search'] as const), status: 'queued', createdAt: now - Math.floor(r() * 50) * 60_000 });
      }
    }
    // Someone just walked out: shows up as an Auto Leave on the KJ booth.
    if (sessionId) {
      const leaver = pick(pool.filter((id) => !busy.has(id)));
      if (leaver) checkins.push({ id: newId('chk'), userId: leaver, venueId: `ven_${v.slug}`, method: 'geo', checkedInAt: now - 70 * 60_000, checkedOutAt: now - 6 * 60_000, checkoutReason: 'auto-leave' });
    }
  });
  // Put the active singer's queue in a believable order with one person "up".
  requests.sort((a, b) => a.createdAt - b.createdAt);
  const firstBySession = new Map<string, number>();
  requests.forEach((q, i) => {
    if (!firstBySession.has(q.kjSessionId)) {
      firstBySession.set(q.kjSessionId, i);
      q.status = 'up';
    }
  });
  for (let i = 0; i < checkins.length; i += 400) await db.insert(schema.checkins).values(checkins.slice(i, i + 400));
  if (kjSessions.length) await db.insert(schema.kjSessions).values(kjSessions);
  if (requests.length) await db.insert(schema.songRequests).values(requests);

  // --- Events, specials, RSVPs ----------------------------------------------------------
  const evt = (slug: string, title: string, kind: 'karaoke' | 'competition' | 'theme' | 'scene', dayOffset: number, startMin: number, hours: number, description: string) => ({
    id: newId('evt'), venueId: `ven_${slug}`, title, kind, description, createdAt: now,
    startsAt: localTimeToMs(now, dayOffset, startMin), endsAt: localTimeToMs(now, dayOffset, startMin + hours * 60),
  });
  await db.insert(schema.events).values([
    evt('neon-mic', 'Karaoke Scene Cup: Qualifier #3', 'competition', 1, 20 * 60, 4, 'Top 5 singers (judged by the KJ + crowd) advance to the Omaha finals. Sign up on Karaoke Scene to compete.'),
    evt('blackstone-social', 'Drag Diva Karaoke', 'theme', 6, 19 * 60, 4, 'Hosted by Mistress of the Mic. Lip-sync allowed, rhinestones encouraged.'),
    evt('ralston-rhapsody', 'Queen Night', 'theme', 4, 20 * 60, 4, 'Every song is Queen. Yes, Bohemian Rhapsody will happen at least four times.'),
    evt('papio-power-ballad', '80s Prom Night', 'theme', 4, 20 * 60, 4, 'Big hair, bigger choruses. Best dressed gets a bar tab.'),
    evt('midtown-encore', 'Karaoke Scene Meetup', 'scene', 8, 19 * 60, 3, 'Meet the people behind the app, scan each other’s QR cards, earn the Founding Member vibe.'),
    evt('river-city-rumble', 'Country Duets Showdown', 'competition', 7, 20 * 60, 4, 'Grab a partner. Winner picks the next month’s theme night.'),
    evt('benson-bellow', 'Punk Rock Karaoke', 'theme', 5, 21 * 60, 4, 'Live band backing tracks. Mosh responsibly.'),
    evt('dundee-duet', 'Duet Roulette', 'karaoke', 5, 20 * 60, 4, 'The app pairs you with a random duet partner and a random song. Good luck.'),
  ]);
  await db.insert(schema.specials).values(SPECIALS.map(([slug, title, price, details, days]) => ({ id: newId('spc'), venueId: `ven_${slug}`, title, price, details, days, createdAt: now })));
  const rsvps: (typeof schema.rsvps.$inferInsert)[] = [];
  for (let d = 0; d < 7; d++) {
    const date = localParts(now + d * DAY).date;
    const dow = localParts(now + d * DAY).dayOfWeek;
    for (const n of nights.filter((x) => x.dayOfWeek === dow)) {
      for (const userId of sample(singerIds.slice(1), 2 + Math.floor(r() * 9))) rsvps.push({ userId, venueId: n.venueId, date });
    }
  }
  rsvps.push({ userId: DEMO_USERS.singer, venueId: 'ven_neon-mic', date: localParts(now + DAY).date });
  await db.insert(schema.rsvps).values(rsvps).onConflictDoNothing();

  // --- Reputation & praise ------------------------------------------------------------
  const awards: (typeof schema.badgeAwards.$inferInsert)[] = [];
  const singerBadges = BADGES.filter((b) => b.givenBy === 'kj');
  const kjBadges = BADGES.filter((b) => b.givenBy === 'venue');
  for (const id of singerIds) {
    const n = id === DEMO_USERS.singer ? 34 : Math.floor(r() * 18);
    for (let i = 0; i < n; i++) {
      const badge = id === DEMO_USERS.singer && i < 16 ? singerBadges[i % 2 === 0 ? 1 : 2] : pick(singerBadges);
      awards.push({ id: newId('bdg'), badgeKey: badge.key, recipientId: id, giverId: `usr_${pick(KJS).handle}`, createdAt: now - Math.floor(r() * 120) * DAY });
    }
  }
  for (const k of KJS) {
    const n = k.handle === 'velvetvox' ? 40 : 6 + Math.floor(r() * 20);
    for (let i = 0; i < n; i++) {
      const badge = k.handle === 'velvetvox' && i < 18 ? kjBadges[i % 3 === 0 ? 0 : 4] : pick(kjBadges);
      awards.push({ id: newId('bdg'), badgeKey: badge.key, recipientId: `usr_${k.handle}`, giverId: `usr_${pick(k.venues)}`, createdAt: now - Math.floor(r() * 120) * DAY });
    }
  }
  awards.push({ id: newId('bdg'), badgeKey: 'growth.scene-builder', recipientId: DEMO_USERS.singer, giverId: 'system', createdAt: now - 10 * DAY });
  awards.push({ id: newId('bdg'), badgeKey: 'growth.scene-builder', recipientId: DEMO_USERS.singer, giverId: 'system', createdAt: now - 3 * DAY });
  await db.insert(schema.badgeAwards).values(awards);

  const praise: (typeof schema.praise.$inferInsert)[] = [];
  for (let i = 0; i < 90; i++) {
    const to = i < 12 ? DEMO_USERS.singer : pick(singerIds);
    const from = pick(singerIds.filter((s) => s !== to && s !== singerIds[30]));
    const [emoji, message] = pick(PRAISE_LINES);
    const fromList = lists.filter((l) => l.userId === to);
    praise.push({
      id: newId('prs'), fromId: from, toId: to, emoji, message, venueId: `ven_${pick(VENUES.slice(0, 15)).slug}`,
      songId: fromList.length ? pick(fromList).songId : null, createdAt: now - Math.floor(r() * 14 * 24 * 60) * 60_000,
    });
  }
  await db.insert(schema.praise).values(praise);

  // --- Gallery, notifications, promo ------------------------------------------------------
  const gallery: (typeof schema.galleryItems.$inferInsert)[] = [];
  for (const v of VENUES) {
    for (let i = 0; i < 6 + Math.floor(r() * 5); i++) {
      const [emoji, caption] = pick(GALLERY_CAPTIONS);
      gallery.push({ id: newId('gal'), venueId: `ven_${v.slug}`, uploaderId: pick(singerIds), kind: r() > 0.75 ? 'video' : 'photo', caption, emoji, hue: (v.hue + Math.floor(jitter(120)) + 360) % 360, featured: i < 2, createdAt: now - Math.floor(r() * 30) * DAY });
    }
  }
  await db.insert(schema.galleryItems).values(gallery);

  const ntf = (userId: string, kind: string, title: string, body: string, minsAgo: number, link?: string) => ({ id: newId('ntf'), userId, kind, title, body, link, createdAt: now - minsAgo * 60_000, readAt: minsAgo > 600 ? now : null });
  await db.insert(schema.notifications).values([
    ntf(DEMO_USERS.singer, 'badge', 'You earned Singing Ability!', 'Awarded by DJ Velvet Vox', 60 * 20, '/me'),
    ntf(DEMO_USERS.singer, 'praise', '🔥 Marcus Bell praised you', 'Absolutely brought the house down', 90, '/me'),
    ntf(DEMO_USERS.singer, 'kj-now', '🎤 DJ Velvet Vox is live now', 'at The Neon Mic', 45, '/venues/neon-mic'),
    ntf(DEMO_USERS.singer, 'friend-request', 'Ray Delgado wants to be friends', '', 30, '/friends'),
    ntf(DEMO_USERS.kj, 'badge', 'You earned Cult Following!', 'Awarded by The Neon Mic', 60 * 26, '/me'),
  ]);
  await db.insert(schema.promoPosts).values([
    { id: newId('pst'), authorId: DEMO_USERS.kj, venueId: 'ven_neon-mic', networks: ['facebook', 'instagram'], body: '🎤 Saturday at The Neon Mic! $3 wells, 9pm–2am. Bring your best Queen. #OmahaKaraoke', scheduledFor: now + DAY - 4 * 3600_000, status: 'scheduled', createdAt: now },
    { id: newId('pst'), authorId: DEMO_USERS.kj, venueId: 'ven_nodo-note', networks: ['instagram', 'karaokescene'], body: 'Wednesday NoDo Note takeover. Deep cuts only 🎧', scheduledFor: now - 2 * DAY, status: 'posted', createdAt: now - 3 * DAY },
  ]);

  return { users: users.length, venues: VENUES.length, songs: songs.length, checkins: checkins.length, live: liveVenues.length, center: DEFAULT_CENTER };
}
