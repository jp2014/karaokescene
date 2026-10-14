import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Camera, ImagePlus, QrCode, ScanLine, Star, Ticket } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Avatar, ROLE_LABEL } from '~/components/Avatar';
import { FilePicker } from '~/components/FilePicker';
import { QrCard } from '~/components/QrCard';
import { Button, Card, cx, Pill, Section, Segmented } from '~/components/ui';
import { GalleryTile, VenueArt } from '~/components/VenueArt';
import { api, unwrap } from '~/lib/api';
import { useLocation } from '~/lib/location';
import { useAction, useBooth, useCircle, useMe, useRegulars, useVenues } from '~/lib/queries';
import { parseQr, useQrScan } from './useQrScan';

declare global {
  // Chrome/Edge/Android ship BarcodeDetector; elsewhere we fall back to simulated scans.
  // eslint-disable-next-line no-var
  var BarcodeDetector: { new (o: { formats: string[] }): { detect(src: CanvasImageSource): Promise<{ rawValue: string }[]> } } | undefined;
}

export function ScanPage() {
  const [tab, setTab] = useState<'scan' | 'mine'>('scan');
  const { data: me } = useMe();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">
            Scan <span className="text-gradient">& Share</span>
          </h1>
          <p className="mt-1 text-muted">
            {me?.role === 'venue' ? 'Scan a singer’s coupon to redeem it, or share your check-in code.' : 'Scan a venue to check in. Scan a person to connect.'}
          </p>
        </div>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'scan', label: 'Scan' },
            { value: 'mine', label: 'My code' },
          ]}
        />
      </div>
      {tab === 'scan' ? (
        <Scanner />
      ) : (
        me && (
          <div className="mx-auto max-w-sm">
            {me.role === 'venue' && me.venue ? (
              <QrCard kind="v" keyValue={me.venue.slug} title={me.venue.name} subtitle="Scan to check in" hue={me.avatarHue} cta="Scan to check in" />
            ) : (
              <QrCard kind="u" keyValue={me.handle} title={me.displayName} subtitle={`${ROLE_LABEL[me.role]} on Karaoke Scene`} user={me} hue={me.avatarHue} />
            )}
          </div>
        )
      )}
      {me?.role === 'singer' && <Regulars />}
      {me?.role === 'kj' && <ShareNightPhotos />}
      {me?.role === 'venue' && <RedeemByCode />}
    </div>
  );
}

/** 5 or more nights checked in at a venue makes you a Regular there. */
function Regulars() {
  const { data } = useRegulars();
  if (!data) return null;
  return (
    <Section title="Become a Regular" icon={<Star className="size-5 text-gold" />}>
      <p className="-mt-1 text-sm text-muted">Check in 5 or more nights at a venue and you're a Regular there. Regulars stand out to KJs and venues, and often get coupons.</p>
      <div className="space-y-2">
        {data.slice(0, 6).map((r) => (
          <Link key={r.venue.id} to="/venues/$slug" params={{ slug: r.venue.slug }} className={cx('flex items-center gap-3 rounded-2xl border p-3', r.isRegular ? 'border-gold/40 bg-gold/5' : 'border-line bg-surface/70')}>
            <VenueArt name={r.venue.name} hue={r.venue.hue} photoUrl={r.venue.photoUrl} className="size-11 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{r.venue.name}</div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
                <div className={cx('h-full rounded-full', r.isRegular ? 'bg-gold' : 'bg-brand')} style={{ width: `${Math.min(r.visits / 5, 1) * 100}%` }} />
              </div>
            </div>
            {r.isRegular ? <Pill tone="gold">⭐ Regular</Pill> : <span className="text-xs text-muted">{r.visits}/5 nights</span>}
          </Link>
        ))}
        {!data.length && <p className="text-sm text-muted">Check in somewhere to start counting.</p>}
      </div>
    </Section>
  );
}

