// Run from apps/api: node --import tsx scripts/prepare-base-songs.ts <karafun-catalog.csv>
// Converts KaraFun's catalog export (most popular first) into catalog/base-songs.csv, the
// "Title,Artist,Genre,Year" songbook format that scripts/sync-base-songs.ts loads. Row order is rank.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'csv-parse/sync';

const source = process.argv[2];
if (!source) throw new Error('Usage: prepare-base-songs.ts <karafun-catalog.csv>');
const rows = parse(readFileSync(source, 'utf8'), { bom: true, columns: true, trim: true, skip_empty_lines: true, relax_column_count: true }) as Record<string, string | undefined>[];
if (!rows.length || !('Title' in rows[0]) || !('Artist' in rows[0])) throw new Error('Expected a KaraFun export with Title and Artist columns');

const cell = (value: string) => (/[",\t\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value);
const out = ['Title,Artist,Genre,Year'];
let skipped = 0;
for (const row of rows) {
  const title = row.Title ?? '', artist = row.Artist ?? '';
  // The export truncates some titles that contained commas into a row with no artist.
  if (!title || !artist) { skipped++; continue; }
  const genre = (row.Styles ?? '').split(',')[0].trim();
  const year = /^\d{4}$/.test(row.Year ?? '') ? row.Year! : '';
  out.push([title, artist, genre, year].map(cell).join(','));
}
const target = resolve(import.meta.dirname, '../catalog/base-songs.csv');
writeFileSync(target, out.join('\n') + '\n');
console.log(`✓ ${out.length - 1} songs written to catalog/base-songs.csv (${skipped} rows without an artist skipped)`);
