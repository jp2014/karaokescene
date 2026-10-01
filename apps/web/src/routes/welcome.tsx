import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { WelcomePage } from '~/features/welcome/WelcomePage';

export const Route = createFileRoute('/welcome')({
  validateSearch: z.object({ next: z.string().optional() }),
  component: WelcomePage,
});
