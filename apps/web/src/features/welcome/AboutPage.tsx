import { DEMO } from '~/lib/demo';
import { Link } from '@tanstack/react-router';
import { motion } from 'motion/react';
import { Award, Bell, CalendarHeart, Check, Disc3, DoorOpen, Map, Megaphone, Mic2, QrCode, Star, Store, Users } from 'lucide-react';
import { Button, cx } from '~/components/ui';

const LOOP = [
  { icon: Map, title: 'Discover', body: 'Singers see every karaoke night within 20 miles, with live KJ Now status and crowd levels.' },
  { icon: QrCode, title: 'Check in', body: 'Walk in and get a check-in prompt, or scan the code by the stage.' },
  { icon: Mic2, title: 'Sing', body: 'Request from your song list or spin Song Roulette. The KJ sees it instantly.' },
  { icon: Award, title: 'Get recognized', body: 'KJs award badges, fellow singers send praise. Reputation follows you from bar to bar.' },
];

const AUDIENCES = [
  {
    icon: Disc3,
    who: 'For KJs',
    color: 'from-violet to-cyan',
    points: ['Go live with "KJ Now" and ping every fan who favorited you', 'See who walked in and what they want to sing', 'Auto Leave pulls no-shows from your rotation', 'Earn venue badges that help you land more gigs', 'Auto-post your nights to Facebook & Instagram'],
  },
  {
    icon: Store,
    who: 'For venues',
    color: 'from-cyan to-live',
    points: ['Post events and drink specials in seconds', 'See who’s going before the night starts', 'Peak Hours insights from real check-ins', 'Curate a gallery of your best nights', 'Premiere Partner: priority on the map'],
  },
  {
    icon: Mic2,
    who: 'For singers',
    color: 'from-pink to-violet',
    points: ['Find tonight’s best night in one glance', 'Keep your go-to songs ready for any KJ', 'Find your friends, or go Ghost', 'Positive-only praise from fellow singers', 'Collect badges and build your rep'],
  },
];

const PRICING = [
  { name: 'Singer Plus', price: '$2.99', per: '/mo', body: 'Smart song recommendations and featured profile boosts.', icon: Star },
  { name: 'KJ Pro', price: '$9', per: '/mo', body: 'Auto-posting to Facebook & Instagram, booking insights.', icon: Megaphone, featured: true },
  { name: 'Premiere Partner', price: '$49', per: '/mo', body: 'Priority listing, gold pin, featured events for venues.', icon: Store },
];

