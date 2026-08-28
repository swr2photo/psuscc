import type { AppTheme } from '@/hooks/use-theme';

export type ChatThemeKey = 'default' | 'ocean' | 'rose' | 'noir' | 'mint';

export const CHAT_THEME_LABELS: Record<ChatThemeKey, string> = {
  default: 'ค่าเริ่มระบบ',
  ocean: 'มหาสมุทร',
  rose: 'ซากุระ',
  noir: 'กลางคืนเข้ม',
  mint: 'ไดโนเขียวสดใส',
};

export interface ChatBubbleTheme {
  surfaceChat: string;
  bubbleMe: string;
  bubbleOther: string;
  bubbleOtherText: string;
  inputBg: string;
  hairline: string;
  accent: string;
  text: string;
  muted: string;
  /** พื้นหลังรวมเมื่อธีมแชท override (แทนสีดำจาก isDark เดิม) */
  pageBg: string;
  /** ไล่สีพื้นหลังพื้นที่ข้อความ (ว่างเมื่อเป็น default IG) */
  wallpaperGradient?: readonly [string, string];
  /** อีโมจิตกแต่งกลางจอแบบจางๆ (สไตล์ธีมห้องแชท IG) */
  wallpaperEmoji?: string;
}

/** สำหรับแถวเลือกธีมในหน้าตั้งค่า — ชิปพรีวิวโทนเดียวกับห้องแชท */
export function chatThemeRowPreview(themeKey: ChatThemeKey): readonly [string, string] {
  switch (themeKey) {
    case 'default':
      return ['#0095F6', '#E8F5FF'];
    case 'ocean':
      return ['#0369a1', '#082f49'];
    case 'rose':
      return ['#be185d', '#4a0625'];
    case 'noir':
      return ['#525252', '#171717'];
    case 'mint':
      return ['#4ade80', '#166534'];
    default:
      return ['#71717a', '#18181b'];
  }
}

/** ธีมแชทแยกจากธีมแอป — เก็บเฉพาะบนครื่อง */
export function resolveChatTheme(
  scheme: ChatThemeKey,
  appTheme: AppTheme,
  globalIsDark: boolean,
): ChatBubbleTheme {
  if (scheme === 'default') {
    return {
      surfaceChat: globalIsDark ? '#000000' : '#FFFFFF',
      bubbleMe: '#0095F6',
      bubbleOther: globalIsDark ? '#262626' : '#EFEFEF',
      bubbleOtherText: globalIsDark ? '#F5F5F5' : '#000000',
      inputBg: globalIsDark ? '#262626' : '#EFEFEF',
      hairline: globalIsDark ? '#2A2A2A' : '#DBDBDB',
      accent: '#0095F6',
      text: globalIsDark ? '#FFFFFF' : '#000000',
      muted: globalIsDark ? '#8E8E93' : '#8E8E93',
      pageBg: globalIsDark ? appTheme.background : appTheme.background,
    };
  }

  switch (scheme) {
    case 'ocean':
      return {
        surfaceChat: '#071525',
        bubbleMe: '#0ea5e9',
        bubbleOther: '#0f2744',
        bubbleOtherText: '#e2f6ff',
        inputBg: '#0c2138',
        hairline: '#1e3a5f',
        accent: '#38bdf8',
        text: '#e2f6ff',
        muted: '#38bdf8',
        pageBg: '#04101d',
        wallpaperGradient: ['#082f49', '#04101d'],
      };
    case 'rose':
      return {
        surfaceChat: '#1a0f14',
        bubbleMe: '#e11d74',
        bubbleOther: '#2d1720',
        bubbleOtherText: '#ffeef5',
        inputBg: '#2a161f',
        hairline: '#4a2734',
        accent: '#f472b6',
        text: '#ffeef5',
        muted: '#f472b6',
        pageBg: '#120a10',
        wallpaperGradient: ['#3d1730', '#120a10'],
      };
    case 'mint':
      return {
        surfaceChat: '#ecfdf3',
        bubbleMe: '#166534',
        bubbleOther: 'rgba(255,255,255,0.92)',
        bubbleOtherText: '#14532d',
        inputBg: 'rgba(255,255,255,0.9)',
        hairline: 'rgba(22,101,52,0.2)',
        accent: '#22c55e',
        text: '#14532d',
        muted: '#22c55e',
        pageBg: '#bbf7d0',
        wallpaperGradient: ['#d9f99d', '#86efac'],
        wallpaperEmoji: '🦕',
      };
    case 'noir':
    default:
      return {
        surfaceChat: '#0a0a0a',
        bubbleMe: '#a3a3a3',
        bubbleOther: '#171717',
        bubbleOtherText: '#fafafa',
        inputBg: '#141414',
        hairline: '#262626',
        accent: '#d4d4d4',
        text: '#fafafa',
        muted: '#a3a3a3',
        pageBg: '#050505',
        wallpaperGradient: ['#171717', '#050505'],
      };
  }
}
