import { ArrowRight, LockKeyhole } from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui';
import { ROLES, StepCard, type Role } from './steps';

export function PasswordStep({ role, busy, onBack, onSwitch, onSubmit }: {
  role?: Role;
  busy: boolean;
  onBack: () => void;
  onSwitch: () => void;
  onSubmit: (email: string, password: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [legit, setLegit] = useState(false);
  const signup = !!role;
  const label = ROLES.find((r) => r.role === role)?.label.toLowerCase();
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && password.length > 0
    && (!signup || (password.length >= 8 && password === confirm)) && (role !== 'venue' || legit);
  return (
    <StepCard onBack={onBack} title={signup ? `Create ${label === 'kj' ? 'KJ' : label} account` : 'Sign in'} icon={<LockKeyhole className="size-5" />}>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (valid && !busy) onSubmit(email.trim(), password); }}>
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold tracking-wide text-muted uppercase">{role === 'venue' ? 'Business email' : 'Email'}</span>
          <input type="email" autoComplete="email" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="w-full" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold tracking-wide text-muted uppercase">Password</span>
          <input type="password" aria-label="Password" autoComplete={signup ? 'new-password' : 'current-password'} required minLength={signup ? 8 : undefined} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full" />
          {signup && <span className="text-xs text-faint">Use at least 8 characters.</span>}
        </label>
        {signup && (
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold tracking-wide text-muted uppercase">Confirm password</span>
            <input type="password" aria-label="Confirm password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full" />
            {confirm && password !== confirm && <span className="text-xs text-danger">Passwords don’t match.</span>}
          </label>
        )}
        {role === 'venue' && (
          <label className="flex items-start gap-3 rounded-2xl border border-gold/30 bg-gold/5 p-4 text-sm">
            <input type="checkbox" checked={legit} onChange={(e) => setLegit(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-[var(--color-gold)]" />
            <span><b className="text-gold">I am the owner or an authorized operator of this business.</b>{' '}
              <span className="text-muted">Only claim a venue you’re authorized to manage. Accounts that impersonate a business are removed.</span>
            </span>
          </label>
        )}
        <Button variant="primary" className="w-full" type="submit" loading={busy} disabled={!valid || busy}>
          {signup ? 'Create account' : 'Sign in'} <ArrowRight className="size-4" />
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted">
        {signup ? 'Already registered? ' : 'New here? '}
        <button disabled={busy} onClick={onSwitch} className="font-semibold text-fg hover:underline">{signup ? 'Sign in instead' : 'Create an account'}</button>
      </p>
    </StepCard>
  );
}
