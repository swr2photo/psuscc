import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addCartItem,
  fetchCartItems,
  removeCartItem,
  setCartItemQuantity,
} from './shopCart';

export function useShopCartQuery() {
  return useQuery({
    queryKey: ['shop', 'cart'],
    queryFn: fetchCartItems,
  });
}

export function useAddToCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ variantId, quantity }: { variantId: string; quantity: number }) =>
      addCartItem(variantId, quantity),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shop', 'cart'] }),
  });
}

export function useUpdateCartQty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) =>
      setCartItemQuantity(itemId, quantity),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shop', 'cart'] }),
  });
}

export function useRemoveCartItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: removeCartItem,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shop', 'cart'] }),
  });
}
