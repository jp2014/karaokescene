import { createFileRoute } from '@tanstack/react-router';
import { MyVenuesPage } from '~/features/kj/MyVenuesPage';

export const Route = createFileRoute('/my-venues')({ component: MyVenuesPage });
