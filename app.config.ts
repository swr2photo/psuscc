import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'psuscc',
  slug: 'psuscc',
  scheme: 'psuscc',
  version: '1.0.0',
  jsEngine: 'hermes',
  userInterfaceStyle: 'automatic',
  extra: {
    ...(config.extra ?? {}),
    eas: {
      ...(config.extra?.eas ?? {}),
      projectId: 'd7e58b08-6fbf-4be7-8a92-92f452cfd4a8',
    },
  },
  ios: {
    bundleIdentifier: 'com.psuscc.app',
    supportsTablet: true,
    infoPlist: {
      NSMotionUsageDescription:
        'ใช้เซ็นเซอร์การหมุนและความเร่งของโทรศัพท์เพื่อให้การ์ด QR เอียงตามการเคลื่อนไหวจริง',
      NSCameraUsageDescription:
        'แอปต้องการใช้กล้องเพื่อสแกน QR Code สำหรับเช็กอินเข้างาน',
      NSMicrophoneUsageDescription:
        'แอปขอใช้ไมโครโฟนเพื่อบันทึกและส่งข้อความเสียงในแชทกลุ่มกิจกรรม',
      NSLocationWhenInUseUsageDescription:
        'แอปต้องการตำแหน่งของคุณเพื่อยืนยันว่าคุณอยู่ในพื้นที่ที่กำหนดให้เช็กอิน',
      NSLocationAlwaysAndWhenInUseUsageDescription:
        'แอปต้องการตำแหน่งของคุณเพื่อยืนยันการเช็กอินที่แม่นยำแม้ในขณะที่คุณกำลังใช้งานแอป',
      NSPhotoLibraryAddUsageDescription:
        'แอปต้องการบันทึกรูปโพสต์ลงคลังภาพของคุณ',
      NSPhotoLibraryUsageDescription:
        'แอปต้องการเข้าถึงคลังภาพเพื่อบันทึกรูปโพสต์',
    },
  },
  android: {
    package: 'com.psuscc.app',
    permissions: [
      'CAMERA',
      'RECORD_AUDIO',
      'ACCESS_FINE_LOCATION',
      'ACCESS_COARSE_LOCATION',
      'READ_MEDIA_IMAGES',
      'WRITE_EXTERNAL_STORAGE',
    ],
  },
  plugins: [
    'expo-font',
    'expo-router',
    'expo-web-browser',
    [
      'expo-camera',
      {
        cameraPermission:
          'แอปต้องการใช้กล้องเพื่อสแกน QR Code สำหรับเช็กอินเข้างาน',
        recordAudioAndroid: false,
      },
    ],
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission:
          'แอปต้องการตำแหน่งเพื่อยืนยันการเช็กอินว่าอยู่ในพื้นที่กิจกรรม',
      },
    ],
    [
      'expo-audio',
      {
        microphonePermission:
          'แอปขอใช้ไมโครโฟนเพื่อบันทึกและส่งข้อความเสียงในแชทกลุ่มกิจกรรม',
      },
    ],
    'expo-video',
    'expo-secure-store',
    'expo-sharing',
    [
      'expo-media-library',
      {
        photosPermission: 'แอปต้องการเข้าถึงคลังภาพเพื่อบันทึกรูปโพสต์',
        savePhotosPermission: 'แอปต้องการบันทึกรูปโพสต์ลงคลังภาพของคุณ',
      },
    ],
  ],
});