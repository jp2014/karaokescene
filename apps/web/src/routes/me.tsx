import { createFileRoute } from '@tanstack/react-router';
import { MePage } from '~/features/profile/MePage';

export const Route = createFileRoute('/me')({ component: MePage });
