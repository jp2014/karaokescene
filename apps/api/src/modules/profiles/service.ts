import { asc, eq, or } from 'drizzle-orm';
import { db, schema } from '../../db/client.ts';
import { toCard } from '../../lib/cards.ts';
import { clock } from '../../lib/clock.ts';
import type { User } from '../../lib/context.ts';
import { fail, notFound } from '../../lib/http.ts';
import { newToken } from '../../lib/ids.ts';
import type { PrivacySettings } from '../../db/schema.ts';
import { presence } from '../presence/service.ts';
import { reputation } from '../reputation/service.ts';
import { social } from '../social/service.ts';
import { songLists, songbooks } from '../songs/service.ts';
import { venues } from '../venues/service.ts';

export const DEFAULT_PRIVACY: PrivacySettings = {
  hometown: 'everyone',
  ageRange: 'friends',
  favoriteNight: 'everyone',
  yearsSinging: 'everyone',
  proStatus: 'everyone',
  songList: 'friends',
};

export type ProfilePatch = Partial<
  Pick<User, 'displayName' | 'bio' | 'avatarHue' | 'avatarEmoji' | 'hometown' | 'ageRange' | 'favoriteNight' | 'yearsSinging' | 'isPro' | 'ghostMode'>
> & { privacy?: Partial<PrivacySettings> };

/** Identity + profile assembly. Everything privacy-related about a person is decided here. */
export const profiles = {
  /** Demo sign-in: issues a bearer token for any seeded account. Real OAuth would issue the same token. */
  async demoSignIn(userId: string) {
    const user = (await db.query.users.findFirst({ where: eq(schema.users.id, userId) })) ?? notFound('User');
    const token = newToken();
    await db.insert(schema.sessions).values({ token, userId: user!.id, createdAt: clock.now() });
    return { token, user: await profiles.me(user!) };
  },

  async demoAccounts() {
    const rows = await db.select().from(schema.users).orderBy(asc(schema.users.role), asc(schema.users.displayName));
    const vs = await venues.all();
    return rows.map((u) => ({
      ...toCard(u),
      bio: u.bio,
      ghostMode: u.ghostMode,
      venueName: u.role === 'venue' ? (vs.find((v) => v.ownerId === u.id)?.name ?? null) : null,
    }));
  },

  async me(user: User) {
    const [badges, checkin, ownedVenue, kjSession] = await Promise.all([
      reputation.summary(user.id),
      presence.currentCheckin(user.id),
      user.role === 'venue' ? venues.ownedBy(user.id) : Promise.resolve(undefined),
      user.role === 'kj' ? presence.kjSessionFor(user.id) : Promise.resolve(null),
    ]);
    return {
      ...user,
      badges,
      checkin,
      venue: ownedVenue ? { id: ownedVenue.id, slug: ownedVenue.slug, name: ownedVenue.name } : null,
      kjSession,
    };
  },

  async update(user: User, patch: ProfilePatch) {
    const { privacy, ...rest } = patch;
    await db
      .update(schema.users)
      .set({ ...rest, ...(privacy ? { privacy: { ...user.privacy, ...privacy } } : {}) })
      .where(eq(schema.users.id, user.id));
    const fresh = (await db.query.users.findFirst({ where: eq(schema.users.id, user.id) }))!;
    return profiles.me(fresh);
  },

  /** A profile as seen by `viewer`, with each field filtered through the owner's privacy settings. */
  async view(viewer: User | null, handle: string) {
    const u = (await db.query.users.findFirst({ where: or(eq(schema.users.handle, handle), eq(schema.users.id, handle)) })) ?? notFound('Profile');
    const user = u!;
    const rel = await social.relationship(viewer?.id, user.id);
    if (rel.blockedBy) fail(404, 'Profile not found');
    const see = (k: keyof PrivacySettings) => social.canSee(user.privacy[k], rel);
    const showPresence = rel.isSelf || !user.ghostMode;
    const checkin = showPresence ? await presence.currentCheckin(user.id) : null;
    const checkinVenue = checkin ? await venues.byId(checkin.venueId) : null;
    const kjSession = user.role === 'kj' ? await presence.kjSessionFor(user.id) : null;
    const kjVenue = kjSession ? await venues.byId(kjSession.venueId) : null;

    return {
      ...toCard(user),
      bio: user.bio,
      createdAt: user.createdAt,
      ghostMode: rel.isSelf ? user.ghostMode : undefined,
      details: {
        hometown: see('hometown') ? user.hometown : undefined,
        ageRange: see('ageRange') ? user.ageRange : undefined,
        favoriteNight: see('favoriteNight') ? user.favoriteNight : undefined,
        yearsSinging: see('yearsSinging') ? user.yearsSinging : undefined,
        isPro: see('proStatus') ? user.isPro : undefined,
      },
      privacy: rel.isSelf ? user.privacy : undefined,
      relationship: rel,
      badges: await reputation.summary(user.id),
      recentBadges: await reputation.recentFor(user.id, 6),
      praise: await social.praiseFeed(viewer?.id, { toId: user.id, limit: 12 }),
      songList: see('songList') ? await songLists.forUser(user.id) : null,
      songListHidden: !see('songList'),
      checkedInAt: checkinVenue ? { name: checkinVenue.name, slug: checkinVenue.slug, since: checkin!.checkedInAt } : null,
      kjNow: kjVenue ? { name: kjVenue.name, slug: kjVenue.slug, since: kjSession!.startedAt } : null,
      kjVenues: user.role === 'kj' ? (await venues.venuesForKj(user.id)).map((v) => ({ id: v.id, slug: v.slug, name: v.name, hue: v.hue, neighborhood: v.neighborhood })) : [],
      songbook: user.role === 'kj' ? await songbooks.stats(user.id) : null,
      managedVenue: user.role === 'venue' ? ((await venues.ownedBy(user.id)) ?? null) : null,
      scansReferred: user.qrScans,
    };
  },

  async search(viewer: User | null, q: string) {
    const hidden = await social.hiddenIds(viewer?.id);
    const term = q.trim().toLowerCase();
    const rows = await db.select().from(schema.users);
    return rows
      .filter((u) => !hidden.has(u.id) && u.id !== viewer?.id)
      .filter((u) => !term || u.displayName.toLowerCase().includes(term) || u.handle.includes(term))
      .slice(0, 30)
      .map(toCard);
  },
};
