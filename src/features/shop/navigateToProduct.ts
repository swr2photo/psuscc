import { router } from 'expo-router';
import { isValidProductRouteId } from '@/hooks/use-shop-product-route-id';

/** Navigate to product detail — string path keeps the real UUID in the URL on web. */
export function navigateToShopProduct(productId: string) {
  const id = productId?.trim();
  if (!id || id === 'undefined' || id === 'null' || !isValidProductRouteId(id)) {
    console.warn('Attempted to navigate to invalid productId:', productId);
    return;
  }
  router.push(`/store/product/${id}`);
}
