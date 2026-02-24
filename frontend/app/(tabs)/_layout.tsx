import { Stack } from 'expo-router';

export default function Layout() {
  return (
    <Stack >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="modal"
        options={{
          presentation: 'modal',
          headerShown: false
        }}
      />
      <Stack.Screen
        name="logVideoModal"
        options={{
          presentation: 'modal',
          headerShown: false
        }}
      />
      <Stack.Screen
        name = "singleLog"
        options = {{
          presentation: 'modal',
          headerShown: false
        }}
      />
      <Stack.Screen name = "search" options={{ headerShown: false }} />
      <Stack.Screen name = "profile" options = {{headerShown: false}}/>
    </Stack>
  );
}
