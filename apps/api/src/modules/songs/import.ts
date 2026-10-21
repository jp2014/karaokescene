import { parse } from 'csv-parse/sync';
import { fail } from '../../lib/http.ts';

/** The first delimiter outside quoted fields identifies CSV versus TSV. */
function delimiterOf(text: string) {
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '"') {
      if (quoted && text[i + 1] === '"') i++;
      else quoted = !quoted;
    } else if (!quoted && (text[i] === ',' || text[i] === '\t')) return text[i];
  }
  return ',';
}

/** Decode the entire file before persisting anything, including quoted multiline CSV. */
export function parseSongbook(text: string) {
  let records: string[][];
  try {
    records = parse(text, {
      bom: true, trim: true, skip_empty_lines: true, relax_column_count: true,
      delimiter: delimiterOf(text),
    }) as string[][];
  } catch {
    return fail(400, 'Invalid songbook CSV: check quoted fields and delimiters');
  }
  // Retain the original simple "Title - Artist" format for files without CSV/TSV fields.
  if (records.every((row) => row.length === 1)) records = records.map(([line]) => line.split(/\s+-\s+/));
  const songs: { title: string; artist: string; genre: string; year?: number }[] = [];
  let skipped = 0;
  for (const record of records) {
    const [title, artist, genre, year] = record.map((value) => value.trim());
    if (!title || !artist || /^title$/i.test(title)) { skipped++; continue; }
    songs.push({ title, artist, genre: genre || 'Other', year: Number(year) || undefined });
  }
  return { songs, skipped, lines: records.length };
}
