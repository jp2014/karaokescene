import { createFileRoute } from '@tanstack/react-router';
import { QrLandingPage } from '~/features/qr/QrLandingPage';

export const Route = createFileRoute('/q/$kind/$key')({ component: QrLandingPage });
