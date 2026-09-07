import { ReviewsTopNav } from '@/components/ui/reviewsTopNav';
import { ProfileTopNav } from '@/components/ui/ProfileTopNav';
import { TopNav } from '@/components/ui/TopNav';
import { Stack } from 'expo-router';

export default function Layout() {
  return (
    <Stack
   
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name = "search" options={{ headerShown: false }} />
      <Stack.Screen 
      name = "profile" 
      options = {{
        headerShown: true, 
        header: () => <ProfileTopNav />
      }}
      />
      
    </Stack>
  );
}
