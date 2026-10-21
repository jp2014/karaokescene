import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { Megaphone } from 'lucide-react';
import { ShareTargets } from '~/components/ShareSheet';
import { Card, EmptyState, PageLoader } from '~/components/ui';
import { api, unwrap } from '~/lib/api';
import { venueUrl } from './PromoteCard';

/** Opened from a share reminder (Auto Promote, special reminders): the message, ready to share. */
export function SharePage() {
  const { postId } = useParams({ from: '/share/$postId' });
  const { data, isLoading } = useQuery({ queryKey: ['posts'], queryFn: () => unwrap(api.promo.posts.$get()) });
  if (isLoading) return <PageLoader />;
  const post = data?.find((p) => p.id === postId);
  if (!post?.venue) return <EmptyState icon={<Megaphone />} title="That reminder is gone" body="It may have expired. You can always share your venue from the Promote card." />;
  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div>
        <h1 className="text-3xl font-extrabold">
          Share <span className="text-gradient">{post.venue.name}</span>
        </h1>
        <p className="mt-1 text-muted">Your reminder is ready. Edit it if you like, then share it wherever your crowd is.</p>
      </div>
      <Card className="p-5">
        <ShareTargets text={post.body} url={venueUrl(post.venue.slug)} />
      </Card>
      <Link to="/venues/$slug" params={{ slug: post.venue.slug }} className="block text-center text-sm text-muted hover:text-fg">
        Open {post.venue.name}
      </Link>
    </div>
  );
}
