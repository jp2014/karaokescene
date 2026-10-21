import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { BookOpen, PenLine, Plus, Search, Sparkles, Star, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useDebounced } from '~/lib/debounce';
import { Avatar } from '~/components/Avatar';
import { PremiumGate } from '~/components/Premium';
import { Button, Card, cx, EmptyState, Pill, Section, Spinner, Toggle } from '~/components/ui';
import { api, unwrap } from '~/lib/api';
import { qk, useAction, useMe, useMyLive, useMySongs } from '~/lib/queries';
import { SongRoulette } from './SongRoulette';

/** Free Add: any song, even one no KJ has in their book yet. */
function FreeAdd({ initialTitle }: { initialTitle: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const add = useAction(() => unwrap(api.songs.mine.custom.$post({ json: { title, artist } })), {
    invalidate: [qk.mySongs, ['recs']],
    success: (s) => `Added “${s.title}” 🎶`,
    onSuccess: () => {
      setTitle('');
      setArtist('');
      setOpen(false);
    },
  });
  if (!open)
    return (
      <button
        onClick={() => {
          setTitle(initialTitle);
          setOpen(true);
        }}
        className="flex w-full items-center gap-2 rounded-2xl border border-dashed border-line-strong px-4 py-3 text-left text-sm text-muted hover:text-fg"
      >
        <PenLine className="size-4" /> Can't find a song? Add any title and artist yourself
      </button>
    );
  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <PenLine className="size-4 text-pink" /> Add any song
      </div>
      <div className="flex flex-wrap gap-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Song title" className="min-w-40 flex-1" />
        <input value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Artist" className="min-w-40 flex-1" />
      </div>
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1 text-xs text-faint">
          <BookOpen className="size-3.5" /> KJs see it even if it's not in their book yet
        </span>
        <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button size="sm" variant="primary" disabled={!title.trim() || !artist.trim()} loading={add.isPending} onClick={() => add.mutate(undefined)}>
          <Plus className="size-4" /> Add
        </Button>
      </div>
    </Card>
  );
}

