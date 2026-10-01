import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, unwrap } from '~/lib/api';

/** Parse a Karaoke Scene QR payload (a /q/u/<handle> or /q/v/<slug> URL). */
export function parseQr(text: string): { kind: 'u' | 'v'; key: string } | null {
  const m = text.match(/\/q\/(u|v)\/([\w-]+)/);
  return m ? { kind: m[1] as 'u' | 'v', key: m[2] } : null;
}

export function useQrScan() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  return async (code: { kind: 'u' | 'v'; key: string }) => {
    try {
      const r = await unwrap(api.qr.scan.$post({ json: code }));
      await qc.invalidateQueries();
      if (r.type === 'venue') {
        toast.success(`Checked in at ${r.name} 🎤`, { description: 'Scanned the venue code' });
        navigate({ to: '/live' });
      } else {
        toast.success(`Scanned ${r.user.displayName}'s card`, { description: 'Say hi, add them as a friend, or send praise.' });
        navigate({ to: '/u/$handle', params: { handle: r.handle } });
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
}
