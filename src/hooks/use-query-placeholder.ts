/**
 * TanStack Query v5: prefer `isPending` — true only until the first successful result
 * (no cached data). Refetches keep showing previous data; no skeleton flash.
 */
export function useQueryPlaceholder(isPending: boolean) {
  return {
    showSkeleton: isPending,
  };
}
