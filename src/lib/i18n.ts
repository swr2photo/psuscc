import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { mmkvStorage } from '@/lib/mmkv';
import { Platform } from 'react-native';

const resources = {
  en: {
    translation: {
      common: {
        welcome: 'Welcome',
        loading: 'Loading...',
        save: 'Save',
        cancel: 'Cancel',
        logout: 'Log Out',
        admin: 'Admin',
        confirm: 'Confirm',
        view_all: 'View All',
        locale: 'en',
      },
      home: {
        title: 'Home',
        greeting: 'Good Morning ✨',
        my_progress: 'My Activities',
        all_activities: 'All Activities',
        quick_menu: 'Quick Menu',
        search_camp: 'Explore Camps',
        notifications: 'Notifications',
        featured_camp: 'Recommended',
        view_details: 'View Details',
        no_active: 'No registered camps yet',
        no_date: 'Date not specified',
      },
      profile: {
        title: 'Profile',
        edit: 'Edit Profile',
        account_group: 'Account',
        settings_group: 'App Settings',
        support_group: 'Support',
        history: 'Activity History',
        change_password: 'Change Password',
        notifications: 'Notifications',
        dark_mode: 'Dark Mode',
        language: 'Language',
        verified: 'Verified Account',
        store: 'Store',
      },
      merch: {
        select_size: 'Select Size',
        instruction: 'Please select your preferred size',
        current_selection: 'Current Selection',
        not_selected: 'Not selected',
        continue: 'Continue',
      }
    }
  },
  th: {
    translation: {
      common: {
        welcome: 'ยินดีต้อนรับ',
        loading: 'กำลังโหลด...',
        save: 'บันทึกข้อมูล',
        cancel: 'ยกเลิก',
        logout: 'ออกจากระบบ',
        admin: 'แอดมิน',
        confirm: 'ยืนยัน',
        view_all: 'ดูทั้งหมด',
        locale: 'th',
      },
      home: {
        title: 'หน้าหลัก',
        greeting: 'สวัสดีตอนเช้า ✨',
        my_progress: 'กิจกรรมของคุณ',
        all_activities: 'กิจกรรมทั้งหมด',
        quick_menu: 'เมนูเข้าถึงด่วน',
        search_camp: 'สำรวจกิจกรรม',
        notifications: 'แจ้งเตือน',
        featured_camp: 'กิจกรรมแนะนำ',
        view_details: 'ดูรายละเอียด',
        no_active: 'ยังไม่ได้ลงทะเบียนค่ายไหนเลย',
        no_date: 'ยังไม่ระบุวันที่',
      },
      profile: {
        title: 'โปรไฟล์',
        edit: 'แก้ไขโปรไฟล์',
        account_group: 'บัญชีของฉัน',
        settings_group: 'การตั้งค่าแอป',
        support_group: 'สนับสนุน',
        history: 'ประวัติกิจกรรม',
        change_password: 'เปลี่ยนรหัสผ่าน',
        notifications: 'การแจ้งเตือน',
        dark_mode: 'โหมดกลางคืน',
        language: 'ภาษา (Language)',
        verified: 'บัญชีที่ยืนยันแล้ว',
        store: 'ร้านค้า',
      },
      merch: {
        select_size: 'เลือกไซส์เสื้อ',
        instruction: 'กรุณาเลือกไซส์ที่คุณต้องการสั่งซื้อ',
        current_selection: 'ไซส์ที่เลือกปัจจุบัน',
        not_selected: 'ยังไม่ได้เลือก',
        continue: 'ดำเนินการต่อ',
      }
    }
  }
};

const LANGUAGE_KEY = 'app_language';
const isBrowser = typeof window !== 'undefined';

// Initialize i18next immediately so useTranslation hook finds the instance
i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'th', // Default to Thai initially
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    }
  });

export const initI18n = async () => {
  if (!isBrowser && Platform.OS === 'web') return;
  
  try {
    const savedLanguage = await mmkvStorage.getItem(LANGUAGE_KEY);
    if (savedLanguage) {
      await i18n.changeLanguage(savedLanguage);
    }
  } catch (e) {
    console.log('Error loading saved language:', e);
  }
};

export const changeLanguage = async (lang: 'th' | 'en') => {
  await i18n.changeLanguage(lang);
  if (isBrowser || Platform.OS !== 'web') {
    await mmkvStorage.setItem(LANGUAGE_KEY, lang);
  }
};

export default i18n;
