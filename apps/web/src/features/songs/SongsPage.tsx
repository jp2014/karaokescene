import { useQuery } from '@tanstack/react-query';
import { demoUpgrade } from '~/lib/demo';
import { Link } from '@tanstack/react-router';
import { Lock, Plus, Search, Sparkles, Star, Trash2 } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { Button, Card, cx, EmptyState, Pill, Section, Spinner } from '~/components/ui';
import { api, unwrap } from '~/lib/api';
import { qk, useAction, useMe, useMySongs } from '~/lib/queries';
import { SongRoulette } from './SongRoulette';

export function SongsPage() {
  const { data: me } = useMe();
  const { data: songs, isLoading } = useMySongs();
  const [q, setQ] = useState('');
  const dq = useDeferredValue(q);
  const search = useQuery({ queryKey: ['song-search', dq], queryFn: () => unwrap(api.songs.search.$get({ query: { q: dq } })), enabled: dq.length > 1 });
  const recs = useQuery({ queryKey: ['recs'], queryFn: () => unwrap(api.songs.recommendations.$get()) });
  const mine = new Set(songs?.map((s) => s.id));
  const inv = [qk.mySongs, ['recs']];

  const add = useAction((songId: string) => unwrap(api.songs.mine[':songId'].$put({ param: { songId } })), { invalidate: inv, success: 'Added to your list 🎶' });
  const remove = useAction((songId: string) => unwrap(api.songs.mine[':songId'].$delete({ param: { songId } })), { invalidate: inv });
  const goTo = useAction((x: { songId: string; on: boolean }) => unwrap(api.songs.mine[':songId']['go-to'].$put({ param: { songId: x.songId }, json: { on: x.on } })), { invalidate: inv });
  const upgrade = useAction(() => demoUpgrade!(), { invalidate: [qk.me, ['recs']], success: 'Welcome to Karaoke Scene Plus ✨' });

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
              {search.data?.length === 0 && <div className="p-4 text-sm text-muted">No matches. KJs can add songs by importing their songbook.</div>}
            </Card>
          )}

          {isLoading ? (
            <Spinner />
          ) : songs?.length ? (
            <Card className="divide-y divide-line">
              {songs.map((s) => (
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
          <p className="text-xs text-faint">⭐ Go-to songs show up first when a KJ looks at you in their booth, so they can pull you into the rotation.</p>
        </div>

        <aside className="space-y-6">
          <SongRoulette pool={songs ?? []} />
          <Section title="Recommended for you" icon={<Sparkles className="size-5 text-gold" />}>
            <div className="relative">
              <Card className={cx('divide-y divide-line', !me?.isPremium && 'pointer-events-none blur-[3px] select-none')}>
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
              {!me?.isPremium && (
                <div className="absolute inset-0 grid place-items-center">
                  <div className="glass mx-4 rounded-3xl border border-gold/30 p-5 text-center">
                    <Lock className="mx-auto size-6 text-gold" />
                    <div className="mt-2 font-semibold">Smart recommendations</div>
                    <p className="mt-1 text-sm text-muted">Songs that fit your voice and crowd favorites near you.</p>
                    {demoUpgrade ? (
                      <Button variant="primary" size="sm" className="mt-3" loading={upgrade.isPending} onClick={() => upgrade.mutate(undefined)}>
                        Unlock with Plus · $2.99/mo
                      </Button>
                    ) : (
                      <Pill tone="gold" className="mt-3">Plus is coming soon</Pill>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Section>
        </aside>
      </div>
    </div>
  );
}
