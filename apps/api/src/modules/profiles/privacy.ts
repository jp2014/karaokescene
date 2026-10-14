import type { PrivacySettings } from '../../db/schema.ts';

export const DEFAULT_PRIVACY: PrivacySettings = {
  hometown: 'everyone',
  ageRange: 'friends',
  favoriteNight: 'everyone',
  yearsSinging: 'everyone',
  proStatus: 'everyone',
  songList: 'friends',
};
