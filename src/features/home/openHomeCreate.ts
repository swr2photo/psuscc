import type { Router } from 'expo-router';
import { clearHomeCreateDraft } from './homeCreateDraft';
import type { HomeMediaPickMode } from './homeMedia';

export function openHomeCreate(router: Router, mode: HomeMediaPickMode, useGallery?: boolean) {
  clearHomeCreateDraft();
  const pathname =
    mode === 'post' ? '/(tabs)/home/create-post' : '/(tabs)/home/create-story';
  router.push({ 
    pathname, 
    params: { 
      session: String(Date.now()),
      useGallery: useGallery ? 'true' : undefined
    } 
  });
}
