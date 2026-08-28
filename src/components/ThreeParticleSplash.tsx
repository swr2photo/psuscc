import React from 'react';
import { View, StyleSheet } from 'react-native';

/**
 * Fallback component for Native to prevent Three.js runtime crashes.
 * The 3D version remains active on Web via ThreeParticleSplash.web.tsx.
 */
export default function ThreeParticleSplash() {
  return (
    <View style={styles.container} />
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0F172A', // Match 3D background color
  },
});
