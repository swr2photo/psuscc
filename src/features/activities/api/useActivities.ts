import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { publicCatalogQueryOptions } from '@/lib/publicQueryOptions';
import { useEffect } from 'react';

export interface Event {
  id: string;
  title: string;
  description: string;
  location: string;
  map_url?: string;
  location_lat?: number | null;
  location_lng?: number | null;
  location_place_id?: string | null;
  price: number;
  capacity: number;
  current_participants: number; // ใช้คอลัมน์ใหม่จาก DB
  start_date: string;
  end_date: string;
  reg_start_date: string;
  reg_end_date: string;
  cover_url?: string;
  detail_image_url?: string;
  category?: string;
  schedule?: any;
  status: 'open' | 'closed';
  created_at: string;
  cert_template_url?: string;
  cert_name_x?: number;
  cert_name_y?: number;
  cert_font_size?: number;
  cert_name_color?: string;
  cert_show_prefix?: boolean;
  cert_is_bold?: boolean;
  cert_release_date?: string;
  cert_design?: CertDesign | null;
  chat_type?: 'none' | 'internal' | 'external';
  chat_link?: string;
  /** ชื่อ/รูปแสดงในแชทกลุ่ม (override) */
  chat_room_display_name?: string | null;
  chat_room_photo_url?: string | null;
  /** เช็กอินสำเร็จได้สูงสุดกี่ครั้งต่อคนในค่ายนี้ (รวมทุก QR); null = ไม่จำกัด */
  max_checkins_per_user?: number | null;
}

export type CertLayoutStyle = 'classic' | 'modern' | 'elegant' | 'minimal' | 'festival';
export type CertFontFamily = 'default' | 'serif' | 'mono';
export type CertDateFormat = 'thai' | 'eng' | 'short';

export interface CertTextLayer {
  show: boolean;
  text?: string;
  x: number;
  y: number;
  size: number;
  color: string;
  bold?: boolean;
  italic?: boolean;
}

export interface CertDateLayer extends CertTextLayer {
  format: CertDateFormat;
}

export interface CertCustomLayer extends CertTextLayer {
  id: string;
  label?: string;
}

export interface CertDesign {
  layoutStyle: CertLayoutStyle;
  fontFamily: CertFontFamily;
  nameItalic?: boolean;
  subtitle: CertTextLayer;
  eventTitle: CertTextLayer;
  date: CertDateLayer;
  signature: CertTextLayer;
  customLayers?: CertCustomLayer[];
}

export const useActivities = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    // 🔔 Unique channel name per hook instance to avoid collisions
    const channelId = `events-${Math.random().toString(36).substr(2, 9)}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events' },
        (payload) => {
          console.log('Realtime change in events:', payload);
          queryClient.invalidateQueries({ queryKey: ['activities'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery<Event[]>({
    queryKey: ['activities'],
    ...publicCatalogQueryOptions,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });
};

