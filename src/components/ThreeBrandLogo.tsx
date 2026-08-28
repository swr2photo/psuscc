import React from 'react';
import { View } from 'react-native';

/**
 * Fallback component for Native to prevent Three.js runtime crashes.
 * The 3D version remains active on Web via ThreeBrandLogo.web.tsx.
 */
export default function ThreeBrandLogo() {
  return <View />;
}
