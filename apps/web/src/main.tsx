import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { Toaster } from 'sonner';
import { routeTree } from './routeTree.gen';
import { PageLoader } from './components/ui';
import './styles.css';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 5_000, refetchOnWindowFocus: true } } });
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
