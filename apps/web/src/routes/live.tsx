import { createFileRoute } from '@tanstack/react-router';
import { LivePage } from '~/features/live/LivePage';

export const Route = createFileRoute('/live')({ component: LivePage });
