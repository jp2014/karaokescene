import { Camera, ScanLine } from 'lucide-react';
import { Suspense, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ROLE_LABEL } from '~/components/Avatar';
import { QrCard } from '~/components/QrCard';
import { Button, Segmented } from '~/components/ui';
import { DemoScans } from '~/lib/demo';
import { useMe } from '~/lib/queries';
import { parseQr, useQrScan } from './useQrScan';

declare global {
  // Chrome/Edge/Android ship BarcodeDetector; elsewhere the phone's own camera app opens the QR URL.
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
          <p className="mt-1 text-muted">Scan a venue to check in. Scan a person to connect.</p>
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
    </div>
  );
}

function Scanner() {
  const video = useRef<HTMLVideoElement>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const scan = useQrScan();
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
        toast.error('Camera unavailable. Point your phone camera at the code instead.');
        setCameraOn(false);
      }
    })();
    return () => {
      stop = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [cameraOn]);

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

      {DemoScans && (
        <Suspense>
          <DemoScans />
        </Suspense>
      )}
    </div>
  );
}
