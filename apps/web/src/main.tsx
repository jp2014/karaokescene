import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { Toaster } from 'sonner';
import { routeTree } from './routeTree.gen';
import { PageLoader } from './components/ui';
import { ApiError } from './lib/api';
import { auth } from './lib/auth';
import './styles.css';

// A token the API no longer accepts (expired session, or demo data was reset) means signed out.
function onApiError(err: unknown) {
  if (!(err instanceof ApiError) || err.status !== 401 || !auth.signedIn()) return;
  void auth.signOut();
  queryClient.clear();
  router.navigate({ to: '/welcome', search: { next: router.state.location.href } });
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: onApiError }),
  mutationCache: new MutationCache({ onError: onApiError }),
  defaultOptions: { queries: { staleTime: 5_000, refetchOnWindowFocus: true } },
});
const router = createRouter({ routeTree, context: { queryClient }, defaultPreload: 'intent', defaultPendingComponent: PageLoader, scrollRestoration: true });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

await auth.init();
if (__DEMO__) await (await import('./demo/install')).installDemo();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster theme="dark" position="top-center" richColors closeButton toastOptions={{ classNames: { toast: '!rounded-2xl !border-line !bg-surface-2 !font-sans' } }} />
    </QueryClientProvider>
  </StrictMode>,
);
