import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { Toaster } from 'sonner';
import { routeTree } from './routeTree.gen';
import { PageLoader } from './components/ui';
import { ApiError, tokenStore } from './lib/api';
import './styles.css';

// A token the API no longer knows (e.g. after the demo data was reset) means signed out: pick a persona again.
function onApiError(err: unknown) {
  if (!(err instanceof ApiError) || err.status !== 401 || !tokenStore.get()) return;
  tokenStore.clear();
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster theme="dark" position="top-center" richColors closeButton toastOptions={{ classNames: { toast: '!rounded-2xl !border-line !bg-surface-2 !font-sans' } }} />
    </QueryClientProvider>
  </StrictMode>,
);
