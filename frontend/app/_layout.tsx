import { Stack } from 'expo-router'
import { View, StyleSheet, Platform, Text } from 'react-native'
import { WebNav } from '../components/ui/WebNav'
import { MobileNav } from '../components/ui/MobileNav'
import { ClerkProvider, useAuth } from '@clerk/clerk-expo'
import { tokenCache } from '@clerk/clerk-expo/token-cache'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Label, NativeTabs, Icon } from 'expo-router/unstable-native-tabs';
import { GestureHandlerRootView } from 'react-native-gesture-handler'
// import { GestureDetectorProvider } from 'react-native-gesture-handler'

function RootLayoutNav() {
  const { isLoaded } = useAuth();
  if (!isLoaded) return;
  
  return (
    <SafeAreaView edges={['top']} style={styles.container}>
    <GestureHandlerRootView style={styles.container}>
            {Platform.OS === 'web' && <WebNav />}
          <View style={styles.content}>
            <Stack screenOptions={{ headerShown: false }} />
          </View>
          {Platform.OS !== 'web' && <MobileNav />}    
    </GestureHandlerRootView>
   </SafeAreaView>
  )
}

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY

if (!publishableKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY. Set it in frontend/.env (local) ' +
      'or the deploy environment. See frontend/.env.example.',
  )
}

export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <RootLayoutNav/>
    </ClerkProvider>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
})