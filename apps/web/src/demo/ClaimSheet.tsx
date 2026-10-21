import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Sheet } from '~/components/ui';
import { useAction } from '~/lib/queries';
import { demoClaim } from './api';

/** Demo: claim a KJ-listed venue without verification and continue as its account. */
export function ClaimSheet({ venue, open, onClose }: { venue: { id: string; name: string }; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const claim = useAction(() => demoClaim(venue.id, qc), {
    success: (r) => `You now manage ${r.displayName} 🎉`,
    onSuccess: () => navigate({ to: '/me' }),
  });
  return (
    <Sheet open={open} onClose={onClose} title={`Claim ${venue.name}`}>
      <div className="space-y-4 text-sm">
        <p className="text-muted">Claiming lets you add photos, hours, specials and coupons, and choose your KJs. The KJ's nights stay on the schedule.</p>
        <div className="rounded-2xl border border-dashed border-gold/40 bg-gold/5 p-3 text-xs text-gold">Demo: verification is skipped. Claiming signs you in as this venue's account.</div>
        <Button variant="primary" className="w-full" loading={claim.isPending} onClick={() => claim.mutate(undefined)}>
          I'm the owner · claim {venue.name}
        </Button>
      </div>
    </Sheet>
  );
}
