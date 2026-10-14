import { createFileRoute, Navigate } from '@tanstack/react-router';
import { DiscoverPage } from '~/features/discover/DiscoverPage';
import { useMe } from '~/lib/queries';

export const Route = createFileRoute('/')({ component: Home });

/** Discover is for singers (and venues browsing the scene); KJs land in their booth. */
function Home() {
  const { data: me } = useMe();
  if (me?.role === 'kj') return <Navigate to="/kj" replace />;
  return <DiscoverPage />;
}
