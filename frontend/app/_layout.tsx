import { Stack } from 'expo-router'
import { View, StyleSheet } from 'react-native'
import { WebNav } from '../components/ui/WebNav'
import { ClerkProvider } from '@clerk/clerk-expo'
import { tokenCache } from '@clerk/clerk-expo/token-cache'
import '../global.css';
export default function RootLayout() {
  return (
    <ClerkProvider tokenCache={tokenCache}>
      <View style={styles.container}>
        <WebNav />
        <Stack
          screenOptions={{
            headerShown: false, // IMPORTANT
          }}
        />
       
      </View>
    </ClerkProvider>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
})
