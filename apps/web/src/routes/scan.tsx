import { createFileRoute } from '@tanstack/react-router';
import { ScanPage } from '~/features/qr/ScanPage';

export const Route = createFileRoute('/scan')({ component: ScanPage });
