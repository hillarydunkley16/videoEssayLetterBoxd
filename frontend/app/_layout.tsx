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
  if (!isLoaded) return (
    <View style={styles.container}>
      <Text>Loading...</Text>
    </View>
  );
  
  return (
    <SafeAreaView style={styles.container}>
    <GestureHandlerRootView style={styles.container}>
            {Platform.OS === 'web' && <WebNav />}
          <View style={[styles.content, Platform.OS !== 'web' && { paddingBottom: 56 }]}>
            <Stack screenOptions={{ headerShown: false }} />
          </View>
          {Platform.OS !== 'web' && <MobileNav />}    
    </GestureHandlerRootView>
    </SafeAreaView>
  )
}

export default function RootLayout() {
  return (
    <ClerkProvider tokenCache={tokenCache}>
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