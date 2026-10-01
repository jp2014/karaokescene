import { inArray } from 'drizzle-orm';
import { db, schema } from '../db/client.ts';
import type { User } from './context.ts';

/** The minimal, always-public projection of a user used across every list in the app. */
export type UserCard = Pick<User, 'id' | 'handle' | 'displayName' | 'role' | 'avatarHue' | 'avatarEmoji' | 'isPro'>;

export const toCard = (u: User): UserCard => ({
  id: u.id,
  handle: u.handle,
  displayName: u.displayName,
  role: u.role,
  avatarHue: u.avatarHue,
  avatarEmoji: u.avatarEmoji,
  isPro: u.isPro,
});

export async function cardsById(ids: string[]): Promise<Map<string, UserCard>> {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map();
  const rows = await db.select().from(schema.users).where(inArray(schema.users.id, unique));
  return new Map(rows.map((u) => [u.id, toCard(u)]));
}
