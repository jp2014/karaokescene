import { lazy } from 'react';

/**
 * The boundary between the app and the local demo (src/demo). Everything demo-only is
 * reached through here, behind the build-time __DEMO__ flag, so production builds drop
 * the demo code entirely.
 */
export const DEMO = __DEMO__;

export const DemoControls = __DEMO__ ? lazy(() => import('~/demo/DebugPanel').then((m) => ({ default: m.DebugPanel }))) : null;
export const DemoPersonas = __DEMO__ ? lazy(() => import('~/demo/PersonaPicker').then((m) => ({ default: m.PersonaPicker }))) : null;
export const DemoScans = __DEMO__ ? lazy(() => import('~/demo/SimulatedScans').then((m) => ({ default: m.SimulatedScans }))) : null;

/** Mock checkout for the upsell buttons. Real payments aren't built, so production shows "coming soon". */
export const demoUpgrade = __DEMO__ ? () => import('~/demo/api').then((m) => m.demoUpgrade()) : null;
export const demoSetPremiere = __DEMO__ ? (venueId: string, on: boolean) => import('~/demo/api').then((m) => m.demoSetPremiere(venueId, on)) : null;
