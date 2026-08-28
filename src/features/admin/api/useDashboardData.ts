import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export const useDashboardData = () => {
  return useQuery({
    queryKey: ['admin_dashboard'],
    queryFn: async () => {
      console.log('Dashboard: Fetching data...');
      
      // 1. ดึงจำนวนรวม (Counts)
      const { count: totalRegistrations } = await supabase
        .from('event_registrations')
        .select('*', { count: 'exact', head: true });

      const { count: pendingSlips } = await supabase
        .from('event_registrations')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      // 2. ดึงรายการล่าสุด (แบบไม่ Join Profiles ตรงๆ เพื่อป้องกันข้อมูลหาย)
      const { data: rawRegistrations, error: regError } = await supabase
        .from('event_registrations')
        .select(`
          *,
          events ( title )
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      if (regError) throw regError;

      // 3. ดึงข้อมูล Profiles มาแปะทีละรายการ (Resilient Mapping)
      const recentWithProfiles = await Promise.all((rawRegistrations || []).map(async (reg) => {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, email, avatar_url')
          .eq('id', reg.user_id)
          .single();
        
        return {
          ...reg,
          profiles: profile || { full_name: 'รอกรอกข้อมูลโปรไฟล์', email: 'ยังไม่มีข้อมูล', avatar_url: null }
        };
      }));

      console.log('Dashboard: Fetch complete, items:', recentWithProfiles.length);

      return {
        totalRegistrations: totalRegistrations || 0,
        pendingOrders: pendingSlips || 0, // สลิปที่รอเช็ค
        recentRegistrations: recentWithProfiles,
      };
    },
    refetchInterval: 10000,
  });
};
