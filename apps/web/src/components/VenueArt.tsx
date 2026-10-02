import { cx } from './ui';

/** Generative cover art for a venue: neon gradient with a big monogram, unique per hue. */
export function VenueArt({ name, hue, className, big }: { name: string; hue: number; className?: string; big?: boolean }) {
  const initials = name.replace(/^The /, '').split(/\s+/).slice(0, 2).map((w) => w[0]).join('');
  return (
    <div
      className={cx('overflow-hidden', !/\b(absolute|fixed)\b/.test(className ?? '') && 'relative', className)}
      style={{
        background: `radial-gradient(120% 90% at 0% 0%, hsl(${hue} 95% 60% / 0.95), transparent 55%), radial-gradient(100% 100% at 100% 100%, hsl(${(hue + 70) % 360} 90% 55% / 0.85), transparent 60%), linear-gradient(135deg, hsl(${hue} 60% 18%), hsl(${(hue + 40) % 360} 55% 10%))`,
      }}
    >
      <div className="absolute inset-0 opacity-30 mix-blend-overlay [background-image:repeating-linear-gradient(115deg,transparent_0_14px,rgb(255_255_255/0.25)_14px_15px)]" />
      <span className={cx('absolute font-display font-extrabold text-white/90 drop-shadow-[0_4px_24px_rgba(0,0,0,0.4)]', big ? 'right-6 bottom-2 text-[9rem] leading-none opacity-30' : 'inset-0 grid place-items-center text-xl')}>{initials}</span>
    </div>
  );
}

/** A gallery photo/video from object storage, or generated art (hue + emoji) when there's no file. */
export function GalleryTile({ hue, emoji, caption, kind, featured, mediaUrl, className }: { hue: number; emoji: string; caption: string; kind: string; featured?: boolean; mediaUrl?: string | null; className?: string }) {
  return (
    <div
      className={cx('group relative aspect-square overflow-hidden rounded-2xl', className)}
      style={{ background: `linear-gradient(160deg, hsl(${hue} 70% 35%), hsl(${(hue + 50) % 360} 70% 14%))` }}
    >
      {mediaUrl && kind === 'video' ? (
        <video src={mediaUrl} className="absolute inset-0 size-full object-cover" muted playsInline loop autoPlay />
      ) : mediaUrl ? (
        <img src={mediaUrl} alt={caption} loading="lazy" className="absolute inset-0 size-full object-cover transition group-hover:scale-105" />
      ) : (
        <div className="absolute inset-0 grid place-items-center text-5xl transition group-hover:scale-110">{emoji}</div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-8 text-xs font-medium">{caption}</div>
      {kind === 'video' && <span className="absolute top-2 left-2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-bold">▶ VIDEO</span>}
      {featured && <span className="absolute top-2 right-2 rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold text-ink">★ FEATURED</span>}
    </div>
  );
}
