import { Sparkles } from 'lucide-react';
import { PLANS } from '~/components/Premium';
import { Button } from '~/components/ui';
import { qk, useAction, useMe } from '~/lib/queries';
import { demoUpgrade } from './api';

/** Demo stand-in for checkout: switch the viewer's plan on and off freely. */
export function PlanSwitch({ onDone }: { onDone: () => void }) {
  const { data: me } = useMe();
  const set = useAction((on: boolean) => demoUpgrade(on), {
    invalidate: [qk.me, qk.booth, ['venue'], ['venues'], ['recs']],
    success: (_, on) => (on ? `${me ? PLANS[me.role].name : 'Premium'} unlocked for this demo ✨` : 'Back on the free plan'),
    onSuccess: onDone,
  });
  if (!me) return null;
  return (
    <>
      <p className="mt-4 text-xs text-faint">Payments are coming soon. For this demo you can switch the plan on and off freely.</p>
      {me.isPremium ? (
        <Button className="mt-3 w-full" loading={set.isPending} onClick={() => set.mutate(false)}>
          Switch back to free (demo)
        </Button>
      ) : (
        <Button variant="primary" className="mt-3 w-full" loading={set.isPending} onClick={() => set.mutate(true)}>
          <Sparkles className="size-4" /> Unlock for this demo
        </Button>
      )}
    </>
  );
}
