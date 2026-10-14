import { eq } from 'drizzle-orm';
import { db, schema } from '../db/client.ts';
import type { User } from './context.ts';
import { fail } from './http.ts';

/** One paid plan per account type. Venues' plan is their venue's Premier status. */
export const PLAN_NAME = { singer: 'Singer Plus', kj: 'KJ Pro', venue: 'Venue Premier' } as const;

export async function hasPremium(user: User) {
  if (user.role !== 'venue') return user.isPremium;
  const venue = await db.query.venues.findFirst({ where: eq(schema.venues.ownerId, user.id) });
  return !!venue?.isPremiere;
}

export async function requirePremium(user: User, feature: string) {
  if (!(await hasPremium(user))) fail(403, `${feature} is a ${PLAN_NAME[user.role]} feature`);
}

/** Mock checkout (payments are "coming soon"); also lets the demo switch plans off again. */
export async function setPremium(user: User, on: boolean) {
  if (user.role === 'venue') await db.update(schema.venues).set({ isPremiere: on }).where(eq(schema.venues.ownerId, user.id));
  else await db.update(schema.users).set({ isPremium: on }).where(eq(schema.users.id, user.id));
  return { isPremium: on };
}
