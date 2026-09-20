import { Stack } from 'expo-router'
import { View, StyleSheet, Platform, Text } from 'react-native'
import { WebNav } from '../components/ui/WebNav'
import { MobileNav } from '../components/ui/MobileNav'
import { MobileTopNav } from '../components/ui/MobileTopNav'
import { ClerkProvider, SignedIn, useAuth } from '@clerk/clerk-expo'
import { tokenCache } from '@clerk/clerk-expo/token-cache'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Label, NativeTabs, Icon } from 'expo-router/unstable-native-tabs';
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useAppFonts } from './hooks/use-app-fonts'
import { useColorScheme } from './hooks/use-color-scheme'
import { Colors } from '@/constants/theme'
// import { GestureDetectorProvider } from 'react-native-gesture-handler'

function RootLayoutNav() {
  const { isLoaded } = useAuth();
  const { loaded: fontsLoaded } = useAppFonts();
  const theme = Colors[useColorScheme() ?? 'light'];
  // Web loads Fraunces/Inter via the <link> in app/+html.tsx, not expo-font,
  // so it doesn't need to wait on fontsLoaded.
  if (!isLoaded || (Platform.OS !== 'web' && !fontsLoaded)) return null;

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.background }]}>
    <GestureHandlerRootView style={[styles.container, { backgroundColor: theme.background }]}>
            {Platform.OS === 'web' && <WebNav />}
            {Platform.OS !== 'web' && <MobileTopNav />}
          <View style={styles.content}>
            <Stack screenOptions={{ headerShown: false }} />
          </View>
          {Platform.OS !== 'web' && (
            <SignedIn>
              <MobileNav />
            </SignedIn>
          )}
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