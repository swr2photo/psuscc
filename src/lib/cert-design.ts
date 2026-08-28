import type {
  CertCustomLayer,
  CertDesign,
  CertDateFormat,
  CertFontFamily,
  CertLayoutStyle,
  CertTextLayer,
} from '@/features/activities/api/useActivities';

export const CERT_LAYOUT_OPTIONS: { id: CertLayoutStyle; label: string; description: string }[] = [
  { id: 'classic', label: 'Classic', description: 'แบบดั้งเดิม โทนเข้ม serif หรูหรา' },
  { id: 'modern', label: 'Modern', description: 'สะอาดตา สี accent น้ำเงิน' },
  { id: 'elegant', label: 'Elegant', description: 'โทนน้ำตาล/ทอง ตัวเอียง' },
  { id: 'minimal', label: 'Minimal', description: 'เรียบง่าย โชว์เฉพาะชื่อ + วันที่' },
  { id: 'festival', label: 'Festival', description: 'สีสันสดใส ม่วง/ชมพู' },
];

export interface PresetNameDefaults {
  color: string;
  size: number;
  bold: boolean;
}

export const LAYOUT_PRESET_NAME_DEFAULTS: Record<CertLayoutStyle, PresetNameDefaults> = {
  classic: { color: '#1F2937', size: 30, bold: true },
  modern: { color: '#0F172A', size: 32, bold: true },
  elegant: { color: '#7C2D12', size: 30, bold: false },
  minimal: { color: '#000000', size: 26, bold: true },
  festival: { color: '#7C3AED', size: 36, bold: true },
};

export const CERT_FONT_OPTIONS: { id: CertFontFamily; label: string }[] = [
  { id: 'default', label: 'System' },
  { id: 'serif', label: 'Serif' },
  { id: 'mono', label: 'Mono' },
];

export const CERT_DATE_FORMAT_OPTIONS: { id: CertDateFormat; label: string; sample: string }[] = [
  { id: 'thai', label: 'ไทย (พ.ศ.)', sample: '8 พฤษภาคม 2569' },
  { id: 'eng', label: 'English', sample: 'May 8, 2026' },
  { id: 'short', label: 'สั้น', sample: '08/05/2026' },
];

export const LAYOUT_PRESETS: Record<CertLayoutStyle, CertDesign> = {
  classic: {
    layoutStyle: 'classic',
    fontFamily: 'serif',
    nameItalic: false,
    subtitle: {
      show: true,
      text: 'ขอมอบเกียรติบัตรนี้ให้ไว้เพื่อแสดงว่า',
      x: 50,
      y: 36,
      size: 14,
      color: '#6B7280',
      italic: true,
    },
    eventTitle: {
      show: true,
      text: '',
      x: 50,
      y: 65,
      size: 16,
      color: '#374151',
      bold: true,
    },
    date: {
      show: true,
      x: 50,
      y: 80,
      size: 12,
      color: '#6B7280',
      format: 'thai',
    },
    signature: {
      show: false,
      text: 'ประธานค่าย',
      x: 80,
      y: 90,
      size: 11,
      color: '#374151',
    },
  },
  modern: {
    layoutStyle: 'modern',
    fontFamily: 'default',
    nameItalic: false,
    subtitle: {
      show: true,
      text: 'AWARDED TO',
      x: 50,
      y: 35,
      size: 11,
      color: '#3B82F6',
      bold: true,
    },
    eventTitle: {
      show: true,
      text: '',
      x: 50,
      y: 62,
      size: 14,
      color: '#1E293B',
      italic: true,
    },
    date: {
      show: true,
      x: 50,
      y: 78,
      size: 11,
      color: '#64748B',
      format: 'eng',
    },
    signature: {
      show: false,
      text: 'Director',
      x: 80,
      y: 88,
      size: 11,
      color: '#1E293B',
    },
  },
  elegant: {
    layoutStyle: 'elegant',
    fontFamily: 'serif',
    nameItalic: true,
    subtitle: {
      show: true,
      text: 'ใบประกาศนียบัตรนี้มอบให้แก่',
      x: 50,
      y: 38,
      size: 13,
      color: '#92400E',
      italic: true,
    },
    eventTitle: {
      show: true,
      text: '',
      x: 50,
      y: 62,
      size: 15,
      color: '#7C2D12',
      bold: true,
    },
    date: {
      show: true,
      x: 50,
      y: 78,
      size: 12,
      color: '#A16207',
      format: 'thai',
    },
    signature: {
      show: true,
      text: 'ประธานค่าย',
      x: 78,
      y: 88,
      size: 11,
      color: '#7C2D12',
      italic: true,
    },
  },
  minimal: {
    layoutStyle: 'minimal',
    fontFamily: 'default',
    nameItalic: false,
    subtitle: {
      show: false,
      text: '',
      x: 50,
      y: 40,
      size: 12,
      color: '#6B7280',
    },
    eventTitle: {
      show: false,
      text: '',
      x: 50,
      y: 60,
      size: 14,
      color: '#374151',
    },
    date: {
      show: true,
      x: 50,
      y: 70,
      size: 10,
      color: '#9CA3AF',
      format: 'short',
    },
    signature: {
      show: false,
      text: '',
      x: 50,
      y: 88,
      size: 11,
      color: '#374151',
    },
  },
  festival: {
    layoutStyle: 'festival',
    fontFamily: 'default',
    nameItalic: false,
    subtitle: {
      show: true,
      text: 'ขอแสดงความยินดีกับ',
      x: 50,
      y: 36,
      size: 14,
      color: '#EC4899',
      bold: true,
    },
    eventTitle: {
      show: true,
      text: '',
      x: 50,
      y: 64,
      size: 18,
      color: '#9333EA',
      bold: true,
    },
    date: {
      show: true,
      x: 50,
      y: 80,
      size: 12,
      color: '#A855F7',
      format: 'thai',
    },
    signature: {
      show: false,
      text: '',
      x: 80,
      y: 90,
      size: 11,
      color: '#7C3AED',
    },
  },
};

