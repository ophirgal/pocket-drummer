/** Design tokens: the app is dark-only, so colours are fixed rather than theme-dependent. */
export const colors = {
  bg: '#0B0A1A',
  bgTop: '#17123A',
  surface: '#15132B',
  card: '#1B1838',
  cardRaised: '#24204A',
  border: '#2E2A5A',
  text: '#F4F2FF',
  textMuted: '#A29DC8',
  textDim: '#6F6A99',
  primary: '#8B6CF6',
  primaryBright: '#A68BFF',
  primaryDeep: '#5B3FD6',
  primaryText: '#120C2E',
  teal: '#3FE0D0',
  onTime: '#34D399',
  rushed: '#F472B6',
  dragged: '#60A5FA',
  pocket: 'rgba(139,108,246,0.18)',
  gold: '#FBBF24',
  danger: '#F87171',
};

export const radius = { sm: 10, md: 16, lg: 22, pill: 999 };
export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

export type HitClass = 'onTime' | 'rushed' | 'dragged';

export const classColor: Record<HitClass, string> = {
  onTime: colors.onTime,
  rushed: colors.rushed,
  dragged: colors.dragged,
};

/** Green for good scores (75+), gold for middling (50+), pink below. */
export function scoreColor(score: number): string {
  if (score >= 75) return colors.onTime;
  if (score >= 50) return colors.gold;
  return colors.rushed;
}
