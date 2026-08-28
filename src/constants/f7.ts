/** Framework7 iOS design tokens (visual parity, not the F7 library). */
export const F7 = {
  radius: {
    list: 10,
    card: 10,
    button: 8,
    sheet: 13,
  },
  list: {
    rowMinHeight: 44,
    rowPaddingH: 16,
    mediaSize: 29,
    chevronSize: 20,
    insetMarginH: 16,
    blockTitleSize: 13,
    titleSize: 17,
    subtitleSize: 15,
  },
  navbar: {
    titleSize: 17,
    largeTitleSize: 34,
  },
  colors: {
    iosBlue: '#007AFF',
    iosRed: '#FF3B30',
    iosGreen: '#34C759',
    pageBgLight: '#EFEFF4',
    pageBgDark: '#000000',
    separatorLight: 'rgba(60, 60, 67, 0.29)',
    separatorDark: 'rgba(84, 84, 88, 0.65)',
  },
} as const;
