// Same tokens as the web app (src/app/globals.css). Components read these, never raw hex.

export type ColorTokens = {
  page: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  fg: string;
  fgMuted: string;
  accent: string;
  accentFg: string;
  action: string;
  actionFg: string;
  link: string;
  rafa: string;
  reportedBg: string;
  reportedFg: string;
  claimedBg: string;
  claimedFg: string;
  healingBg: string;
  healingFg: string;
  resolvedBg: string;
  resolvedFg: string;
  bannerBg: string;
  bannerFg: string;
  /** Dimmed backdrop behind sheets */
  scrim: string;
  /** Text and icons drawn on the scrim or over photos */
  onScrim: string;
  /** Behind the live camera preview */
  camera: string;
};

export const light: ColorTokens = {
  page: '#F6F4EE',
  surface: '#FFFFFF',
  surfaceMuted: '#EBF0EA',
  border: '#E3E7E0',
  fg: '#142019',
  fgMuted: '#57685D',
  accent: '#F04438',
  accentFg: '#FFFFFF',
  action: '#0F766E',
  actionFg: '#FFFFFF',
  link: '#0F766E',
  rafa: '#0F766E',
  reportedBg: '#FEECEB',
  reportedFg: '#B91C1C',
  claimedBg: '#FEF3C7',
  claimedFg: '#92400E',
  healingBg: '#E6F7F0',
  healingFg: '#0D7A55',
  resolvedBg: '#DCFCE7',
  resolvedFg: '#15803D',
  bannerBg: '#FEF3C7',
  bannerFg: '#92400E',
  scrim: 'rgba(0,0,0,0.6)',
  onScrim: '#FFFFFF',
  camera: '#000000',
};

export const dark: ColorTokens = {
  page: '#0E1411',
  surface: '#161E1A',
  surfaceMuted: '#1F2923',
  border: '#28342D',
  fg: '#F2F5F3',
  fgMuted: '#93A69A',
  accent: '#FF5347',
  accentFg: '#FFFFFF',
  action: '#2DD4BF',
  actionFg: '#042F2E',
  link: '#34D399',
  rafa: '#2DD4BF',
  reportedBg: '#361517',
  reportedFg: '#FF9B94',
  claimedBg: '#382508',
  claimedFg: '#FCD34D',
  healingBg: '#0F2E22',
  healingFg: '#6EE7B7',
  resolvedBg: '#0E321C',
  resolvedFg: '#86EFAC',
  bannerBg: '#382508',
  bannerFg: '#FCD34D',
  scrim: 'rgba(0,0,0,0.6)',
  onScrim: '#FFFFFF',
  camera: '#000000',
};

/** Type scale from DESIGN.md: 12 / 14 / 16 / 22, weights 400 / 600. Nothing under 12. */
export const type = {
  caption: 12,
  body: 14,
  title: 16,
  display: 22,
} as const;

export const weight = {
  regular: '400',
  semibold: '600',
} as const;

/** Bricolage Grotesque for brand headings; body text uses the system font. */
export const brandFont = 'BricolageGrotesque_600SemiBold';

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, full: 999 } as const;

/** Primary 48, secondary 44, tap targets never under 44. */
export const size = { primary: 48, secondary: 44, tap: 44 } as const;
