import { useColorScheme as useRNColorScheme } from 'react-native';

/**
 * คืนค่าแค่ `light` | `dark` เพื่อให้ index `Colors` / theme objects ถูกต้องตาม TypeScript
 * (RN มี `unspecified` / null — โหลดเป็น light)
 */
export function useColorScheme(): 'light' | 'dark' {
  const cs = useRNColorScheme();
  return cs === 'dark' ? 'dark' : 'light';
}
