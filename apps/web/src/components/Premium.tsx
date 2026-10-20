import { Check, Crown, Lock } from 'lucide-react';
import { Suspense, useState, type ReactNode } from 'react';
import { DemoPlanSwitch } from '~/lib/demo';
import { useMe } from '~/lib/queries';
import { Button, cx, Pill, Sheet } from './ui';

type Role = 'singer' | 'kj' | 'venue';

/** The paid plan for each account type, and what it unlocks. */
export const PLANS: Record<Role, { name: string; price: string; features: string[] }> = {
  singer: { name: 'Singer Plus', price: '$2.99/mo', features: ['Smart song recommendations', 'Venue coupons from your regular spots'] },
  kj: { name: 'KJ Pro', price: '$9/mo', features: ['Auto social posting to Facebook & Instagram', 'Auto Leave alerts when singers walk out', 'Message Blast to your singers'] },
  venue: { name: 'Venue Premier', price: '$49/mo', features: ['Premier listing: priority on the map and a gold pin', "Show who's going on your page", 'Peak Hours insights', 'Drink Special Auto Post'] },
};

export function PremiumPill({ role }: { role: Role }) {
  return (
    <Pill tone="gold">
      <Crown className="size-3" /> {PLANS[role].name}
    </Pill>
  );
}

/** Upgrade sheet. Payments aren't live yet: production says "coming soon"; the local demo can unlock (and re-lock) any plan. */
export function UpgradeSheet({ open, onClose, feature }: { open: boolean; onClose: () => void; feature?: string }) {
  const { data: me } = useMe();
  if (!me) return null;
  const plan = PLANS[me.role];
  return (
    <Sheet open={open} onClose={onClose} title={<span className="flex items-center gap-2"><Crown className="size-5 text-gold" /> {plan.name}</span>}>
      {feature && <p className="mb-3 text-sm text-muted"><b className="text-fg">{feature}</b> is part of {plan.name}.</p>}
      <div className="rounded-3xl border border-gold/30 bg-gold/5 p-5">
        <div className="font-display text-3xl font-extrabold text-gold">{plan.price}</div>
        <ul className="mt-3 space-y-2 text-sm">
          {plan.features.map((f) => (
            <li key={f} className="flex items-start gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-gold" /> {f}
            </li>
          ))}
        </ul>
      </div>
      {DemoPlanSwitch ? (
        <Suspense>
          <DemoPlanSwitch onDone={onClose} />
        </Suspense>
      ) : (
        <div className="mt-4 text-center">
          <Pill tone="gold">Coming soon</Pill>
          <p className="mt-2 text-xs text-faint">Paid plans aren't available yet. We'll let you know when they are.</p>
        </div>
      )}
    </Sheet>
  );
}

/**
 * Wrap a premium feature. Free accounts see it blurred behind a lock (or just the lock
 * card when there's nothing to tease) with a way into the upgrade sheet.
 */
export function PremiumGate({ feature, blurb, children, teaser = true, className }: { feature: string; blurb?: string; children: ReactNode; teaser?: boolean; className?: string }) {
  const { data: me } = useMe();
  const [open, setOpen] = useState(false);
  if (!me || me.isPremium) return <>{children}</>;
  const lock = (
    <div className="glass mx-4 max-w-sm rounded-3xl border border-gold/30 p-5 text-center">
      <Lock className="mx-auto size-6 text-gold" />
      <div className="mt-2 font-semibold">{feature}</div>
      {blurb && <p className="mt-1 text-sm text-muted">{blurb}</p>}
      <Button variant="primary" size="sm" className="mt-3" onClick={() => setOpen(true)}>
        Unlock with {PLANS[me.role].name}
      </Button>
    </div>
  );
  return (
    <div className={cx('relative', className)}>
      {teaser ? (
        <>
          <div aria-hidden className="pointer-events-none blur-[3px] select-none">{children}</div>
          <div className="absolute inset-0 grid place-items-center">{lock}</div>
        </>
      ) : (
        <div className="grid place-items-center rounded-3xl border border-dashed border-gold/30 py-6">{lock}</div>
      )}
      <UpgradeSheet open={open} onClose={() => setOpen(false)} feature={feature} />
    </div>
  );
}
