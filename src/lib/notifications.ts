import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

function isValidExpoPushToken(token: string) {
  return token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[');
}

export async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return;
    }
    
    try {
      const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      console.log('Expo Push Token:', token);
    } catch (e) {
      console.log('Error getting push token:', e);
    }
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}

type ExpoPushMessage = {
  to: string;
  sound?: 'default' | null;
  title: string;
  body: string;
  data?: Record<string, any>;
  channelId?: string;
  priority?: 'default' | 'normal' | 'high';
};

function chunk<T>(arr: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

async function postExpoPush(messages: ExpoPushMessage[]) {
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages.length === 1 ? messages[0] : messages),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`Expo push API error: HTTP ${res.status} ${res.statusText}`);
  }

  // When sending a single object, Expo still returns { data: [...] }
  const data = json?.data;
  if (!data) return;

  const tickets = Array.isArray(data) ? data : [data];
  const firstError = tickets.find((t: any) => t?.status === 'error');
  if (firstError) {
    throw new Error(firstError?.message || 'Expo push ticket error');
  }
}

// ฟังก์ชันสำหรับส่งการแจ้งเตือนจริงผ่าน Expo API (รองรับ batch)
export async function sendPushNotification(expoPushToken: string, title: string, body: string, data: Record<string, any> = {}) {
  if (!isValidExpoPushToken(expoPushToken)) {
    throw new Error('Invalid Expo push token');
  }

  await postExpoPush([
    {
      to: expoPushToken,
      sound: 'default',
      title,
      body,
      data,
      channelId: 'default',
      priority: 'high',
    },
  ]);
}

export async function sendPushNotifications(expoPushTokens: string[], title: string, body: string, data: Record<string, any> = {}) {
  const tokens = expoPushTokens.filter(Boolean).filter(isValidExpoPushToken);
  if (tokens.length === 0) return;

  const messages: ExpoPushMessage[] = tokens.map((to) => ({
    to,
    sound: 'default',
    title,
    body,
    data,
    channelId: 'default',
    priority: 'high',
  }));

  // Expo recommends chunking (max 100 per request)
  const batches = chunk(messages, 100);
  for (const batch of batches) {
    await postExpoPush(batch);
  }
}

/**
 * บันทึกการแจ้งเตือนลงฐานข้อมูล
 */
export async function saveNotification(userId: string, title: string, body: string, data: Record<string, unknown> = {}) {
  console.log(`Saving notification to DB for user: ${userId}`);
  const type = typeof data.type === 'string' ? data.type : undefined;
  const row: Record<string, unknown> = {
    user_id: userId,
    title,
    body,
    data,
  };
  
  // Try inserting with all fields
  const fullRow = { ...row };
  if (type) fullRow.type = type;
  fullRow.message = body;

  let { error } = await supabase.from('notifications').insert([fullRow]);
  
  if (error && /column|type|message|schema/i.test(error.message)) {
    // If it failed due to missing columns, try a bare-bones insert
    const minimalRow = { user_id: userId, title, body, data };
    ({ error } = await supabase.from('notifications').insert([minimalRow]));
    
    if (error && /column|body|schema/i.test(error.message)) {
      // One last try with 'message' instead of 'body'
      const legacyRow = { user_id: userId, title, message: body, data };
      ({ error } = await supabase.from('notifications').insert([legacyRow]));
    }
  }

  if (error) {
    console.error('Error saving notification to DB:', error);
  } else {
    console.log('Notification saved to DB successfully');
  }
}

/**
 * ส่งทั้ง Push Notification และบันทึกลงฐานข้อมูล
 */
export async function notifyUser(userId: string, title: string, body: string, data = {}) {
  // 1. บันทึกลงฐานข้อมูลเพื่อให้ดูย้อนหลังได้
  await saveNotification(userId, title, body, data);

  // 2. ดึง Push Token แล้วส่ง (ถ้ามี)
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('expo_push_token')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching push token for user:', userId, error);
  }

  if (profile?.expo_push_token) {
    console.log(`Sending push notification to token: ${profile.expo_push_token}`);
    await sendPushNotification(profile.expo_push_token, title, body, data);
  } else {
    console.log(`No push token found for user: ${userId}`);
  }
}

/**
 * ส่งแจ้งเตือนหาหลายคนพร้อมกัน
 */
export async function notifyMultipleUsers(users: { id: string, expo_push_token?: string }[], title: string, body: string, data = {}) {
  console.log(`Notifying ${users.length} users...`);
  
  // 1. บันทึกลง DB ทุกคน (Batch Insert)
  const notificationsToSave = users.map(u => ({
    user_id: u.id,
    title,
    body,
    data,
  }));

  const { error: dbError } = await supabase
    .from('notifications')
    .insert(notificationsToSave);
  
  if (dbError) console.error('Error batch saving notifications:', dbError);

  // 2. ส่ง Push สำหรับคนที่มี Token
  await sendPushNotifications(
    users.map((u) => u.expo_push_token || '').filter(Boolean),
    title,
    body,
    data as Record<string, any>
  );
  console.log('All notifications processed');
}

export function setupNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}
