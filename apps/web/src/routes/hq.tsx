import { createFileRoute } from '@tanstack/react-router';
import { VenueHqPage } from '~/features/hq/VenueHqPage';

export const Route = createFileRoute('/hq')({ component: VenueHqPage });
