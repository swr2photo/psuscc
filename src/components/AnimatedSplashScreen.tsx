import React, { useEffect } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  Easing,
  runOnJS
} from 'react-native-reanimated';
import * as SplashScreen from 'expo-splash-screen';
import ThreeParticleSplash from './ThreeParticleSplash';

const { width } = Dimensions.get('window');

interface AnimatedSplashScreenProps {
  onAnimationComplete: () => void;
  isReady: boolean;
}

export default function AnimatedSplashScreen({ onAnimationComplete, isReady }: AnimatedSplashScreenProps) {
  const scale = useSharedValue(0.3);
  const opacity = useSharedValue(0);
  const logoScale = useSharedValue(1);

  useEffect(() => {
    // Start initial animation (Slower for more impact)
    opacity.value = withTiming(1, { duration: 1500 });
    scale.value = withTiming(1, { 
      duration: 1800, 
      easing: Easing.out(Easing.back(1.2)) 
    });

    // When app is ready, trigger exit animation
    if (isReady) {
      const exitAnimation = async () => {
        // Wait a small bit so the user can actually see the 3D effect if it loaded instantly
        await new Promise(resolve => setTimeout(resolve, 800));

        try {
          await SplashScreen.hideAsync();
        } catch (e) {}
        
        // Final "Zoom into app" effect (Slower and smoother)
        logoScale.value = withTiming(5, { duration: 1000, easing: Easing.inOut(Easing.quad) });
        opacity.value = withTiming(0, { duration: 800 }, () => {
          runOnJS(onAnimationComplete)();
        });
      };
      
      exitAnimation();
    }
  }, [isReady]);

  const canvasContainerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { scale: scale.value * logoScale.value }
    ],
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[StyleSheet.absoluteFill, canvasContainerStyle]}>
        <ThreeParticleSplash />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0F172A', // Match 3D background
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
});
