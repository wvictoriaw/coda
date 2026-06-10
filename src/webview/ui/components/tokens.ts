export interface TokenSet {
  bg: string;
  bgAlt: string;
  bgCode: string;
  bgInput: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textDimmed: string;
  accent: string;
  accentText: string;
  error: string;
  sectionLine: string;
}

export const lightTokens: TokenSet = {
  bg:            '#f5f1eb',
  bgAlt:         '#edeae3',
  bgCode:        '#e8e3d8',
  bgInput:       '#ede8e0',
  border:        '#eae6e0',
  textPrimary:   '#080f1a',
  textSecondary: '#1a2f50',
  textDimmed:    '#1a2f50',
  accent:        '#8b5e3c',
  accentText:    '#f5f1eb',
  error:         '#8b2a1a',
  sectionLine: '#1a2943',
};

export const darkTokens: TokenSet = {
  bg:            '#1e2430',
  bgAlt:         '#252f3e',
  bgCode:        '#181f2a',
  bgInput:       '#2a3545',
  border:        '#36404e',
  textPrimary:   '#ede0c8',
  textSecondary: '#8896a8',
  textDimmed:    '#8896a8',
  accent:        '#d4a060',
  accentText:    '#f5f1eb',
  error:         '#c4604a',
  sectionLine: '#ede0c8',
};

export function getTokens(theme: 'light' | 'dark'): TokenSet {
  return theme === 'dark' ? darkTokens : lightTokens;
}