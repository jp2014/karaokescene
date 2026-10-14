import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence } from 'motion/react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui';
import { EmailStep, RolePicker, VerifyStep, type Role } from '~/features/welcome/steps';
import { homeFor } from '~/lib/session';
import { signInAs, useDemoAccounts } from './api';
import { DebugPanel } from './DebugPanel';

const PERSONA: Record<Role, string> = { singer: 'usr_jess', kj: 'usr_velvetvox', venue: 'usr_neon-mic' };

type Step = { at: 'role' } | { at: 'email'; role: Role } | { at: 'verify'; role: Role; email: string };

/** Local demo sign-in: the real first-run steps, but any code works and you land in that role's seeded persona. */
export function PersonaPicker({ next }: { next?: string }) {
  const { data: accounts } = useDemoAccounts();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>({ at: 'role' });
  const [busy, setBusy] = useState(false);
  const [allOpen, setAllOpen] = useState(false);

  async function finish(role: Role) {
    setBusy(true);
    try {
      const user = await signInAs(PERSONA[role], qc);
      toast.success(`Welcome, ${user.displayName}!`, { description: 'Demo: you’re signed in as the sample account for this role.' });
      if (next && next !== '/') navigate({ href: next });
      else navigate({ to: homeFor(user.role) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-12">
      <AnimatePresence mode="wait">
        {step.at === 'role' && (
          <RolePicker key="role" onPick={(role) => setStep({ at: 'email', role })}>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button variant="ghost" onClick={() => setAllOpen(true)}>
                Browse all {accounts?.length ?? ''} demo accounts
              </Button>
              <span className="text-xs text-faint">Local demo only: seeded personas instead of real accounts.</span>
            </div>
          </RolePicker>
        )}
        {step.at === 'email' && <EmailStep key="email" role={step.role} onBack={() => setStep({ at: 'role' })} onNext={(email) => setStep({ at: 'verify', role: step.role, email })} />}
        {step.at === 'verify' && (
          <VerifyStep
            key="verify"
            email={step.email}
            busy={busy}
            onBack={() => setStep({ at: 'email', role: step.role })}
            onDone={() => finish(step.role)}
            hint={(fill) => (
              <div className="rounded-2xl border border-dashed border-gold/40 bg-gold/5 p-3 text-center text-xs text-gold">
                Demo: no email is sent. Any 6 digits work.{' '}
                <button type="button" className="font-semibold underline" onClick={() => fill('123456')}>
                  Fill in a code
                </button>
              </div>
            )}
          />
        )}
      </AnimatePresence>
      <DebugPanel open={allOpen} onClose={() => setAllOpen(false)} />
    </section>
  );
}
