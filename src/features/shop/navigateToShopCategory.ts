import { router } from 'expo-router';

export function navigateToShopCategory(slug: string) {
  router.push(`/store/category/${encodeURIComponent(slug)}`);
}
