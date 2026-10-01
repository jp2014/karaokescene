import { createFileRoute } from '@tanstack/react-router';
import { SongsPage } from '~/features/songs/SongsPage';

export const Route = createFileRoute('/songs')({ component: SongsPage });