export const DEFAULT_CERT_DESIGN: CertDesign = LAYOUT_PRESETS.classic;

function isPlainObject(v: unknown): v is Record<string, any> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

export function getCertDesign(raw: unknown, fallbackTitle?: string): CertDesign {
  const base = LAYOUT_PRESETS.classic;
  if (!isPlainObject(raw)) {
    return Object.assign({}, base, {
      eventTitle: Object.assign({}, base.eventTitle, {
        text: fallbackTitle || base.eventTitle.text || '',
      }),
    });
  }

  const data = raw as Partial<CertDesign>;
  const layoutStyle: CertLayoutStyle =
    data.layoutStyle && (LAYOUT_PRESETS as any)[data.layoutStyle]
      ? (data.layoutStyle as CertLayoutStyle)
      : base.layoutStyle;

  const preset = LAYOUT_PRESETS[layoutStyle] || base;

  const safeSubtitle = isPlainObject(data.subtitle) ? data.subtitle : {};
  const safeEventTitle = isPlainObject(data.eventTitle) ? data.eventTitle : {};
  const safeDate = isPlainObject(data.date) ? data.date : {};
  const safeSignature = isPlainObject(data.signature) ? data.signature : {};

  const customLayers: CertCustomLayer[] = Array.isArray(data.customLayers)
    ? data.customLayers
        .filter(isPlainObject)
        .map((layer, idx) => normalizeCustomLayer(layer as Partial<CertCustomLayer>, idx))
    : [];

  const merged: CertDesign = {
    layoutStyle,
    fontFamily: data.fontFamily ?? preset.fontFamily,
    nameItalic: data.nameItalic ?? preset.nameItalic,
    subtitle: Object.assign({}, preset.subtitle, safeSubtitle),
    eventTitle: Object.assign({}, preset.eventTitle, safeEventTitle),
    date: Object.assign({}, preset.date, safeDate),
    signature: Object.assign({}, preset.signature, safeSignature),
    customLayers,
  };

  if (!merged.eventTitle.text && fallbackTitle) {
    merged.eventTitle = Object.assign({}, merged.eventTitle, { text: fallbackTitle });
  }
  return merged;
}

export function normalizeCustomLayer(
  raw: Partial<CertCustomLayer>,
  index: number = 0,
): CertCustomLayer {
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : generateLayerId(index),
    label: typeof raw.label === 'string' ? raw.label : undefined,
    show: raw.show !== false,
    text: typeof raw.text === 'string' ? raw.text : '',
    x: typeof raw.x === 'number' ? clamp(raw.x, 0, 100) : 50,
    y: typeof raw.y === 'number' ? clamp(raw.y, 0, 100) : 50,
    size: typeof raw.size === 'number' ? clamp(raw.size, 6, 96) : 14,
    color: typeof raw.color === 'string' ? raw.color : '#1F2937',
    bold: !!raw.bold,
    italic: !!raw.italic,
  };
}

export function createCustomLayer(text = '', overrides: Partial<CertCustomLayer> = {}): CertCustomLayer {
  return normalizeCustomLayer({
    id: generateLayerId(),
    show: true,
    text,
    x: 50,
    y: 50,
    size: 14,
    color: '#1F2937',
    bold: false,
    italic: false,
    ...overrides,
  });
}

function generateLayerId(seed: number = 0): string {
  return `layer_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}_${seed}`;
}

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export function getFontFamilyStyle(family: CertFontFamily): { fontFamily?: string } {
  switch (family) {
    case 'serif':
      return { fontFamily: 'serif' };
    case 'mono':
      return { fontFamily: 'monospace' };
    default:
      return {};
  }
}

export function formatCertDate(date: Date, format: CertDateFormat): string {
  const months = [
    'มกราคม',
    'กุมภาพันธ์',
    'มีนาคม',
    'เมษายน',
    'พฤษภาคม',
    'มิถุนายน',
    'กรกฎาคม',
    'สิงหาคม',
    'กันยายน',
    'ตุลาคม',
    'พฤศจิกายน',
    'ธันวาคม',
  ];
  switch (format) {
    case 'thai': {
      const day = date.getDate();
      const month = months[date.getMonth()];
      const year = date.getFullYear() + 543;
      return `${day} ${month} ${year}`;
    }
    case 'eng':
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    case 'short': {
      const dd = String(date.getDate()).padStart(2, '0');
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const yyyy = date.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }
    default:
      return date.toLocaleDateString();
  }
}

export const CERT_COLOR_PALETTE = [
  '#000000',
  '#FFFFFF',
  '#1E293B',
  '#3B82F6',
  '#EF4444',
  '#10B981',
  '#F59E0B',
  '#6366F1',
  '#8B5CF6',
  '#EC4899',
  '#7C2D12',
  '#A16207',
];

export interface ResolvedTextLayer extends CertTextLayer {
  text: string;
}

export function buildLayerText(
  layer: CertTextLayer | undefined,
  fallback: string,
): ResolvedTextLayer | null {
  if (!layer || !layer.show) return null;
  const text = (layer.text ?? '').trim() || fallback;
  if (!text) return null;
  return { ...layer, text };
}
