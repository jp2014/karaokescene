import { Link, useSearch } from '@tanstack/react-router';
import { motion } from 'motion/react';
import { Suspense } from 'react';
import { DemoPersonas } from '~/lib/demo';
import { RealSignIn } from './RealSignIn';

export function WelcomePage() {
  const { next } = useSearch({ from: '/welcome' });

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <FloatingNotes />
      <div className="relative mx-auto flex max-w-6xl flex-col px-5 py-8 sm:px-8 lg:py-14">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/icon.svg" alt="" className="size-10" />
            <span className="font-display text-xl font-extrabold">
              Karaoke<span className="text-gradient"> Scene</span>
            </span>
          </div>
          <Link to="/about" className="text-sm font-medium text-muted hover:text-fg">
            For venues & KJs →
          </Link>
        </header>

        <section className="mt-14 max-w-3xl lg:mt-20">
          <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 px-3 py-1 text-xs font-semibold text-muted">
            <span className="size-1.5 rounded-full bg-live" /> Now live in Omaha · Council Bluffs · Lincoln
          </motion.p>
          <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="text-5xl leading-[0.95] font-extrabold sm:text-7xl">
            Your karaoke scene, <span className="text-gradient animate-shimmer">all in one place.</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-5 max-w-xl text-lg text-muted">
            Find who’s singing tonight, see when the KJ is on-site, check in with a tap, and build a reputation that follows you from bar to bar.
          </motion.p>
        </section>

        {DemoPersonas ? (
          <Suspense>
            <DemoPersonas next={next} />
          </Suspense>
        ) : (
          <RealSignIn next={next} />
        )}
      </div>
    </div>
  );
}

function FloatingNotes() {
  const notes = ['🎤', '🎶', '✨', '🎵', '🪩', '🎸'];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="absolute top-[-20%] right-[-10%] size-[60vw] max-w-[700px] rounded-full bg-violet/20 blur-[120px]" />
      <div className="absolute bottom-[-20%] left-[-10%] size-[50vw] max-w-[600px] rounded-full bg-pink/15 blur-[120px]" />
      {notes.map((n, i) => (
        <span key={i} className="absolute animate-float text-3xl opacity-30 sm:text-5xl" style={{ top: `${12 + ((i * 37) % 70)}%`, right: `${4 + ((i * 23) % 40)}%`, animationDelay: `${i * 0.8}s` }}>
          {n}
        </span>
      ))}
    </div>
  );
}
