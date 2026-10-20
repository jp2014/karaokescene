import { Link2, MessageSquare, Share2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { FacebookIcon as Facebook } from './BrandIcons';
import { Sheet } from './ui';

const canShare = () => typeof navigator !== 'undefined' && !!navigator.share;

/**
 * Edit the message, then share it for real: the device's share sheet (Instagram, Facebook,
 * WhatsApp, Messages… whatever's installed), Facebook's share link, a text, or a copy.
 * Nothing is posted on anyone's behalf.
 */
export function ShareTargets({ text, url }: { text: string; url: string }) {
  const [body, setBody] = useState(text);
  useEffect(() => setBody(text), [text]);
  const full = `${body} ${url}`;
  const targets = [
    ...(canShare() ? [{ key: 'device', label: 'Share…', icon: Share2, color: 'bg-brand', go: () => navigator.share({ text: body, url }).catch((error) => { if (error.name !== 'AbortError') toast.error('Could not open sharing. Try copying the text and link.'); }) }] : []),
    { key: 'facebook', label: 'Facebook', icon: Facebook, color: 'bg-[#1877f2]', go: () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(body)}`, '_blank', 'noopener') },
    { key: 'sms', label: 'Text a friend', icon: MessageSquare, color: 'bg-live text-ink', go: () => (window.location.href = `sms:?&body=${encodeURIComponent(full)}`) },
  ];
  return (
    <div>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} className="w-full text-sm" />
      <div className="mt-1 truncate text-xs text-faint">{url}</div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {targets.map((t) => (
          <button key={t.key} onClick={t.go} className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface-2/60 p-3 text-xs font-semibold transition hover:border-line-strong">
            <span className={`grid size-11 place-items-center rounded-2xl text-white ${t.color}`}>
              <t.icon className="size-5" />
            </span>
            {t.label}
          </button>
        ))}
      </div>
      <button
        onClick={async () => {
          try {
            if (!navigator.clipboard) throw new Error('Clipboard unavailable');
            await navigator.clipboard.writeText(full);
            toast.success('Copied: paste it into Instagram or anywhere');
          } catch {
            toast.error('Could not copy. Select the message and link to copy them manually.');
          }
        }}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-line py-3 text-sm font-semibold text-muted hover:text-fg"
      >
        <Link2 className="size-4" /> Copy text & link
      </button>
    </div>
  );
}

export function ShareSheet({ open, onClose, title, text, url }: { open: boolean; onClose: () => void; title: string; text: string; url: string }) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <ShareTargets text={text} url={url} />
    </Sheet>
  );
}
