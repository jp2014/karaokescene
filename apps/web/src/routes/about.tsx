import { createFileRoute } from '@tanstack/react-router';
import { AboutPage } from '~/features/welcome/AboutPage';

export const Route = createFileRoute('/about')({ component: AboutPage });
