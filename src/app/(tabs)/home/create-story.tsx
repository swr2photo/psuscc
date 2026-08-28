import { useLocalSearchParams } from 'expo-router';
import { HomeMediaCreateFlow } from '@/components/home/HomeMediaCreateFlow';

export default function CreateHomeStoryScreen() {
  const { session, useGallery } = useLocalSearchParams<{ session?: string; useGallery?: string }>();
  return <HomeMediaCreateFlow key={session ?? 'story'} initialMode="story" initialUseGallery={useGallery === 'true'} />;
}
