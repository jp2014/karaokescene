import { createFileRoute } from '@tanstack/react-router';
import { SharePage } from '~/features/promo/SharePage';

export const Route = createFileRoute('/share/$postId')({ component: SharePage });
