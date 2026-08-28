export type ShopProductType = 'simple' | 'apparel';

export type ShopOrderStatus =
  | 'pending_payment'
  | 'payment_review'
  | 'paid'
  | 'fulfilling'
  | 'shipped'
  | 'completed'
  | 'cancelled'
  | 'payment_failed';

export interface ShopCategory {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
}

export interface ShopProductVariant {
  id: string;
  product_id: string;
  size_label: string | null;
  price: number;
  sku: string | null;
  stock_quantity: number;
  low_stock_threshold: number | null;
}

export interface ShopProduct {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  product_type: ShopProductType;
  base_price: number | null;
  image_urls: string[];
  sale_starts_at: string | null;
  sale_ends_at: string | null;
  is_published: boolean;
  created_at?: string;
  units_sold?: number;
  rating_avg?: number | null;
  review_count?: number;
  shop_product_variants?: ShopProductVariant[];
  shop_categories?: Pick<ShopCategory, 'id' | 'name' | 'slug'> | null;
}

export interface ShopProductReview {
  id: string;
  product_id: string;
  user_id: string;
  order_id: string;
  variant_id: string | null;
  rating: number;
  body: string | null;
  variant_label: string | null;
  reviewer_display_name: string;
  helpful_count: number;
  created_at: string;
}

export interface ShopCartItem {
  id: string;
  cart_id: string;
  variant_id: string;
  quantity: number;
  shop_product_variants: ShopProductVariant & {
    shop_products: Pick<ShopProduct, 'id' | 'name' | 'image_urls' | 'product_type'>;
  };
}

export interface ShopShippingMethod {
  id: string;
  code: string;
  name: string;
  base_fee: number;
  free_over_amount: number | null;
  is_active: boolean;
}

export interface ShopUserAddress {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  address_line: string;
  province_id: number | null;
  district_id: number | null;
  subdistrict_id: number | null;
  province_name: string | null;
  district_name: string | null;
  subdistrict_name: string | null;
  postal_code: string | null;
  is_default: boolean;
}

export interface ShopOrder {
  id: string;
  user_id: string;
  status: ShopOrderStatus;
  subtotal: number;
  shipping_fee: number;
  total: number;
  shipping_method_id: string | null;
  user_address_id: string | null;
  slip_url: string | null;
  payment_verified_at: string | null;
  created_at: string;
  shop_shipping_methods?: ShopShippingMethod | null;
  shop_user_addresses?: ShopUserAddress | null;
  shop_shipments?: Pick<ShopShipment, 'tracking_number' | 'last_status' | 'updated_at'> | null;
}

export interface ShopOrderItem {
  id: string;
  order_id: string;
  product_id: string;
  variant_id: string;
  quantity: number;
  unit_price: number;
  shop_products?: Pick<ShopProduct, 'name' | 'image_urls'> | null;
  shop_product_variants?: ShopProductVariant | null;
}

export interface ShopShipment {
  id: string;
  order_id: string;
  tracking_number: string | null;
  carrier: string;
  last_status: string | null;
  raw_response: unknown;
  updated_at: string;
}
