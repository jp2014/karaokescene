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
  // Singer -> Singer (alongside written praise)
  { key: 'peer.hype', label: 'Hype Squad', description: 'Cheers everyone on, every song', icon: 'Megaphone', givenBy: 'singer', givenTo: 'singer' },
  { key: 'peer.duet', label: 'Duet Partner', description: 'Brings out the best in a duet', icon: 'HeartHandshake', givenBy: 'singer', givenTo: 'singer' },
  { key: 'peer.brave', label: 'Brave Pick', description: 'Took on a hard song and owned it', icon: 'Flame', givenBy: 'singer', givenTo: 'singer' },
  { key: 'peer.vibes', label: 'Good Vibes', description: 'Makes newcomers feel welcome', icon: 'Smile', givenBy: 'singer', givenTo: 'singer' },
  // Singer -> KJ
  { key: 'kjfan.fair', label: 'Fair Rotation', description: 'Everyone gets their turn', icon: 'Scale', givenBy: 'singer', givenTo: 'kj' },
  { key: 'kjfan.sound', label: 'Great Sound', description: 'Mix and levels on point', icon: 'Volume2', givenBy: 'singer', givenTo: 'kj' },
  { key: 'kjfan.hype', label: 'Hype Host', description: 'Makes every singer feel like a star', icon: 'Sparkles', givenBy: 'singer', givenTo: 'kj' },
  { key: 'kjfan.songbook', label: 'Deep Songbook', description: 'Has the song you were hoping for', icon: 'BookOpen', givenBy: 'singer', givenTo: 'kj' },
  // Singer -> Venue
  { key: 'venue.vibe', label: 'Great Vibe', description: 'A room you want to sing in', icon: 'PartyPopper', givenBy: 'singer', givenTo: 'venue' },
  { key: 'venue.drinks', label: 'Good Drinks', description: 'Specials worth showing up for', icon: 'Martini', givenBy: 'singer', givenTo: 'venue' },
  { key: 'venue.sound', label: 'Great Sound System', description: 'Mics and speakers that do you justice', icon: 'Volume2', givenBy: 'singer', givenTo: 'venue' },
  { key: 'venue.staff', label: 'Friendly Staff', description: 'Bartenders and servers who get karaoke', icon: 'HeartHandshake', givenBy: 'singer', givenTo: 'venue' },
  { key: 'venue.safe', label: 'Feels Safe', description: 'Welcoming to everyone', icon: 'ShieldCheck', givenBy: 'singer', givenTo: 'venue' },
  // Growth loop
  { key: 'growth.scene-builder', label: 'Scene Builder', description: 'Brought new people into the scene with their QR code', icon: 'QrCode', givenBy: 'system', givenTo: 'singer' },
  { key: 'growth.kj-ambassador', label: 'Scene Ambassador', description: 'Grew the scene by sharing their QR card', icon: 'Megaphone', givenBy: 'system', givenTo: 'kj' },
];

export const badgeByKey = new Map(BADGES.map((b) => [b.key, b]));

export type Tier = 'bronze' | 'silver' | 'gold';
export const tierFor = (count: number): Tier => (count >= 15 ? 'gold' : count >= 5 ? 'silver' : 'bronze');