export function AboutPage() {
  return (
    <div className="relative overflow-hidden">
      <div className="absolute top-[-10%] left-1/2 size-[900px] -translate-x-1/2 rounded-full bg-violet/15 blur-[140px]" />
      <div className="relative mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <header className="flex items-center justify-between">
          <Link to="/welcome" className="flex items-center gap-2.5">
            <img src="/icon.svg" alt="" className="size-10" />
            <span className="font-display text-xl font-extrabold">
              Karaoke<span className="text-gradient"> Scene</span>
            </span>
          </Link>
          <Link to="/welcome">
            <Button variant="primary">{DEMO ? 'Try the demo' : 'Get started'}</Button>
          </Link>
        </header>

        <section className="mx-auto mt-20 max-w-3xl text-center">
          <h1 className="text-5xl leading-[0.95] font-extrabold sm:text-7xl">
            The network that fills <span className="text-gradient">karaoke nights.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted">Karaoke Scene connects singers, KJs and venues into one local ecosystem. More singers find your night, the best hosts get recognized, and the whole scene grows.</p>
        </section>

        <section className="mt-24">
          <h2 className="text-center text-sm font-bold tracking-[0.25em] text-faint uppercase">How the loop works</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-4">
            {LOOP.map((s, i) => (
              <motion.div key={s.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} className="relative rounded-3xl border border-line bg-surface/80 p-6">
                <div className="absolute top-5 right-5 font-display text-5xl font-extrabold text-white/5">{i + 1}</div>
                <s.icon className="size-7 text-pink" />
                <div className="mt-4 font-display text-xl font-bold">{s.title}</div>
                <p className="mt-2 text-sm text-muted">{s.body}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="mt-24 grid gap-5 lg:grid-cols-3">
          {AUDIENCES.map((a) => (
            <div key={a.who} className="relative overflow-hidden rounded-3xl border border-line bg-surface/80 p-7">
              <div className={cx('absolute -top-20 -right-20 size-56 rounded-full bg-gradient-to-br opacity-20 blur-3xl', a.color)} />
              <div className={cx('relative grid size-12 place-items-center rounded-2xl bg-gradient-to-br text-white', a.color)}>
                <a.icon className="size-6" />
              </div>
              <h3 className="relative mt-5 text-2xl font-extrabold">{a.who}</h3>
              <ul className="relative mt-4 space-y-2.5">
                {a.points.map((p) => (
                  <li key={p} className="flex gap-2.5 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-live" /> {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <section className="mt-24 grid items-center gap-10 rounded-[2.5rem] border border-line bg-gradient-to-br from-pink/10 via-surface to-cyan/10 p-8 sm:p-12 lg:grid-cols-2">
          <div>
            <h2 className="text-4xl font-extrabold">Grows by the QR card.</h2>
            <p className="mt-4 text-muted">Every singer, KJ and venue gets a digital and printable QR card. Scanning a venue checks you in; scanning a person connects you. Bring new people in and you earn Scene Builder badges and priority status.</p>
            <div className="mt-6 flex flex-wrap gap-3 text-sm">
              {[
                [QrCode, 'Table tents & stage cards'],
                [Users, 'Referral badges'],
                [CalendarHeart, 'Scene meetups & competitions'],
              ].map(([Icon, label]) => {
                const I = Icon as typeof QrCode;
                return (
                  <span key={label as string} className="flex items-center gap-2 rounded-full border border-line bg-surface/70 px-3 py-1.5">
                    <I className="size-4 text-pink" /> {label as string}
                  </span>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              [Bell, 'KJ Now alerts', 'Fans get pinged the moment you go live'],
              [DoorOpen, 'Auto Leave', 'Rotation stays clean, automatically'],
              [Award, 'Trust badges', 'Venues rate KJs, KJs rate singers'],
              [Map, '20-mile focus', 'Local by design'],
            ].map(([Icon, t, b]) => {
              const I = Icon as typeof Bell;
              return (
                <div key={t as string} className="rounded-3xl border border-line bg-ink/50 p-5">
                  <I className="size-6 text-cyan" />
                  <div className="mt-3 font-semibold">{t as string}</div>
                  <div className="mt-1 text-xs text-muted">{b as string}</div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-24">
          <h2 className="text-center text-4xl font-extrabold">Free to join. Pay to stand out.</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {PRICING.map((p) => (
              <div key={p.name} className={cx('rounded-3xl border p-7', p.featured ? 'border-pink/50 bg-pink/5 shadow-glow-pink' : 'border-line bg-surface/80')}>
                <p.icon className="size-6 text-gold" />
                <div className="mt-4 font-semibold">{p.name}</div>
                <div className="mt-2">
                  <span className="font-display text-5xl font-extrabold">{p.price}</span>
                  <span className="text-muted">{p.per}</span>
                </div>
                <p className="mt-3 text-sm text-muted">{p.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="my-24 text-center">
          <h2 className="text-4xl font-extrabold">{DEMO ? 'Ready to see it?' : 'Ready to join?'}</h2>
          <p className="mt-3 text-muted">{DEMO ? 'Jump in as a singer, a KJ or a venue. The demo is loaded with Omaha’s (fictional) scene.' : 'Sign in with Google, Apple or Facebook and find tonight’s karaoke.'}</p>
          <Link to="/welcome">
            <Button variant="primary" size="lg" className="mt-6">
              {DEMO ? 'Open the demo' : 'Get started'}
            </Button>
          </Link>
        </section>
      </div>
    </div>
  );
}
