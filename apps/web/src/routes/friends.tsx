import { createFileRoute } from '@tanstack/react-router';
import { FriendsPage } from '~/features/social/FriendsPage';

export const Route = createFileRoute('/friends')({ component: FriendsPage });
