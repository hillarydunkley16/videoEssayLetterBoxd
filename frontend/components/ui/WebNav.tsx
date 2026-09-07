// components/WebNav.tsx
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Link } from 'expo-router'
import { SignedIn, SignedOut, useSession, useUser } from '@clerk/clerk-expo'
import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'
import {useAuth} from '@clerk/clerk-expo'
import { SignOutButton } from '@/app/components/sign-out-button'
import { MaterialCommunityIcons } from '@expo/vector-icons';
export function WebNav() {
    
  return (
    <ThemedView style={styles.nav}>
      <Link href="/">
        <ThemedText style={styles.link}>Home</ThemedText>
      </Link>
      <SignedOut>
        <Link href="/(auth)/sign-in">
          <Pressable>
            <MaterialCommunityIcons name="home" size={24} color="#666" />
            <ThemedText>Log in</ThemedText>

           </Pressable>
          
        </Link>
        <Link href="/(auth)/sign-up">
          <ThemedText>Sign up</ThemedText>
        </Link>
      </SignedOut>
      <SignedIn>
        <Link href =  "/(tabs)/search">
            <ThemedText>Log a Video</ThemedText>
        </Link>
        <Link href = "/(tabs)/profile">
            <ThemedText>Profile</ThemedText>
        </Link>
        <SignOutButton />
      </SignedIn>
      {/* <Link href="/videos">
        <Text style={styles.link}>Videos</Text>
      </Link> */}
      {/* <Link href="/profile">
        <Text style={styles.link}>Profile</Text>
      </Link> */}
    </ThemedView>
  )
}

const styles = StyleSheet.create({
  nav: {
    height: 56,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    borderBottomWidth: 1,
    borderColor: '#ddd',
  },
  link: {
    fontSize: 16,
  },
  navItem: {
    alignItems: 'center',
    gap: 4,
  },
  navLabel: {
    fontSize: 12,
  },
})
