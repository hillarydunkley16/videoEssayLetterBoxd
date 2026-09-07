import { Pressable, StyleSheet } from 'react-native'
import { Link } from 'expo-router'
import { SignedIn, SignedOut } from '@clerk/clerk-expo'
import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export function MobileNav() {
  const insets = useSafeAreaInsets();

  return (
    <ThemedView style={[styles.nav, { paddingBottom: insets.bottom, height: 64 + insets.bottom, paddingTop: 8, }]}> 
      <Link href="/" asChild>
        <Pressable style={styles.navItem}>
          <MaterialCommunityIcons name="home" size={24} color="black" />
          <ThemedText style={styles.link}>Home</ThemedText>
        </Pressable>
      </Link>
      <Link href="/(tabs)/search" asChild>
        <Pressable style={styles.navItem}> 
          <MaterialCommunityIcons name="video" size={24} color="black" />
          <ThemedText style={styles.link}>Search</ThemedText>
        </Pressable>
      </Link>
      <SignedOut>
        <Link href="/(auth)/sign-in" asChild>
          <Pressable style={styles.navItem}>
            <MaterialCommunityIcons name="login" size={24} color="black" />
            <ThemedText style={styles.link}>Sign In</ThemedText>
          </Pressable>
        </Link>
      </SignedOut>
      <SignedIn>
        <Link href="/(tabs)/profile" asChild>
          <Pressable style={styles.navItem}> 
            <MaterialCommunityIcons name="account" size={24} color="black" />
            <ThemedText style={styles.link}>Profile</ThemedText>
          </Pressable>
        </Link>
      </SignedIn>
    </ThemedView>
  )
}

const styles = StyleSheet.create({
  nav: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 8,
  },
  link: {
    fontSize: 12,
    fontWeight: '600',
  },
  navItem: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
})
