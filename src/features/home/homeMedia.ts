import type { ImagePickerAsset } from 'expo-image-picker';

export const HOME_VIDEO_MAX_MS = 60_000;

export type HomeMediaPickMode = 'post' | 'story';

export type HomeCapturedMedia = {
  uri: string;
  mediaType: 'image' | 'video';
  width?: number;
  height?: number;
  durationMs?: number;
  mimeType?: string;
  base64?: string;
  clips?: string[];
};

export function isHomeVideo(media: HomeCapturedMedia): boolean {
  return media.mediaType === 'video';
}

export function assetToHomeMedia(asset: ImagePickerAsset): HomeCapturedMedia {
  const isVideo =
    asset.type === 'video' ||
    asset.mimeType?.startsWith('video/') ||
    /\.(mp4|mov|m4v|webm)$/i.test(asset.uri ?? '');

  let durationMs: number | undefined;
  if (typeof asset.duration === 'number' && asset.duration > 0) {
    durationMs = asset.duration < 1000 ? Math.round(asset.duration * 1000) : Math.round(asset.duration);
  }

  return {
    uri: asset.uri,
    mediaType: isVideo ? 'video' : 'image',
    width: asset.width,
    height: asset.height,
    durationMs,
    mimeType: asset.mimeType ?? undefined,
    base64: asset.base64 ?? undefined,
  };
}

export function assertVideoWithinLimit(media: HomeCapturedMedia): void {
  if (media.mediaType !== 'video') return;
  const ms = media.durationMs ?? 0;
  if (ms > HOME_VIDEO_MAX_MS) {
    throw new Error('วิดีโอต้องไม่เกิน 1 นาที');
  }
}

export function formatDurationLabel(ms?: number): string {
  if (!ms || ms <= 0) return '0:00';
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
