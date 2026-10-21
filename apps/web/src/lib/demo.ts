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

export const DemoClaimSheet = __DEMO__ ? lazy(() => import('~/demo/ClaimSheet').then((m) => ({ default: m.ClaimSheet }))) : null;
export const DemoPlanSwitch = __DEMO__ ? lazy(() => import('~/demo/PlanSwitch').then((m) => ({ default: m.PlanSwitch }))) : null;
