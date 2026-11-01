import { Stack } from 'expo-router'
import { View, StyleSheet, Platform, Text } from 'react-native'
import { WebNav } from '../components/ui/WebNav'
import { MobileNav } from '../components/ui/MobileNav'
import { MobileTopNav } from '../components/ui/MobileTopNav'
import { WebShellSkeleton } from '../components/ui/WebShellSkeleton'
import { ClerkProvider, SignedIn, useAuth } from '@clerk/clerk-expo'
import { tokenCache } from '@clerk/clerk-expo/token-cache'
import { ShareIntentProvider } from 'expo-share-intent'
import { SafeAreaView } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useAppFonts } from './hooks/use-app-fonts'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { useShareIntentRouter } from '@/src/hooks/useShareIntentRouter'
import { Colors } from '@/constants/theme'
import { Toast } from '@/components/ui/Toast'
// import { GestureDetectorProvider } from 'react-native-gesture-handler'

function RootLayoutNav() {
  const { isLoaded } = useAuth();
  const { loaded: fontsLoaded } = useAppFonts();
  const theme = Colors[useColorScheme()];
  useShareIntentRouter();
  const isWeb = Platform.OS === 'web';
  // Web loads Fraunces/Inter via the self-hosted @font-face in app/+html.tsx, not expo-font,
  // so it doesn't need to wait on fontsLoaded. It also paints the shell while Clerk
  // loads (the skeleton below stands in for <Stack>) so the static HTML isn't blank.
  if (!isWeb && (!isLoaded || !fontsLoaded)) return null;

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.background }]}>
    <GestureHandlerRootView style={[styles.container, { backgroundColor: theme.background }]}>
            {Platform.OS === 'web' && <WebNav />}
            {Platform.OS !== 'web' && <MobileTopNav />}
          <View style={styles.content}>
            {isWeb && !isLoaded ? <WebShellSkeleton /> : <Stack screenOptions={{ headerShown: false }} />}
            <Toast />
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
    <ShareIntentProvider>
      <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
        <RootLayoutNav/>
      </ClerkProvider>
    </ShareIntentProvider>
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