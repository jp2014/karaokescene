import { auth } from '~/lib/auth';
import { setServerOffset } from '~/lib/format';
import { demoApi, personaToken } from './api';

/** Runs before the app renders in demo builds: persona sign-in and the time-travelled clock. */
export async function installDemo() {
  auth.setTokenOverride(personaToken);
  const clock = await demoApi.clock
    .$get()
    .then((r) => r.json())
    .catch(() => null);
  if (clock) setServerOffset(clock.offsetMs);
}
