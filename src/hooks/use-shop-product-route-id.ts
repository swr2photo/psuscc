import { useGlobalSearchParams, useLocalSearchParams, usePathname, useSegments } from 'expo-router';
import { useMemo } from 'react';
import { normalizeRouteParam } from '@/lib/utils';

/** Reject unresolved dynamic segment placeholders from Expo Router. */
export function isValidProductRouteId(id: string | undefined): boolean {
  if (!id) return false;
  const t = id.trim().toLowerCase();
  if (!t || t === '[id]' || t === 'undefined' || t === 'null' || /[[\]]/.test(t)) return false;
  return true;
}

/** `/store/product/:id` — works when `useLocalSearchParams().id` is empty on web. */
export function productIdFromPathname(pathname: string): string | undefined {
  const match = pathname.match(/\/product\/([^/?#]+)/i);
  if (!match?.[1]) return undefined;
  try {
    return normalizeRouteParam(decodeURIComponent(match[1]));
  } catch {
    return normalizeRouteParam(match[1]);
  }
}

export function productIdFromSegments(segments: string[]): string | undefined {
  const parts = segments.filter((s) => s && !s.startsWith('('));
  const idx = parts.lastIndexOf('product');
  if (idx < 0 || idx >= parts.length - 1) return undefined;
  return normalizeRouteParam(parts[idx + 1]);
}

/**
 * Resolve shop product id from Expo Router (local + global params, pathname, segments).
 */
export function useShopProductRouteId(): string | undefined {
  const local = useLocalSearchParams<{ id?: string | string[] }>();
  const global = useGlobalSearchParams<{ id?: string | string[] }>();
  const pathname = usePathname();
  const segments = useSegments();

  return useMemo(() => {
    const candidates = [
      normalizeRouteParam(local.id),
      normalizeRouteParam(global.id),
      productIdFromPathname(pathname),
      productIdFromSegments(segments as string[]),
    ];
    for (const c of candidates) {
      if (isValidProductRouteId(c)) return c;
    }
    return undefined;
  }, [local.id, global.id, pathname, segments]);
}
