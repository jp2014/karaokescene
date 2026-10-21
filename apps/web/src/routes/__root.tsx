import { createRootRouteWithContext, Outlet, redirect, useRouterState } from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';
import { AppShell } from '~/features/shell/AppShell';
import { auth } from '~/lib/auth';
import { sessionQuery } from '~/lib/queries';

const PUBLIC = ['/welcome', '/about'];
const isBare = (path: string) => PUBLIC.some((p) => path.startsWith(p));

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  beforeLoad: async ({ location, context }) => {
    if (isBare(location.pathname)) return;
    if (!auth.signedIn()) throw redirect({ to: '/welcome', search: { next: location.href } });
    // Signed in but no profile yet (first sign-in): finish onboarding on the welcome page.
    const session = await context.queryClient.ensureQueryData(sessionQuery).catch(() => null);
    if (session && session.status !== 'ready') throw redirect({ to: '/welcome', search: { next: location.href } });
  },
  component: Root,
  notFoundComponent: () => (
    <div className="grid min-h-[60vh] place-items-center text-center">
      <div>
        <div className="text-6xl">🎤❓</div>
        <h1 className="mt-4 text-2xl font-bold">That page hit a wrong note</h1>
      </div>
    </div>
  ),
});

function Root() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return isBare(path) ? <Outlet /> : <AppShell />;
}
