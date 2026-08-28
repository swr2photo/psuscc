import type { HomeCapturedMedia, HomeMediaPickMode } from './homeMedia';

let pendingMedia: HomeCapturedMedia | null = null;
let pendingMode: HomeMediaPickMode | null = null;
let pendingStep: 'preview' | 'compose' | null = null;

export function setHomeCreateDraft(
  media: HomeCapturedMedia,
  mode: HomeMediaPickMode,
  step: 'preview' | 'compose' = 'compose',
) {
  pendingMedia = media;
  pendingMode = mode;
  pendingStep = step;
}

/** อ่าน draft โดยไม่ล้าง — ใช้กู้คืนหลังกล้อง native ทำให้หน้าจอรีโมונต */
export function peekHomeCreateDraft(): {
  media: HomeCapturedMedia;
  mode: HomeMediaPickMode;
  step: 'preview' | 'compose';
} | null {
  if (!pendingMedia || !pendingMode) return null;
  return {
    media: pendingMedia,
    mode: pendingMode,
    step: pendingStep ?? 'compose',
  };
}

export function consumeHomeCreateDraft(): {
  media: HomeCapturedMedia;
  mode: HomeMediaPickMode;
  step: 'preview' | 'compose';
} | null {
  const draft = peekHomeCreateDraft();
  if (!draft) return null;
  pendingMedia = null;
  pendingMode = null;
  pendingStep = null;
  return draft;
}

export function clearHomeCreateDraft() {
  pendingMedia = null;
  pendingMode = null;
  pendingStep = null;
}
