import { and, eq, inArray } from 'drizzle-orm';
import { importPKCS8, SignJWT } from 'jose';
import { db, schema } from '../db/client.ts';

/**
 * Push notifications through Firebase Cloud Messaging (HTTP v1). Enabled when
 * FCM_SERVICE_ACCOUNT holds a service account JSON key; otherwise a no-op, and the
 * in-app notification list + realtime toasts still work.
 */
type ServiceAccount = { project_id: string; client_email: string; private_key: string };

function serviceAccount(): ServiceAccount | null {
  const raw = process.env.FCM_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ServiceAccount;
  } catch {
    console.error('FCM_SERVICE_ACCOUNT is not valid JSON; push is disabled');
    return null;
  }
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function accessToken(sa: ServiceAccount) {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/firebase.messaging' })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(sa.client_email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(await importPKCS8(sa.private_key, 'RS256'));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  if (!res.ok) throw new Error(`FCM auth ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return cachedToken.value;
}

export type PushMessage = { kind: string; title: string; body: string; link?: string | null };

export const push = {
  enabled: () => !!serviceAccount(),

  async register(userId: string, token: string, platform: 'web' | 'ios' | 'android', now: number) {
    await db
      .insert(schema.pushTokens)
      .values({ token, userId, platform, createdAt: now })
      .onConflictDoUpdate({ target: schema.pushTokens.token, set: { userId, platform } });
  },

  async unregister(userId: string, token: string) {
    await db.delete(schema.pushTokens).where(and(eq(schema.pushTokens.token, token), eq(schema.pushTokens.userId, userId)));
  },

  async send(userId: string, msg: PushMessage) {
    const sa = serviceAccount();
    if (!sa) return;
    const tokens = await db.select().from(schema.pushTokens).where(eq(schema.pushTokens.userId, userId));
    if (!tokens.length) return;
    const bearer = await accessToken(sa);
    const appUrl = process.env.APP_URL?.replace(/\/$/, '');
    const dead: string[] = [];
    await Promise.all(
      tokens.map(async ({ token }) => {
        const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
          method: 'POST',
          headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/json' },
          body: JSON.stringify({
            message: {
              token,
              notification: { title: msg.title, body: msg.body },
              data: { kind: msg.kind, link: msg.link ?? '/' },
              webpush: { headers: { Urgency: 'high' }, ...(appUrl && msg.link ? { fcm_options: { link: appUrl + msg.link } } : {}) },
            },
          }),
        });
        if (res.status === 404 || res.status === 400) {
          // UNREGISTERED / INVALID_ARGUMENT: the device dropped this token.
          const text = await res.text();
          if (/UNREGISTERED|registration-token-not-registered|INVALID_ARGUMENT/.test(text)) dead.push(token);
          else console.error(`FCM send ${res.status}: ${text}`);
        } else if (!res.ok) {
          console.error(`FCM send ${res.status}: ${await res.text()}`);
        }
      }),
    );
    if (dead.length) await db.delete(schema.pushTokens).where(inArray(schema.pushTokens.token, dead));
  },
};
