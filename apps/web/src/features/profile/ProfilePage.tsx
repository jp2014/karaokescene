import { Link, useParams } from '@tanstack/react-router';
import { Award, Ban, CalendarHeart, Disc3, Lock, MapPin, MessageCircleHeart, Mic2, MoreHorizontal, QrCode, Sparkles, Star, UserCheck, UserPlus, Clock } from 'lucide-react';
import { useState } from 'react';
import { Avatar, ROLE_LABEL } from '~/components/Avatar';
import { BadgeGrid } from '~/components/Badge';
import { QrCard } from '~/components/QrCard';
import { Button, Card, cx, EmptyState, LiveDot, PageLoader, Pill, Section, Sheet } from '~/components/ui';
import { VenueArt } from '~/components/VenueArt';
import { api, unwrap } from '~/lib/api';
import { ago, duration, serverNow } from '~/lib/format';
import { qk, useAction, useMe, useProfile, type Profile } from '~/lib/queries';
import { AwardBadgeSheet, PraiseSheet } from './ProfileActions';
import { PraiseList } from '~/features/feed/PraiseList';

export function ProfilePage() {
  const { handle } = useParams({ from: '/u/$handle' });
  const { data: p, isLoading, error } = useProfile(handle);
  if (isLoading) return <PageLoader />;
  if (error || !p) return <EmptyState icon="🔇" title="Profile not available" body="It may be private, or this person isn't on Karaoke Scene yet." />;
  return <ProfileView p={p} />;
}

