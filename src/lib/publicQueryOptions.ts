import { Platform } from 'react-native';

/** Guest-visible catalog queries: always refetch on mount (avoid stale empty persisted cache on web). */
export const publicCatalogQueryOptions = {
  refetchOnMount: 'always' as const,
  staleTime: 60_000,
  ...(Platform.OS === 'web' ? { networkMode: 'always' as const } : {}),
};
