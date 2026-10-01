import { Link } from '@tanstack/react-router';
import { Eye, Ghost, ListMusic, QrCode, Save, Shield, Sparkles, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Avatar, ROLE_LABEL } from '~/components/Avatar';
import { BadgeGrid } from '~/components/Badge';
import { QrCard } from '~/components/QrCard';
import { Button, Card, cx, PageLoader, Section, Segmented, Toggle } from '~/components/ui';
import { api, unwrap } from '~/lib/api';
import { DAYS_LONG } from '~/lib/format';
import { qk, useAction, useMe, type Me } from '~/lib/queries';

type Vis = 'everyone' | 'friends' | 'nobody';
type PrivacyKey = 'hometown' | 'ageRange' | 'favoriteNight' | 'yearsSinging' | 'proStatus' | 'songList';
const PRIVACY_FIELDS: { key: PrivacyKey; label: string }[] = [
  { key: 'hometown', label: 'Hometown' },
  { key: 'ageRange', label: 'Age range' },
  { key: 'favoriteNight', label: 'Favorite karaoke night' },
  { key: 'yearsSinging', label: 'Years singing' },
  { key: 'proStatus', label: 'Professional status' },
  { key: 'songList', label: 'My song list' },
];
const EMOJIS = ['🎤', '🌵', '🔥', '✨', '🦋', '🎸', '👑', '🌙', '🪩', '💅', '🤠', '🐉', '🌸', '🎷', '🍒', '⚡'];
const AGES = ['21–24', '25–29', '30–34', '35–44', '45–54', '55+'];

export function MePage() {
  const { data: me } = useMe();
  if (!me) return <PageLoader />;
  return <MeEditor me={me} key={me.id} />;
}

