import { Platform } from 'react-native';
import type { Href } from 'expo-router';

// quickLog is a swipeable bottom sheet built on native gestures — it doesn't
// translate to web, so web skips straight to the full log form instead.
export function logRoute(essayId: string): Href {
  return (
    Platform.OS === 'web'
      ? `/logVideoModal?essayId=${essayId}`
      : `/quickLog?essayId=${essayId}`
  ) as Href;
}
