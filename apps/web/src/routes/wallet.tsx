import { createFileRoute } from '@tanstack/react-router';
import { WalletPage } from '~/features/wallet/WalletPage';

export const Route = createFileRoute('/wallet')({ component: WalletPage });