function MeEditor({ me }: { me: Me }) {
  const [form, setForm] = useState({
    displayName: me.displayName,
    bio: me.bio,
    avatarEmoji: me.avatarEmoji,
    avatarHue: me.avatarHue,
    hometown: me.hometown ?? '',
    ageRange: me.ageRange ?? '',
    favoriteNight: me.favoriteNight ?? '',
    yearsSinging: me.yearsSinging ?? 0,
    isPro: me.isPro,
  });
  const [dirty, setDirty] = useState(false);
  useEffect(() => setDirty(false), [me.id]);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setDirty(true);
  };

  const save = useAction(
    (patch: Parameters<typeof api.profiles.me.$patch>[0]['json']) => unwrap(api.profiles.me.$patch({ json: patch })),
    { invalidate: [qk.me, ['profile']] },
  );
  const saveProfile = () =>
    save.mutate(
      { ...form, hometown: form.hometown || null, ageRange: form.ageRange || null, favoriteNight: form.favoriteNight || null, yearsSinging: form.yearsSinging || null },
      { onSuccess: () => setDirty(false) },
    );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold">Your profile</h1>
          <p className="mt-1 text-muted">Control what the scene sees about you.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/u/$handle" params={{ handle: me.handle }}>
            <Button>
              <Eye className="size-4" /> View public profile
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-8 [&>*]:min-w-0 lg:grid-cols-[1fr_360px]">
        <div className="space-y-8">
          {/* Ghost mode */}
          <Card className={cx('flex items-center gap-4 p-5 transition', me.ghostMode && 'border-violet/50 bg-violet/10')}>
            <div className={cx('grid size-12 shrink-0 place-items-center rounded-2xl text-2xl', me.ghostMode ? 'bg-violet/30' : 'bg-surface-2')}>
              <Ghost className="size-6" />
            </div>
            <div className="flex-1">
              <div className="font-semibold">Ghost Mode</div>
              <div className="text-sm text-muted">Hide your presence. You won't appear in "Who's here", friend counts or Singers Near You. The KJ still sees an anonymous ghost in the rotation.</div>
            </div>
            <Toggle on={me.ghostMode} onChange={(ghostMode) => save.mutate({ ghostMode })} label="Ghost Mode" />
          </Card>

          <Section title="Profile" icon={<Sparkles className="size-5 text-pink" />}>
            <Card className="space-y-5 p-5">
              <div className="flex items-center gap-4">
                <Avatar user={{ ...me, avatarEmoji: form.avatarEmoji, avatarHue: form.avatarHue }} size="xl" />
                <div className="flex-1 space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {EMOJIS.map((e) => (
                      <button key={e} onClick={() => set('avatarEmoji', e)} className={cx('grid size-9 place-items-center rounded-xl text-lg', form.avatarEmoji === e ? 'bg-pink/20 ring-2 ring-pink' : 'bg-surface-2 hover:bg-surface-3')}>
                        {e}
                      </button>
                    ))}
                  </div>
                  <input type="range" min={0} max={359} value={form.avatarHue} onChange={(e) => set('avatarHue', Number(e.target.value))} className="h-3 w-full appearance-none !rounded-full !border-0 !p-0" style={{ background: 'linear-gradient(90deg, hsl(0 90% 60%), hsl(60 90% 60%), hsl(120 90% 50%), hsl(180 90% 50%), hsl(240 90% 65%), hsl(300 90% 60%), hsl(359 90% 60%))' }} aria-label="Avatar color" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Display name">
                  <input value={form.displayName} onChange={(e) => set('displayName', e.target.value)} className="w-full" />
                </Field>
                <Field label="Hometown">
                  <input value={form.hometown} onChange={(e) => set('hometown', e.target.value)} className="w-full" placeholder="Omaha, NE" />
                </Field>
                <Field label="Age range">
                  <select value={form.ageRange} onChange={(e) => set('ageRange', e.target.value)} className="w-full">
                    <option value="">Prefer not to say</option>
                    {AGES.map((a) => (
                      <option key={a}>{a}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Favorite karaoke night">
                  <select value={form.favoriteNight} onChange={(e) => set('favoriteNight', e.target.value)} className="w-full">
                    <option value="">—</option>
                    {DAYS_LONG.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </Field>
                <Field label={me.role === 'kj' ? 'Years hosting' : 'Years singing'}>
                  <input type="number" min={0} max={80} value={form.yearsSinging} onChange={(e) => set('yearsSinging', Number(e.target.value))} className="w-full" />
                </Field>
                <Field label="Professional singer?">
                  <div className="flex h-[46px] items-center gap-3">
                    <Toggle on={form.isPro} onChange={(v) => set('isPro', v)} label="Professional" />
                    <span className="text-sm text-muted">{form.isPro ? 'Yes, I gig' : 'Just for fun'}</span>
                  </div>
                </Field>
              </div>
              <Field label="Bio">
                <textarea value={form.bio} onChange={(e) => set('bio', e.target.value)} rows={2} maxLength={200} className="w-full" />
              </Field>
              <div className="flex justify-end">
                <Button variant="primary" disabled={!dirty} loading={save.isPending} onClick={saveProfile}>
                  <Save className="size-4" /> Save profile
                </Button>
              </div>
            </Card>
          </Section>

          <Section title="Who can see what" icon={<Shield className="size-5 text-cyan" />}>
            <Card className="divide-y divide-line">
              {PRIVACY_FIELDS.map((f) => (
                <div key={f.key} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                  <span className="text-sm font-medium">{f.label}</span>
                  <Segmented<Vis>
                    size="sm"
                    value={me.privacy[f.key]}
                    onChange={(v) => save.mutate({ privacy: { [f.key]: v } })}
                    options={[
                      { value: 'everyone', label: 'Everyone' },
                      { value: 'friends', label: 'Friends' },
                      { value: 'nobody', label: 'Only me' },
                    ]}
                  />
                </div>
              ))}
            </Card>
          </Section>

          {me.badges.length > 0 && (
            <Section title="Your badges">
              <BadgeGrid badges={me.badges} />
            </Section>
          )}
        </div>

        <aside className="space-y-6">
          <QrCard kind="u" keyValue={me.handle} title={me.displayName} subtitle={`${ROLE_LABEL[me.role]} on Karaoke Scene`} user={me} hue={me.avatarHue} />
          <Card className="p-5">
            <div className="flex items-center gap-2 font-semibold">
              <QrCode className="size-4 text-pink" /> Grow the scene
            </div>
            <p className="mt-1 text-sm text-muted">Share your QR card at shows. Every 3 people who join through you earns a {me.role === 'kj' ? 'Scene Ambassador' : 'Scene Builder'} badge and priority status.</p>
            <div className="mt-4 flex items-end gap-2">
              <span className="font-display text-4xl font-bold text-gradient">{me.qrScans}</span>
              <span className="pb-1.5 text-sm text-muted">people reached</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-3">
              <div className="h-full rounded-full bg-brand" style={{ width: `${((me.qrScans % 3) / 3) * 100}%` }} />
            </div>
            <div className="mt-1 text-xs text-faint">{3 - (me.qrScans % 3)} more to your next badge</div>
          </Card>
          <div className="grid grid-cols-2 gap-2">
            {me.role === 'singer' && (
              <Link to="/songs">
                <Card className="p-4 transition hover:border-line-strong">
                  <ListMusic className="size-5 text-violet" />
                  <div className="mt-2 text-sm font-semibold">Song list</div>
                </Card>
              </Link>
            )}
            <Link to="/friends">
              <Card className="p-4 transition hover:border-line-strong">
                <Users className="size-5 text-cyan" />
                <div className="mt-2 text-sm font-semibold">Friends & blocks</div>
              </Card>
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</span>
      {children}
    </label>
  );
}
