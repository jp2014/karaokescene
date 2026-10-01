import { createFileRoute } from '@tanstack/react-router';
import { KjBoothPage } from '~/features/kj/KjBoothPage';

export const Route = createFileRoute('/kj')({ component: KjBoothPage });
