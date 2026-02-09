import { Stack } from 'expo-router';

export default function Layout() {
  return (
    <Stack >
      {/* <Stack.Screen name="index" options={{ headerShown: false }} /> */}
      <Stack.Screen
        name="modal"
        options={{
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="logVideoModal"
        options={{
          presentation: 'modal',
        }}
      />
      <Stack.Screen name = "search" options={{ headerShown: false }} />
    </Stack>
  );
}