/** KJs share photos from their night straight into the venue's gallery. */
function ShareNightPhotos() {
  const { data: booth } = useBooth();
  const venues = booth?.venues ?? [];
  const [venueId, setVenueId] = useState<string>();
  const [caption, setCaption] = useState('');
  const [posted, setPosted] = useState<{ id: string; imageUrl: string; caption: string; hue: number }[]>([]);
  const target = venueId ?? booth?.venue?.id ?? venues[0]?.id;
  const venue = venues.find((v) => v.id === target);
  const post = useAction(
    (imageUrl: string) => unwrap(api.venues[':venueId'].gallery.$post({ param: { venueId: target! }, json: { imageUrl, caption: caption || `Tonight at ${venue?.name}`, kind: 'photo', emoji: '📸' } })),
    {
      invalidate: [['venue']],
      success: `Posted to ${venue?.name}'s gallery 📸`,
      onSuccess: (r) => {
        setPosted((p) => [{ id: r.id, imageUrl: r.imageUrl!, caption: r.caption, hue: r.hue }, ...p]);
        setCaption('');
      },
    },
  );
  if (!venues.length) return null;
  return (
    <Section title="Share photos from tonight" icon={<ImagePlus className="size-5 text-pink" />}>
      <Card className="space-y-3 p-4">
        <p className="text-sm text-muted">Snap the crowd, the stage, the group sing-along. Photos go to the venue's gallery and the venue can feature the best ones.</p>
        {venues.length > 1 && (
          <select value={target} onChange={(e) => setVenueId(e.target.value)} className="w-full text-sm">
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        )}
        <input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={120} placeholder="Caption (optional)" className="w-full text-sm" />
        <FilePicker variant="primary" className="w-full" capture="environment" onUploaded={(url) => post.mutate(url)}>
          <Camera className="size-4" /> Take or upload a photo
        </FilePicker>
        {posted.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {posted.map((g) => (
              <GalleryTile key={g.id} hue={g.hue} emoji="📸" caption={g.caption} kind="photo" imageUrl={g.imageUrl} />
            ))}
          </div>
        )}
      </Card>
    </Section>
  );
}

/** Venues redeem coupons by scanning the singer's QR, or typing the code as a fallback. */
function RedeemByCode() {
  const [code, setCode] = useState('');
  const redeem = useAction((c: string) => unwrap(api.wallet.redeem.$post({ json: { code: c } })), {
    invalidate: [['issued']],
    success: (r) => `Redeemed: ${r.title} for ${r.singer?.displayName ?? 'the singer'} ✅`,
    onSuccess: () => setCode(''),
  });
  return (
    <Section title="Redeem a coupon by code" icon={<Ticket className="size-5 text-gold" />}>
      <div className="flex gap-2">
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. KS284384" className="min-w-0 flex-1 font-mono tracking-widest" />
        <Button variant="primary" disabled={code.length < 4} loading={redeem.isPending} onClick={() => redeem.mutate(code)}>
          Redeem
        </Button>
      </div>
      <p className="text-xs text-faint">Each coupon works once. Award coupons to singers from Venue HQ.</p>
    </Section>
  );
}

