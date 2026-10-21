import { useQuery } from '@tanstack/react-query';
import { BookOpen, Upload } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, Pill } from '~/components/ui';
import { api, unwrap } from '~/lib/api';
import { useAction } from '~/lib/queries';

const SAMPLE = `Title,Artist,Genre,Year
Kill Bill,SZA,R&B,2022
Golden Hour,JVKE,Pop,2022
Last Night,Morgan Wallen,Country,2023
Vampire,Olivia Rodrigo,Pop,2023
Texas Hold 'Em,Beyoncé,Country,2024
Birds of a Feather,Billie Eilish,Pop,2024
APT.,ROSÉ & Bruno Mars,Pop,2024
A Bar Song (Tipsy),Shaboozey,Country,2024`;

/** Matches the API's limit: about 60,000 songs. */
const MAX_CHARS = 2_000_000;

/** Song Book management: stats plus CSV import (the format most KJ software exports). */
export function SongbookCard({ compact }: { compact?: boolean }) {
  const { data, refetch } = useQuery({ queryKey: ['songbook'], queryFn: () => unwrap(api.songs.songbook.$get()) });
  const [text, setText] = useState('');
  // A chosen file stays out of the textarea: a whole songbook there makes phones crawl.
  const [file, setFile] = useState<{ name: string; text: string; lines: number } | null>(null);
  const [open, setOpen] = useState(false);
  const pending = file?.text ?? text;
  const tooBig = pending.length > MAX_CHARS;
  const importer = useAction((t: string) => unwrap(api.songs.songbook.import.$post({ json: { text: t } })), {
    success: (r) => `Imported ${r.added} new song${r.added === 1 ? '' : 's'} (${r.lines} lines read)`,
    onSuccess: () => {
      setText('');
      setFile(null);
      setOpen(false);
      refetch();
    },
  });

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold">
          <BookOpen className="size-4 text-violet" /> Song Book
        </div>
        <Button size="sm" onClick={() => setOpen(!open)}>
          <Upload className="size-4" /> Upload
        </Button>
      </div>
      <div className="mt-3 flex items-end gap-2">
        <span className="font-display text-4xl font-bold">{data?.total.toLocaleString() ?? '…'}</span>
        <span className="pb-1.5 text-sm text-muted">songs</span>
      </div>
      {!compact && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {data?.genres.map((g) => (
            <Pill key={g.genre} tone="muted">
              {g.genre} {g.count}
            </Pill>
          ))}
        </div>
      )}
      {open && (
        <div className="mt-4 space-y-2">
          {file ? (
            <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2 px-4 py-3 text-sm">
              <span className="min-w-0 flex-1 truncate">
                <b>{file.name}</b> · {file.lines.toLocaleString()} lines
              </span>
              <button className="text-xs text-muted hover:text-fg" onClick={() => setFile(null)}>
                Remove
              </button>
            </div>
          ) : (
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} className="w-full font-mono text-xs" placeholder="Title, Artist, Genre, Year (one per line)" />
          )}
          {tooBig && <p className="text-xs text-pink">That file is over 2 MB (about 60,000 songs). Split it and import each part.</p>}
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-full border border-line bg-surface-2 px-3 text-xs font-semibold hover:bg-surface-3">
              Choose CSV file
              <input
                type="file"
                accept=".csv,.txt,.tsv"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (!f) return;
                  const t = await f.text();
                  setFile({ name: f.name, text: t, lines: t.split('\n').filter((l) => l.trim()).length });
                }}
              />
            </label>
            <Button size="sm" variant="ghost" onClick={() => (setFile(null), setText(SAMPLE))}>
              Paste sample
            </Button>
            <Button size="sm" variant="primary" className="ml-auto" disabled={!pending.trim() || tooBig} loading={importer.isPending} onClick={() => importer.mutate(pending)}>
              Import songs
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
