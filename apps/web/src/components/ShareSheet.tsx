import { Link2, MessageSquare } from 'lucide-react';
import { FacebookIcon as Facebook, InstagramIcon as Instagram } from './BrandIcons';
import { useState } from 'react';
import { toast } from 'sonner';
import { Sheet } from './ui';

/**
 * Share to Facebook / Instagram. The POC mocks the native integrations: it shows
 * the post preview and "posts" it; real OAuth posting slots in behind this sheet.
 */
export function ShareSheet({ open, onClose, title, text, url }: { open: boolean; onClose: () => void; title: string; text: string; url: string }) {
  const [body, setBody] = useState(text);
  const targets = [
    { key: 'facebook', label: 'Facebook', icon: Facebook, color: 'bg-[#1877f2]' },
    { key: 'instagram', label: 'Instagram story', icon: Instagram, color: 'bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af]' },
    { key: 'sms', label: 'Text a friend', icon: MessageSquare, color: 'bg-live text-ink' },
  ];
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} className="w-full text-sm" />
      <div className="mt-1 truncate text-xs text-faint">{url}</div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {targets.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              if (t.key === 'sms' && navigator.share) navigator.share({ text: body, url }).catch(() => {});
              else toast.success(`Shared to ${t.label}`, { description: 'Mocked in the POC; real posting uses the network’s API.' });
              onClose();
            }}
            className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface-2/60 p-3 text-xs font-semibold transition hover:border-line-strong"
          >
            <span className={`grid size-11 place-items-center rounded-2xl text-white ${t.color}`}>
              <t.icon className="size-5" />
            </span>
            {t.label}
          </button>
        ))}
      </div>
      <button
        onClick={() => {
          navigator.clipboard?.writeText(`${body} ${url}`);
          toast.success('Copied to clipboard');
        }}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-line py-3 text-sm font-semibold text-muted hover:text-fg"
      >
        <Link2 className="size-4" /> Copy link
      </button>
    </Sheet>
  );
}
