import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { decode } from 'base64-arraybuffer';

interface SlipPayload {
  uri: string;
  name: string;
  type: string;
  base64?: string;
  size: string; // รับค่าไซส์จาก Zustand
}

export const useUploadSlip = () => {
  return useMutation({
    mutationFn: async (slip: SlipPayload) => {
      console.log('Uploading slip to Supabase...', slip.name);
      
      // 1. Upload to Supabase Storage (using base64 for React Native compatibility)
      let publicUrl = '';
      if (slip.base64) {
        const filePath = `slips/${Date.now()}-${slip.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('slips')
          .upload(filePath, decode(slip.base64), {
            contentType: slip.type,
          });

        if (uploadError) {
          throw new Error(`Upload failed: ${uploadError.message}`);
        }

        // Get public URL
        const { data } = supabase.storage.from('slips').getPublicUrl(filePath);
        publicUrl = data.publicUrl;
      } else {
        throw new Error('No base64 image data provided');
      }

      // 2. Insert record into orders table
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert([
          {
            size: slip.size,
            slip_url: publicUrl,
            status: 'pending',
          },
        ])
        .select()
        .single();

      if (orderError) {
        throw new Error(`Database insert failed: ${orderError.message}`);
      }

      return orderData;
    },
    onSuccess: (data) => {
      console.log('Order created successfully!', data);
    },
  });
};

