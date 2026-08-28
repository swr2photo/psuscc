import * as LocalAuthentication from 'expo-local-authentication';
import { mmkvStorage } from '@/lib/mmkv';
import { Alert, Platform } from 'react-native';

const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';

export async function isBiometricSupported() {
  const compatible = await LocalAuthentication.hasHardwareAsync();
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  return compatible && types.length > 0;
}

export async function getBiometricType() {
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return 'FACE_ID';
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return 'FINGERPRINT';
  }
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    return 'IRIS';
  }
  return null;
}

export async function isBiometricEnrolled() {
  return await LocalAuthentication.isEnrolledAsync();
}

export async function enableBiometric(enabled: boolean) {
  if (enabled) {
    const supported = await isBiometricSupported();
    const enrolled = await isBiometricEnrolled();
    
    if (!supported) {
      throw new Error('อุปกรณ์ของคุณไม่รองรับการสแกนลายนิ้วมือหรือใบหน้า');
    }
    if (!enrolled) {
      throw new Error('กรุณาตั้งค่าลายนิ้วมือหรือใบหน้าในเครื่องของคุณก่อน');
    }

    // 🛡️ ยืนยันตัวตนด้วย Biometric จริงๆ ก่อนที่จะอนุญาตให้เปิดใช้งานในแอป
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'กรุณาสแกนใบหน้าหรือลายนิ้วมือเพื่อยืนยันการเปิดใช้งาน',
      fallbackLabel: 'ใช้รหัสผ่านเครื่อง',
      disableDeviceFallback: false, // อนุญาตให้ใช้ PIN ได้ถ้าไบโอเมตริกมีปัญหา (ตามมาตรฐาน iOS/Android)
    });

    if (!result.success) {
      throw new Error('การยืนยันตัวตนล้มเหลว ไม่สามารถเปิดใช้งานได้');
    }
  }
  await mmkvStorage.setItem(BIOMETRIC_ENABLED_KEY, enabled ? 'true' : 'false');
}

export async function getBiometricStatus() {
  const status = await mmkvStorage.getItem(BIOMETRIC_ENABLED_KEY);
  return status === 'true';
}

export async function authenticateWithBiometrics() {
  if (Platform.OS === 'web') return false;
  
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'กรุณายืนยันตัวตนด้วยลายนิ้วมือหรือใบหน้า',
    fallbackLabel: 'ใช้รหัสผ่าน',
  });
  
  return result.success;
}
