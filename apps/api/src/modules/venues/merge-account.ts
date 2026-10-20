import { eq, getTableColumns, or, sql, type SQL } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { schema, type DB } from '../../db/client.ts';

/** Move keyed relationships without collisions when both accounts share a friend or favorite. */
export async function mergeAccountRelations(tx: DB, from: string, to: string) {
  const S = schema;
  async function move(table: PgTable, keys: string[], conditional?: { key: string; when: SQL }) {
    const columns = getTableColumns(table);
    const changes = [...keys.map((key) => eq(columns[key], from)), ...(conditional ? [conditional.when] : [])];
    const values = Object.entries(columns).map(([key, col]) => {
      const when = keys.includes(key) ? eq(col, from) : conditional?.key === key ? conditional.when : undefined;
      return when ? sql`case when ${when} then ${to} else ${col} end` : sql`${col}`;
    });
    const names = Object.values(columns).map((col) => sql.identifier(col.name));
    await tx.execute(sql`insert into ${table} (${sql.join(names, sql`, `)})
      select ${sql.join(values, sql`, `)} from ${table} where ${or(...changes)}
      on conflict do nothing`);
    await tx.delete(table).where(or(...changes));
  }
  await move(S.rsvps, ['userId']);
  await move(S.songListEntries, ['userId']);
  await move(S.friendships, ['requesterId', 'addresseeId']);
  await move(S.blocks, ['userId', 'blockedId']);
  await move(S.favorites, ['userId'], { key: 'targetId', when: sql`${S.favorites.targetType} = 'user' and ${S.favorites.targetId} = ${from}` });
}