export function ProfileView({ p }: { p: Profile }) {
  const { data: me } = useMe();
  const [praise, setPraise] = useState(false);
  const [award, setAward] = useState(false);
  const [qr, setQr] = useState(false);
  const [more, setMore] = useState(false);
  const inv = [qk.profile(p.handle), qk.circle];
  const rel = p.relationship;

  const friend = useAction(
    async (action: 'add' | 'accept' | 'remove') =>
      action === 'remove'
        ? unwrap(api.social.friends[':userId'].$delete({ param: { userId: p.id } }))
        : action === 'accept'
          ? unwrap(api.social.friends[':userId'].respond.$post({ param: { userId: p.id }, json: { accept: true } }))
          : unwrap(api.social.friends[':userId'].$post({ param: { userId: p.id } })),
    { invalidate: inv, success: (_, a) => ({ add: 'Friend request sent', accept: "You're now friends 🤝", remove: 'Removed from friends' })[a] },
  );
  const fav = useAction((on: boolean) => unwrap(api.social.favorites[':type'][':id'].$put({ param: { type: 'user', id: p.id }, json: { on } })), { invalidate: inv, success: (r) => (r.favorited ? 'Added to favorites ⭐' : 'Removed from favorites') });
  const block = useAction((on: boolean) => unwrap(api.social.blocks[':userId'].$put({ param: { userId: p.id }, json: { on } })), { invalidate: inv, success: (_, on) => (on ? 'Blocked. They can no longer see you.' : 'Unblocked'), onSuccess: () => setMore(false) });

  const canPraise = me?.role === 'singer' && p.role === 'singer' && !rel.isSelf && !rel.blocked;
  const canAward = !rel.isSelf && ((me?.role === 'kj' && p.role === 'singer') || (me?.role === 'venue' && p.role === 'kj'));
  const details = [
    p.details.hometown && { icon: MapPin, label: p.details.hometown },
    p.details.favoriteNight && { icon: CalendarHeart, label: `${p.details.favoriteNight}s` },
    p.details.yearsSinging != null && { icon: Mic2, label: `${p.details.yearsSinging} yrs ${p.role === 'kj' ? 'hosting' : 'singing'}` },
    p.details.ageRange && { icon: Clock, label: p.details.ageRange },
  ].filter(Boolean) as { icon: typeof MapPin; label: string }[];
  const totalBadges = p.badges.reduce((n, b) => n + b.count, 0);

  return (
    <div className="space-y-8">
      <Card className="relative overflow-hidden p-6 sm:p-8">
        <div className="absolute inset-x-0 top-0 h-32 opacity-60" style={{ background: `linear-gradient(120deg, hsl(${p.avatarHue} 90% 50% / 0.5), transparent 70%)` }} />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end">
          <Avatar user={p} size="xl" className="ring-4 ring-night" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={p.role === 'singer' ? 'pink' : p.role === 'kj' ? 'cyan' : 'gold'}>{ROLE_LABEL[p.role]}</Pill>
              {p.details.isPro && <Pill tone="gold">Pro</Pill>}
              {rel.friend === 'friends' && <Pill tone="live">Friends</Pill>}
              {rel.isSelf && p.ghostMode && <Pill tone="violet">👻 Ghost Mode on</Pill>}
            </div>
            <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">{p.displayName}</h1>
            <div className="text-sm text-muted">@{p.handle}</div>
            {p.bio && <p className="mt-3 max-w-xl">{p.bio}</p>}
            {details.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                {details.map((d) => (
                  <span key={d.label} className="flex items-center gap-1.5">
                    <d.icon className="size-4" /> {d.label}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            {rel.isSelf ? (
              <>
                <Link to="/me">
                  <Button>Edit profile</Button>
                </Link>
                <Button onClick={() => setQr(true)}>
                  <QrCode className="size-4" /> My QR
                </Button>
              </>
            ) : (
              me && (
                <>
                  {rel.friend === 'none' && !rel.blocked && (
                    <Button variant="primary" onClick={() => friend.mutate('add')} loading={friend.isPending}>
                      <UserPlus className="size-4" /> Add friend
                    </Button>
                  )}
                  {rel.friend === 'incoming' && (
                    <Button variant="primary" onClick={() => friend.mutate('accept')} loading={friend.isPending}>
                      <UserCheck className="size-4" /> Accept request
                    </Button>
                  )}
                  {rel.friend === 'requested' && <Button disabled>Request sent</Button>}
                  {rel.friend === 'friends' && (
                    <Button onClick={() => friend.mutate('remove')}>
                      <UserCheck className="size-4 text-live" /> Friends
                    </Button>
                  )}
                  {canPraise && (
                    <Button onClick={() => setPraise(true)}>
                      <MessageCircleHeart className="size-4 text-pink" /> Praise
                    </Button>
                  )}
                  {canAward && (
                    <Button onClick={() => setAward(true)} className="border-gold/40 text-gold">
                      <Award className="size-4" /> Award badge
                    </Button>
                  )}
                  {p.role !== 'venue' && (
                    <Button size="icon" onClick={() => fav.mutate(!rel.favorited)} aria-label="Favorite">
                      <Star className={cx('size-4', rel.favorited && 'fill-gold text-gold')} />
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => setMore(true)} aria-label="More">
                    <MoreHorizontal className="size-5" />
                  </Button>
                </>
              )
            )}
          </div>
        </div>

        <div className="relative mt-6 grid grid-cols-3 gap-3 border-t border-line pt-5 text-center">
          <div>
            <div className="font-display text-2xl font-bold">{totalBadges}</div>
            <div className="text-xs text-muted">badges earned</div>
          </div>
          <div>
            <div className="font-display text-2xl font-bold">{p.praise.length}</div>
            <div className="text-xs text-muted">recent praise</div>
          </div>
          <div>
            <div className="font-display text-2xl font-bold">{p.scansReferred}</div>
            <div className="text-xs text-muted">brought to the scene</div>
          </div>
        </div>
      </Card>

      {(p.checkedInAt || p.kjNow) && (
        <Link to="/venues/$slug" params={{ slug: (p.kjNow ?? p.checkedInAt)!.slug }} className="flex items-center gap-3 rounded-2xl border border-live/30 bg-live/10 p-4">
          <LiveDot />
          <span className="flex-1 text-sm">
            {p.kjNow ? <>Hosting <b>{p.kjNow.name}</b> right now</> : <>At <b>{p.checkedInAt!.name}</b></>} · {duration(serverNow() - (p.kjNow ?? p.checkedInAt)!.since)}
          </span>
          <span className="text-sm font-semibold text-live">View →</span>
        </Link>
      )}

      <div className="grid gap-8 [&>*]:min-w-0 lg:grid-cols-[1fr_360px]">
        <div className="space-y-8">
          <Section title="Badges" icon={<Award className="size-5 text-gold" />}>
            {p.badges.length ? <BadgeGrid badges={p.badges} /> : <EmptyState icon="🏅" title="No badges yet" body={p.role === 'kj' ? 'Venues award KJ badges.' : 'KJs award singer badges after a great night.'} />}
            {p.recentBadges.length > 0 && (
              <div className="space-y-1 pt-1">
                {p.recentBadges.slice(0, 4).map((b) => (
                  <div key={b.id} className="flex items-center gap-2 text-xs text-muted">
                    <Sparkles className="size-3.5 text-gold" /> <b className="text-fg">{b.badge.label}</b> from {b.giver?.displayName ?? 'Karaoke Scene'} · {ago(b.createdAt)}
                  </div>
                ))}
              </div>
            )}
          </Section>
          {p.role === 'singer' && (
            <Section title="Praise wall" icon={<MessageCircleHeart className="size-5 text-pink" />}>
              {p.praise.length ? <PraiseList items={p.praise} hideTo /> : <EmptyState icon="💖" title="No praise yet" body="Praise comes from fellow singers after a great performance." />}
            </Section>
          )}
        </div>
        <aside className="space-y-8">
          {p.role === 'singer' && (
            <Section title="Song list" icon={<Mic2 className="size-5 text-violet" />}>
              {p.songList ? (
                <Card className="divide-y divide-line">
                  {p.songList.slice(0, 12).map((s) => (
                    <div key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                      {s.isGoTo ? <Star className="size-4 shrink-0 fill-gold text-gold" /> : <span className="size-4 shrink-0" />}
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{s.title}</div>
                        <div className="truncate text-xs text-muted">{s.artist}</div>
                      </div>
                    </div>
                  ))}
                  {!p.songList.length && <div className="p-4 text-sm text-muted">No songs yet.</div>}
                </Card>
              ) : (
                <Card className="flex items-center gap-3 p-4 text-sm text-muted">
                  <Lock className="size-4" /> {p.displayName.split(' ')[0]} only shares their song list with friends.
                </Card>
              )}
            </Section>
          )}
          {p.role === 'kj' && (
            <>
              <Section title="Hosts at" icon={<Disc3 className="size-5 text-cyan" />}>
                <div className="space-y-2">
                  {p.kjVenues.map((v) => (
                    <Link key={v.id} to="/venues/$slug" params={{ slug: v.slug }} className="flex items-center gap-3 rounded-2xl border border-line bg-surface/70 p-2 hover:border-line-strong">
                      <VenueArt name={v.name} hue={v.hue} className="size-11 rounded-xl" />
                      <div>
                        <div className="text-sm font-semibold">{v.name}</div>
                        <div className="text-xs text-muted">{v.neighborhood}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </Section>
              {p.songbook && (
                <Section title="Song book">
                  <Card className="p-4">
                    <div className="font-display text-3xl font-bold">{p.songbook.total.toLocaleString()}</div>
                    <div className="text-xs text-muted">songs available</div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {p.songbook.genres.slice(0, 8).map((g) => (
                        <Pill key={g.genre} tone="muted">
                          {g.genre} {g.count}
                        </Pill>
                      ))}
                    </div>
                  </Card>
                </Section>
              )}
            </>
          )}
          {p.role === 'venue' && p.managedVenue && (
            <Link to="/venues/$slug" params={{ slug: p.managedVenue.slug }}>
              <Card className="overflow-hidden">
                <VenueArt name={p.managedVenue.name} hue={p.managedVenue.hue} className="h-32" />
                <div className="p-4 font-semibold">Visit {p.managedVenue.name} →</div>
              </Card>
            </Link>
          )}
        </aside>
      </div>

      <PraiseSheet open={praise} onClose={() => setPraise(false)} to={p} />
      <AwardBadgeSheet open={award} onClose={() => setAward(false)} to={p} />
      <Sheet open={qr} onClose={() => setQr(false)} title="Your QR card">
        <QrCard kind="u" keyValue={p.handle} title={p.displayName} subtitle={`${ROLE_LABEL[p.role]} on Karaoke Scene`} user={p} hue={p.avatarHue} />
      </Sheet>
      <Sheet open={more} onClose={() => setMore(false)} title={p.displayName}>
        <div className="space-y-2">
          {rel.friend === 'friends' && (
            <Button className="w-full" onClick={() => friend.mutate('remove')}>
              Remove friend
            </Button>
          )}
          <Button variant="danger" className="w-full" onClick={() => block.mutate(!rel.blocked)} loading={block.isPending}>
            <Ban className="size-4" /> {rel.blocked ? 'Unblock' : 'Block'} {p.displayName.split(' ')[0]}
          </Button>
          <p className="pt-2 text-xs text-faint">Blocked people can't see your profile, check-ins or praise, and you won't see theirs.</p>
        </div>
      </Sheet>
    </div>
  );
}
