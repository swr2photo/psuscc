import { useState, useEffect } from 'react';
import { View, Text, TextInput, Alert, ScrollView, ActivityIndicator, Image, FlatList, Platform, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Send, Megaphone, BellRing, Users, User, CheckCircle2 } from 'lucide-react-native';
import { BackButton } from '@/components/ui/back-button';
import { notifyMultipleUsers } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function AdminNotificationScreen() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);

  useEffect(() => {
    fetchUsersWithTokens();
  }, []);

  const fetchUsersWithTokens = async () => {
    setIsLoadingUsers(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, email, expo_push_token, notifications_enabled')
        .not('expo_push_token', 'is', null)
        .eq('notifications_enabled', true);

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleBroadcast = async () => {
    if (!title || !body) {
      const msg = 'กรุณากรอกหัวข้อและข้อความประกาศ';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('ข้อมูลไม่ครบ', msg);
      }
      return;
    }

    if (users.length === 0) {
      const msg = 'เนื่องจากยังไม่มีผู้ใช้คนใดที่ใช้งานผ่านมือถือเครื่องจริงและลงทะเบียนแจ้งเตือนไว้ในระบบครับ\n\n(การใช้งานบน Web ไม่รองรับระบบนี้)';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('ไม่สามารถส่งได้', msg);
      }
      return;
    }

    setIsSending(true);
    try {
      await notifyMultipleUsers(
        users.map((u) => ({ id: u.id, expo_push_token: u.expo_push_token })),
        title,
        body,
        { type: 'broadcast' }
      );

      const successMsg = `ส่งประกาศถึงผู้ใช้ ${users.length} คนเรียบร้อยแล้ว`;
      if (Platform.OS === 'web') {
        window.alert(successMsg);
      } else {
        Alert.alert('สำเร็จ!', successMsg);
      }
      setTitle('');
      setBody('');
    } catch (error: any) {
      console.error(error);
      const errorMsg = error.message || 'ไม่สามารถส่งการแจ้งเตือนได้';
      if (Platform.OS === 'web') {
        window.alert(errorMsg);
      } else {
        Alert.alert('เกิดข้อผิดพลาด', errorMsg);
      }
    } finally {
      setIsSending(false);
    }
  };

  const renderUserItem = ({ item }: { item: any }) => (
    <View className="flex-row items-center gap-3 mb-3 bg-zinc-50 p-2 rounded-xl border border-zinc-100">
      <View className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center overflow-hidden">
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} className="w-full h-full" />
        ) : (
          <User size={20} color="#3b82f6" />
        )}
      </View>
      <View className="flex-1">
        <Text className="text-sm font-bold text-zinc-900" numberOfLines={1}>{item.full_name || 'ไม่ระบุชื่อ'}</Text>
        <Text className="text-[10px] text-zinc-500" numberOfLines={1}>{item.email}</Text>
      </View>
      <Badge variant="secondary" className="bg-green-100 border-green-200">
        <Text className="text-[9px] text-green-700 font-bold">READY</Text>
      </Badge>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-6 pt-6">
        <View className="flex-row items-center justify-between mb-6">
          <View className="flex-row items-center">
            <BackButton className="mr-2 p-2 bg-zinc-100 rounded-full" onPress={() => router.back()} />
            <Text className="text-2xl font-bold">ส่งประกาศใหม่</Text>
          </View>
          <Badge variant="outline" className="border-blue-200 bg-blue-50">
            <Text className="text-blue-600 font-bold">{users.length} Users</Text>
          </Badge>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
          <Card className="mb-6 border-blue-100 bg-blue-50/30">
            <CardHeader className="pb-4">
              <View className="flex-row items-center gap-2">
                <Megaphone size={20} color="#3b82f6" />
                <CardTitle className="text-base font-bold text-blue-900">ระบบประกาศแจ้งเตือน</CardTitle>
              </View>
              <CardDescription className="text-xs text-blue-700">
                ข้อความนี้จะถูกส่งไปยังอุปกรณ์มือถือของผู้ใช้ทุกคนที่ลงทะเบียนแจ้งเตือนไว้
              </CardDescription>
            </CardHeader>
          </Card>

          <View className="gap-5">
            <View>
              <Text className="text-sm font-bold mb-2 ml-1">หัวข้อประกาศ</Text>
              <TextInput
                className="bg-white border border-zinc-200 rounded-xl px-4 py-3 text-zinc-900 shadow-sm"
                placeholder="ระบุหัวข้อ (เช่น แจ้งปรับปรุงระบบ)"
                value={title}
                onChangeText={setTitle}
                placeholderTextColor="#94a3b8"
              />
            </View>

            <View>
              <Text className="text-sm font-bold mb-2 ml-1">ข้อความรายละเอียด</Text>
              <TextInput
                className="bg-white border border-zinc-200 rounded-xl px-4 py-3 text-zinc-900 min-h-[120] shadow-sm"
                placeholder="ระบุรายละเอียดที่คุณต้องการแจ้งให้ผู้ใช้ทราบ..."
                value={body}
                onChangeText={setBody}
                multiline
                textAlignVertical="top"
                placeholderTextColor="#94a3b8"
              />
            </View>

            <View className="mt-2">
              <Text className="text-sm font-bold mb-3 ml-1 flex-row items-center">
                รายชื่อผู้รับแจ้งเตือน <Text className="text-zinc-400 font-normal">({users.length})</Text>
              </Text>
              {isLoadingUsers ? (
                <ActivityIndicator color="#3b82f6" />
              ) : (
                <View>
                  {users.length > 0 ? (
                    users.slice(0, 5).map(user => (
                      <View key={user.id}>{renderUserItem({ item: user })}</View>
                    ))
                  ) : (
                    <Text className="text-xs text-zinc-400 italic ml-1">ยังไม่มีผู้ใช้ที่รองรับการแจ้งเตือน</Text>
                  )}
                  {users.length > 5 && (
                    <Text className="text-[10px] text-zinc-400 text-center italic">... และคนอื่นๆ อีก {users.length - 5} คน</Text>
                  )}
                </View>
              )}
            </View>

            <Button 
              variant="default" 
              size="lg" 
              className="h-14 rounded-2xl mt-4 bg-zinc-900"
              onPress={handleBroadcast}
              loading={isSending}
            >
              <View className="flex-row items-center gap-2">
                <Text className="text-white font-bold text-lg">ส่งประกาศทันที</Text>
                <Send size={20} color="white" />
              </View>
            </Button>
          </View>

          <View className="mt-10 mb-10 items-center">
            <View className="w-12 h-12 rounded-full bg-zinc-100 items-center justify-center mb-2">
              <BellRing size={24} color="#64748b" />
            </View>
            <Text className="text-zinc-400 text-[10px] text-center px-10">
              การแจ้งเตือนจะใช้เวลา 1-3 วินาทีในการเดินทางไปยังอุปกรณ์ของผู้ใช้{"\n"}ขึ้นอยู่กับการเชื่อมต่ออินเทอร์เน็ตของแต่ละเครื่อง
            </Text>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
