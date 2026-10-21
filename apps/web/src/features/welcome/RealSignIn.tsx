import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api, unwrap } from '~/lib/api';
import { auth, supabase } from '~/lib/auth';
import { qk, sessionQuery } from '~/lib/queries';
import { homeFor } from '~/lib/session';
import { returnPath } from '~/lib/return-path';
import { RolePicker, type Role } from './steps';
import { PasswordStep } from './PasswordStep';

type Step = { at: 'role' } | { at: 'credentials'; role?: Role } | { at: 'finish' };

// Module-level so a remount mid-sign-in doesn't start a second, overlapping pass.
let finishing = false;

/**
 * Real sign-in (Supabase Auth): pick a role, then create an email/password account. The first
 * sign-in creates the profile with that role; returning users just sign in.
 */
export function RealSignIn({ next }: { next?: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>({ at: 'role' });
  const [busy, setBusy] = useState(false);

  async function enter(role: Role) {
    const path = returnPath(next);
    if (path && path !== '/') navigate({ href: path });
    else navigate({ to: homeFor(role) });
  }

  /** After any successful sign-in: go in, or create the profile first. */
  async function afterSignIn(role?: Role, displayName?: string) {
    if (finishing) return;
    finishing = true;
    setBusy(true);
    try {
      // Nothing cached from before this sign-in (another account, or signed out) carries over.
      qc.clear();
      const session = await qc.fetchQuery({ ...sessionQuery, staleTime: 0 });
      if (session.status === 'ready') return await enter(session.me.role);
      if (session.status === 'signed-out') throw new Error('Sign-in didn’t go through. Please try again.');
      if (!role) return setStep({ at: 'finish' });
      const me = await unwrap(api.profiles.onboard.$post({ json: { role, displayName } }));
      // Ready now: seed the session so the route guard lets them straight in.
      qc.setQueryData(qk.session, { status: 'ready', email: session.email, me });
      toast.success(`Welcome to Karaoke Scene, ${me.displayName}!`);
      return await enter(me.role);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      finishing = false;
      setBusy(false);
    }
  }

  // Reopened mid-onboarding: an authenticated user still needs to choose a role.
  useEffect(() => {
    if (auth.signedIn()) void afterSignIn();
  }, []);

  async function submit(role: Role | undefined, email: string, password: string, displayName?: string) {
    if (busy || finishing) return;
    setBusy(true);
    try {
      if (role) await auth.signUp(email, password, displayName);
      else await auth.signIn(email, password);
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
      return;
    }
    await afterSignIn(role, displayName);
  }

  if (!supabase) return <p className="mt-12 text-sm text-muted">Sign-in isn’t configured for this build.</p>;

  return (
    <section className="mt-12">
      <AnimatePresence mode="wait">
        {step.at === 'role' && (
          <RolePicker key="role" onPick={(role) => setStep({ at: 'credentials', role })}>
            <p className="mt-6 text-sm text-muted">
              Already on Karaoke Scene?{' '}
              <button className="font-semibold text-fg underline-offset-4 hover:underline" onClick={() => setStep({ at: 'credentials' })}>
                Sign in
              </button>
            </p>
          </RolePicker>
        )}
        {step.at === 'finish' && (
          <motion.div key="finish" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <p className="mb-4 text-muted">You’re signed in. One more thing: how will you use Karaoke Scene?</p>
            <RolePicker onPick={(role) => afterSignIn(role)} />
          </motion.div>
        )}
        {step.at === 'credentials' && (
          <PasswordStep
            key={step.role ?? 'signin'}
            role={step.role}
            busy={busy}
            onBack={() => setStep({ at: 'role' })}
            onSwitch={() => setStep(step.role ? { at: 'credentials' } : { at: 'role' })}
            onSubmit={(email, password, displayName) => submit(step.role, email, password, displayName)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}
