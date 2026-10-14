import { useParams } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { PageLoader } from '~/components/ui';
import { useQrScan } from './useQrScan';

/** Where a phone camera lands after scanning a printed QR card or a coupon. */
export function QrLandingPage() {
  const { kind, key } = useParams({ from: '/q/$kind/$key' });
  const scan = useQrScan();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    scan({ kind: kind === 'v' ? 'v' : kind === 'c' ? 'c' : 'u', key });
  }, [kind, key]);
  return <PageLoader />;
}
