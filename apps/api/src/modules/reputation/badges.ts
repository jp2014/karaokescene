import type { Role } from '../../db/schema.ts';

export type BadgeDef = {
  key: string;
  label: string;
  description: string;
  icon: string; // lucide icon name, resolved by the client
  /** Which account type awards it, and to whom. 'system' badges are earned automatically. */
  givenBy: Role | 'system';
  givenTo: Role;
};

export const BADGES: BadgeDef[] = [
  // KJ -> Singer
  { key: 'singer.punctuality', label: 'Punctuality', description: 'Ready when their name is called', icon: 'Clock', givenBy: 'kj', givenTo: 'singer' },
  { key: 'singer.ability', label: 'Singing Ability', description: 'Serious pipes', icon: 'Mic', givenBy: 'kj', givenTo: 'singer' },
  { key: 'singer.showmanship', label: 'Showmanship', description: 'Owns the stage', icon: 'Sparkles', givenBy: 'kj', givenTo: 'singer' },
  { key: 'singer.crowd', label: 'Crowd Pleaser', description: 'The room sings along', icon: 'PartyPopper', givenBy: 'kj', givenTo: 'singer' },
  { key: 'singer.manners', label: 'Mr./Mrs. Manners', description: 'Kind to the KJ, staff and fellow singers', icon: 'HeartHandshake', givenBy: 'kj', givenTo: 'singer' },
  // Venue -> KJ
  { key: 'kj.cult', label: 'Cult Following', description: 'Regulars follow them from bar to bar', icon: 'Users', givenBy: 'venue', givenTo: 'kj' },
  { key: 'kj.punctuality', label: 'Punctuality', description: 'Set up and rolling on time', icon: 'Clock', givenBy: 'venue', givenTo: 'kj' },
  { key: 'kj.showmanship', label: 'Showmanship', description: 'A host, not just a DJ', icon: 'Sparkles', givenBy: 'venue', givenTo: 'kj' },
  { key: 'kj.vibe', label: 'Vibe Setter', description: 'Reads the room perfectly', icon: 'Waves', givenBy: 'venue', givenTo: 'kj' },
  { key: 'kj.gapless', label: 'Gapless Music', description: 'Never a dead second between singers', icon: 'Infinity', givenBy: 'venue', givenTo: 'kj' },
  { key: 'kj.clean', label: 'Clean Freak', description: 'Leaves the stage spotless', icon: 'SprayCan', givenBy: 'venue', givenTo: 'kj' },
  // Growth loop
  { key: 'growth.scene-builder', label: 'Scene Builder', description: 'Brought new people into the scene with their QR code', icon: 'QrCode', givenBy: 'system', givenTo: 'singer' },
  { key: 'growth.kj-ambassador', label: 'Scene Ambassador', description: 'Grew the scene by sharing their QR card', icon: 'Megaphone', givenBy: 'system', givenTo: 'kj' },
];

export const badgeByKey = new Map(BADGES.map((b) => [b.key, b]));

export type Tier = 'bronze' | 'silver' | 'gold';
export const tierFor = (count: number): Tier => (count >= 15 ? 'gold' : count >= 5 ? 'silver' : 'bronze');
