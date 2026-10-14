import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, unwrap } from '~/lib/api';

export type QrCode = { kind: 'u' | 'v' | 'c'; key: string };

/** Parse a Karaoke Scene QR payload (a /q/u/<handle>, /q/v/<slug> or /q/c/<coupon> URL). */
export function parseQr(text: string): QrCode | null {
  const m = text.match(/\/q\/(u|v|c)\/([\w-]+)/);
  return m ? { kind: m[1] as QrCode['kind'], key: m[2] } : null;
}

export function useQrScan() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  return async (code: QrCode) => {
    try {
      const r = await unwrap(api.qr.scan.$post({ json: code }));
      await qc.invalidateQueries();
      if (r.type === 'venue') {
        toast.success(`Checked in at ${r.name} 🎤`, { description: 'Scanned the venue code' });
        navigate({ to: '/live' });
      } else if (r.type === 'coupon') {
        if (r.coupon) toast.success(`Redeemed: ${r.coupon.title} ✅`, { description: `${r.coupon.singer?.displayName ?? 'Singer'} · one-time coupon, now used` });
        else toast('That’s a venue coupon', { description: 'Only the venue that issued it can redeem it.' });
      } else {
        toast.success(`Scanned ${r.user.displayName}'s card`, { description: 'Say hi, add them as a friend, or send praise.' });
        navigate({ to: '/u/$handle', params: { handle: r.handle } });
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
}
