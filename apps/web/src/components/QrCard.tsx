import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';
import { Download, Link2 } from 'lucide-react';
import { useRef } from 'react';
import { toast } from 'sonner';
import { Avatar, type CardUser } from './Avatar';
import { Button } from './ui';

export const qrUrl = (kind: 'u' | 'v', key: string) => `${window.location.origin}/q/${kind}/${key}`;

/**
 * A scannable QR card. The code is a plain URL, so any phone camera opens it; inside
 * the app, scanning a venue checks you in and scanning a person connects you.
 */
export function QrCard({ kind, keyValue, title, subtitle, user, hue = 300, cta }: { kind: 'u' | 'v'; keyValue: string; title: string; subtitle: string; user?: CardUser; hue?: number; cta?: string }) {
  const url = qrUrl(kind, keyValue);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  function download() {
    const qr = canvasRef.current;
    if (!qr) return;
    const W = 720;
    const H = 1080;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d')!;
    const grad = g.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, `hsl(${hue} 90% 55%)`);
    grad.addColorStop(0.55, '#8b5cf6');
    grad.addColorStop(1, '#22d3ee');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#0b0814';
    g.beginPath();
    g.roundRect(30, 30, W - 60, H - 60, 48);
    g.fill();
    g.fillStyle = '#fff';
    g.beginPath();
    g.roundRect(110, 270, 500, 500, 36);
    g.fill();
    g.drawImage(qr, 140, 300, 440, 440);
    g.textAlign = 'center';
    g.fillStyle = '#ff3d9a';
    g.font = '700 30px system-ui';
    g.fillText('KARAOKE SCENE', W / 2, 120);
    g.fillStyle = '#f6f2ff';
    g.font = '800 54px system-ui';
    g.fillText(title, W / 2, 200, W - 120);
    g.fillStyle = '#a99fc4';
    g.font = '500 30px system-ui';
    g.fillText(subtitle, W / 2, 850, W - 120);
    g.fillStyle = '#f6f2ff';
    g.font = '700 34px system-ui';
    g.fillText(cta ?? 'Scan to connect', W / 2, 930);
    const a = document.createElement('a');
    a.href = c.toDataURL('image/png');
    a.download = `karaoke-scene-${keyValue}.png`;
    a.click();
  }

  return (
    <div className="relative overflow-hidden rounded-3xl p-[2px]" style={{ background: `linear-gradient(140deg, hsl(${hue} 90% 60%), #8b5cf6 55%, #22d3ee)` }}>
      <div className="rounded-[22px] bg-night p-5">
        <div className="flex items-center gap-3">
          {user && <Avatar user={user} size="md" />}
          <div className="min-w-0">
            <div className="text-[11px] font-bold tracking-[0.2em] text-pink">KARAOKE SCENE</div>
            <div className="truncate font-display text-xl font-bold">{title}</div>
            <div className="truncate text-xs text-muted">{subtitle}</div>
          </div>
        </div>
        <div className="mx-auto my-5 w-fit rounded-2xl bg-white p-3 shadow-[0_0_60px_-10px_rgb(255_61_154/0.6)]">
          <QRCodeSVG value={url} size={180} level="M" fgColor="#0b0814" marginSize={0} />
        </div>
        <QRCodeCanvas ref={canvasRef} value={url} size={440} level="M" marginSize={1} className="hidden" />
        <p className="text-center text-sm font-semibold">{cta ?? 'Scan to connect'}</p>
        <div className="mt-4 flex justify-center gap-2">
          <Button size="sm" onClick={download}>
            <Download className="size-4" /> Save card
          </Button>
          <Button
            size="sm"
            onClick={() => {
              navigator.clipboard?.writeText(url);
              toast.success('Link copied');
            }}
          >
            <Link2 className="size-4" /> Copy link
          </Button>
        </div>
      </div>
    </div>
  );
}
