import { useLocalSearchParams } from 'expo-router';
import { HomeMediaCreateFlow } from '@/components/home/HomeMediaCreateFlow';

export default function CreateHomePostScreen() {
  const { session, useGallery } = useLocalSearchParams<{ session?: string; useGallery?: string }>();
  return <HomeMediaCreateFlow key={session ?? 'post'} initialMode="post" initialUseGallery={useGallery === 'true'} />;
}
