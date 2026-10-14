/** Mirrors VENUE_TYPES in the API schema. */
export const VENUE_TYPES = ['Bar', 'Lounge', 'Restaurant', 'Karaoke Booths', 'Live Band Karaoke', 'Full Time Karaoke'] as const;
export type VenueType = (typeof VENUE_TYPES)[number];