function Scanner() {
  const video = useRef<HTMLVideoElement>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const scan = useQrScan();
  const loc = useLocation();
  const { data: venues } = useVenues({ lat: loc.current.lat, lng: loc.current.lng, radiusMi: 20 });
  const { data: circle } = useCircle();
  const { data: me } = useMe();
  const issued = useQuery({ queryKey: ['issued'], queryFn: () => unwrap(api.wallet.issued.$get()), enabled: me?.role === 'venue' });
  const supported = typeof window !== 'undefined' && !!window.BarcodeDetector;

  useEffect(() => {
    if (!cameraOn) return;
    let stream: MediaStream | null = null;
    let stop = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (!video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        const detector = new window.BarcodeDetector!({ formats: ['qr_code'] });
        while (!stop) {
          const codes = await detector.detect(video.current).catch(() => []);
          const hit = codes.map((c) => parseQr(c.rawValue)).find(Boolean);
          if (hit) {
            stop = true;
            await scan(hit);
            break;
          }
          await new Promise((r) => setTimeout(r, 250));
        }
      } catch {
        toast.error('Camera unavailable. Use a simulated scan below.');
        setCameraOn(false);
      }
    })();
    return () => {
      stop = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [cameraOn]);

  const isVenue = me?.role === 'venue';
  const nearby = isVenue ? [] : (venues?.venues.filter((v) => v.isLive).slice(0, 4) ?? []);
  const people = isVenue ? [] : [...(circle?.friends ?? []), ...(circle?.incoming ?? [])].slice(0, 4);
  const coupons = issued.data?.filter((c) => c.status === 'active').slice(0, 4) ?? [];

  return (
    <div className="space-y-6">
      <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-[2rem] border border-line bg-black" style={{ ['--scan-h' as string]: '100%' }}>
        {cameraOn ? (
          <video ref={video} className="absolute inset-0 size-full object-cover" muted playsInline />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgb(139_92_246/0.25),transparent_60%)]" />
        )}
        <div className="absolute inset-10 rounded-3xl border-2 border-white/15">
          {['top-0 left-0 border-t-4 border-l-4 rounded-tl-3xl', 'top-0 right-0 border-t-4 border-r-4 rounded-tr-3xl', 'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-3xl', 'bottom-0 right-0 border-b-4 border-r-4 rounded-br-3xl'].map((c) => (
            <span key={c} className={`absolute size-10 border-pink ${c}`} />
          ))}
          <div className="absolute inset-x-3 top-0 h-[3px] animate-scan rounded-full bg-gradient-to-r from-transparent via-pink to-transparent shadow-[0_0_20px_4px_rgb(255_61_154/0.5)]" />
        </div>
        {!cameraOn && (
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-center">
              <ScanLine className="mx-auto size-10 text-white/40" />
              {supported ? (
                <Button variant="primary" className="mt-4" onClick={() => setCameraOn(true)}>
                  <Camera className="size-4" /> Use camera
                </Button>
              ) : (
                <p className="mt-3 max-w-[220px] text-xs text-muted">Live scanning works in Chrome & Android. Or point your phone's camera at any Karaoke Scene QR card.</p>
              )}
            </div>
          </div>
        )}
      </div>

      <Section title="Simulate a scan" icon={<QrCode className="size-5 text-pink" />}>
        <p className="-mt-1 text-sm text-muted">For the demo: pretend you just scanned one of these codes.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {nearby.map((v) => (
            <Card key={v.id} className="flex items-center gap-3 p-3">
              <VenueArt name={v.name} hue={v.hue} photoUrl={v.photoUrl} className="size-11 rounded-xl" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{v.name}</div>
                <div className="text-xs text-muted">Venue code → check in</div>
              </div>
              <Button size="sm" onClick={() => scan({ kind: 'v', key: v.slug })}>
                Scan
              </Button>
            </Card>
          ))}
          {coupons.map((c) => (
            <Card key={c.id} className="flex items-center gap-3 p-3">
              {c.singer && <Avatar user={c.singer} />}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{c.title}</div>
                <div className="text-xs text-muted">{c.singer?.displayName}'s coupon → redeem</div>
              </div>
              <Button size="sm" onClick={() => scan({ kind: 'c', key: c.code })}>
                Scan
              </Button>
            </Card>
          ))}
          {isVenue && !coupons.length && <p className="text-sm text-muted">No unredeemed coupons. Award one to a singer from Venue HQ.</p>}
          {people.map((u) => (
            <Card key={u.id} className="flex items-center gap-3 p-3">
              <Avatar user={u} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{u.displayName}</div>
                <div className="text-xs text-muted">QR card → connect</div>
              </div>
              <Button size="sm" onClick={() => scan({ kind: 'u', key: u.handle })}>
                Scan
              </Button>
            </Card>
          ))}
        </div>
      </Section>
    </div>
  );
}
