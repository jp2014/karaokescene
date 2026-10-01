import { createFileRoute } from '@tanstack/react-router';
import { VenuePage } from '~/features/venue/VenuePage';

export const Route = createFileRoute('/venues/$slug')({ component: VenuePage });
