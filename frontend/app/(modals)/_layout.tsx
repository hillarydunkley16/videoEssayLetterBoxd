import { Stack } from 'expo-router';

export default function Layout() {
    return(
        <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(home)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen
            name="modal"
            options={{
            presentation: 'modal',
            headerShown: false, 
            gestureEnabled: true,
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
        </Stack>
    )
}