export function SongsPage() {
  const { data: me } = useMe();
  // On site with a live KJ? Filter to what's in their song book.
  const { data: live } = useMyLive(!!me?.checkin);
  const kj = live?.kj ?? null;
  const [kjOnly, setKjOnly] = useState(true);
  const filterKj = kj && kjOnly ? kj.id : undefined;
  const { data: songs, isLoading } = useMySongs(kj?.id);
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const search = useQuery({ queryKey: ['song-search', dq, filterKj], queryFn: () => unwrap(api.songs.search.$get({ query: { q: dq, ...(filterKj ? { kjId: filterKj } : {}) } })), enabled: dq.length > 1 });
  const shown = (songs ?? []).filter((s) => !filterKj || s.inKjBook !== false);
  const recs = useQuery({ queryKey: ['recs'], queryFn: () => unwrap(api.songs.recommendations.$get()), enabled: !!me?.isPremium });
  const mine = new Set(songs?.map((s) => s.id));
  const inv = [qk.mySongs, ['recs']];

  const add = useAction((songId: string) => unwrap(api.songs.mine[':songId'].$put({ param: { songId } })), { invalidate: inv, success: 'Added to your list 🎶' });
  const remove = useAction((songId: string) => unwrap(api.songs.mine[':songId'].$delete({ param: { songId } })), { invalidate: inv });
  const goTo = useAction((x: { songId: string; on: boolean }) => unwrap(api.songs.mine[':songId']['go-to'].$put({ param: { songId: x.songId }, json: { on: x.on } })), { invalidate: inv });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">
            My <span className="text-gradient">Song List</span>
          </h1>
          <p className="mt-1 text-muted">
            Your go-to songs, ready for any KJ.{' '}
            <Link to="/me" className="text-fg underline decoration-line-strong underline-offset-4">
              Visible to {me?.privacy.songList === 'everyone' ? 'everyone' : me?.privacy.songList === 'friends' ? 'friends' : 'only you'}
            </Link>
          </p>
        </div>
        <Pill tone="violet">{songs?.length ?? 0} songs</Pill>
      </div>

      {kj && live?.venue && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-cyan/30 bg-cyan/5 px-4 py-3 text-sm">
          <Avatar user={kj} size="sm" />
          <span className="min-w-0 flex-1">
            You're at <b>{live.venue.name}</b> with {kj.displayName}. {kjOnly ? 'Showing only songs in their song book.' : 'Showing all songs.'}
          </span>
          <Toggle on={kjOnly} onChange={setKjOnly} label="Only this KJ's songs" />
        </div>
      )}

      <div className="grid gap-8 [&>*]:min-w-0 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <div className="relative">
            <Search className="absolute top-3.5 left-4 size-5 text-faint" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search songs or artists to add…" className="h-12 w-full !rounded-2xl pl-12 text-base" />
            {search.isFetching && <Spinner className="absolute top-3.5 right-4" />}
          </div>
          {dq.length > 1 && (
            <Card className="max-h-80 divide-y divide-line overflow-y-auto">
              {search.data?.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{s.title}</div>
                    <div className="truncate text-xs text-muted">
                      {s.artist} · {s.genre} · {s.decade}
                    </div>
                  </div>
                  {mine.has(s.id) ? (
                    <Pill tone="live">On list</Pill>
                  ) : (
                    <Button size="sm" onClick={() => add.mutate(s.id)}>
                      <Plus className="size-4" /> Add
                    </Button>
                  )}
                </div>
              ))}
              {search.data?.length === 0 && <div className="p-4 text-sm text-muted">{filterKj ? `${kj?.displayName} doesn't have a match. Turn off the KJ filter, or add it below.` : 'No matches. Add it yourself below.'}</div>}
            </Card>
          )}
          <FreeAdd initialTitle={dq} />

          {isLoading ? (
            <Spinner />
          ) : shown.length ? (
            <Card className="divide-y divide-line">
              {shown.map((s) => (
                <div key={s.id} className="group flex items-center gap-3 px-4 py-3">
                  <button onClick={() => goTo.mutate({ songId: s.id, on: !s.isGoTo })} aria-label="Toggle go-to song" title="Go-to song (KJs see these first)">
                    <Star className={cx('size-5 transition', s.isGoTo ? 'fill-gold text-gold' : 'text-faint hover:text-gold')} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{s.title}</div>
                    <div className="truncate text-sm text-muted">{s.artist}</div>
                  </div>
                  <Pill tone="muted" className="hidden sm:inline-flex">
                    {s.genre}
                  </Pill>
                  <button onClick={() => remove.mutate(s.id)} className="text-faint opacity-60 transition group-hover:opacity-100 hover:text-danger" aria-label="Remove">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </Card>
          ) : (
            <EmptyState icon="🎵" title="Your list is empty" body="Search above to add your go-to songs." />
          )}
          {filterKj && (songs?.length ?? 0) > shown.length && <p className="text-xs text-muted">{(songs?.length ?? 0) - shown.length} of your songs aren't in {kj?.displayName}'s book tonight.</p>}
          <p className="text-xs text-faint">⭐ Go-to songs show up first when a KJ looks at you in their booth, so they can add one for you in a tap.</p>
        </div>

        <aside className="space-y-6">
          <SongRoulette pool={songs ?? []} />
          <Section title="Recommended for you" icon={<Sparkles className="size-5 text-gold" />}>
            <PremiumGate feature="Smart song recommendations" blurb="Songs that fit your voice and crowd favorites near you.">
              <Card className="divide-y divide-line">
                {/* Free plan: placeholder rows behind the lock (the API only serves recommendations on Plus). */}
                {!me?.isPremium &&
                  ['w-2/3', 'w-1/2', 'w-3/4'].map((w) => (
                    <div key={w} className="space-y-1.5 px-4 py-3">
                      <div className={`h-3 rounded bg-surface-2 ${w}`} />
                      <div className="h-2.5 w-1/3 rounded bg-surface-2" />
                    </div>
                  ))}
                {recs.data?.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{s.title}</div>
                      <div className="truncate text-xs text-muted">
                        {s.artist} · on {s.popularity} lists
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => add.mutate(s.id)}>
                      <Plus className="size-4" />
                    </Button>
                  </div>
                ))}
              </Card>
            </PremiumGate>
          </Section>
        </aside>
      </div>
    </div>
  );
}
