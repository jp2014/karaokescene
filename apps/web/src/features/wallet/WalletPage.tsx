import { Link } from '@tanstack/react-router';
import { QRCodeSVG } from 'qrcode.react';
import { Ticket } from 'lucide-react';
import { useState } from 'react';
import { qrUrl } from '~/components/QrCard';
import { Card, cx, EmptyState, PageLoader, Pill, Section, Sheet } from '~/components/ui';
import { VenueArt } from '~/components/VenueArt';
import { dateLabel } from '~/lib/format';
import { useWallet, type Coupon } from '~/lib/queries';

/** My Wallet: coupons venues have given you. Each one is a one-time QR the venue scans. */
export function WalletPage() {
  const { data, isLoading } = useWallet();
  const [open, setOpen] = useState<Coupon | null>(null);
  if (isLoading || !data) return <PageLoader />;
  const active = data.filter((c) => c.status === 'active');
  const past = data.filter((c) => c.status !== 'active');
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold">
          My <span className="text-gradient">Wallet</span>
        </h1>
        <p className="mt-1 text-muted">Coupons from your venues. Show the QR at the bar; the venue scans it once and it's used.</p>
      </div>
      {active.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {active.map((c) => (
            <CouponCard key={c.id} c={c} onOpen={() => setOpen(c)} />
          ))}
        </div>
      ) : (
        <EmptyState icon={<Ticket />} title="No coupons yet" body="Venues reward their singers with coupons. Becoming a Regular (5 nights checked in) is a great way to earn them." />
      )}
      {past.length > 0 && (
        <Section title="Used & expired">
          <div className="grid gap-3 sm:grid-cols-2">
            {past.map((c) => (
              <CouponCard key={c.id} c={c} />
            ))}
          </div>
        </Section>
      )}
      <Sheet open={!!open} onClose={() => setOpen(null)} title={open?.venue.name}>
        {open && (
          <div className="text-center">
            <div className="font-display text-2xl font-bold">{open.title}</div>
            {open.details && <p className="mt-1 text-sm text-muted">{open.details}</p>}
            <div className="mx-auto mt-5 w-fit rounded-3xl bg-white p-5">
              <QRCodeSVG value={qrUrl('c', open.code)} size={220} level="M" />
            </div>
            <div className="mt-3 font-mono text-lg tracking-[0.3em]">{open.code}</div>
            <p className="mt-3 text-xs text-muted">One-time use · expires {dateLabel(open.expiresAt)}. Only {open.venue.name} can redeem it.</p>
            <p className="mt-2 text-xs text-faint">Demo: sign in as the venue and use Scan & Share → Redeem a coupon.</p>
          </div>
        )}
      </Sheet>
    </div>
  );
}

function CouponCard({ c, onOpen }: { c: Coupon; onOpen?: () => void }) {
  const body = (
    <Card className={cx('relative flex overflow-hidden text-left transition', onOpen ? 'hover:border-gold/50' : 'opacity-60')}>
      <VenueArt name={c.venue.name} hue={c.venue.hue} photoUrl={c.venue.photoUrl} className="w-20 shrink-0" />
      <div className="min-w-0 flex-1 border-l border-dashed border-line-strong p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs font-semibold text-muted">{c.venue.name}</span>
          <Pill tone={c.status === 'active' ? 'gold' : 'muted'}>{c.status === 'active' ? 'Tap to use' : c.status}</Pill>
        </div>
        <div className="mt-1 font-display text-lg leading-tight font-bold">{c.title}</div>
        <div className="mt-1 text-xs text-faint">{c.status === 'redeemed' ? `Redeemed ${dateLabel(c.redeemedAt!)}` : `Expires ${dateLabel(c.expiresAt)}`}</div>
      </div>
    </Card>
  );
  return onOpen ? (
    <button onClick={onOpen} className="block w-full">
      {body}
    </button>
  ) : (
    <Link to="/venues/$slug" params={{ slug: c.venue.slug }} className="block">
      {body}
    </Link>
  );
}
