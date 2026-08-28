import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { ShopUserAddress } from '../types';

export function useShopAddresses() {
  return useQuery({
    queryKey: ['shop', 'addresses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shop_user_addresses')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ShopUserAddress[];
    },
  });
}

export function useSaveShopAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<ShopUserAddress, 'id' | 'user_id' | 'created_at' | 'updated_at'> & { id?: string }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('login_required');

      const row = {
        user_id: user.id,
        full_name: payload.full_name,
        phone: payload.phone,
        address_line: payload.address_line,
        province_id: payload.province_id,
        district_id: payload.district_id,
        subdistrict_id: payload.subdistrict_id,
        province_name: payload.province_name,
        district_name: payload.district_name,
        subdistrict_name: payload.subdistrict_name,
        postal_code: payload.postal_code,
        is_default: payload.is_default ?? false,
      };

      if (payload.id) {
        const { error } = await supabase.from('shop_user_addresses').update(row).eq('id', payload.id);
        if (error) throw error;
        return payload.id;
      }

      const { data, error } = await supabase.from('shop_user_addresses').insert(row).select('id').single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shop', 'addresses'] }),
  });
}
