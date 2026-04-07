// components/WebNav.tsx
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Link } from 'expo-router'
import { SignedIn, SignedOut, useSession, useUser } from '@clerk/clerk-expo'
import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'
import {useAuth} from '@clerk/clerk-expo'
import { Label, NativeTabs, Icon } from 'expo-router/unstable-native-tabs';
import { SignOutButton } from '@/app/components/sign-out-button'
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from 'expo-vector-icons';
export function MobileNav() {
    // const insets = useSafeAreaInsets();
  return (
    <ThemedView style={[styles.nav]}>
         <Link href="/" asChild>
         <Pressable style={styles.navItem}>
            <MaterialCommunityIcons name="home" size={24} color="black" />
            <ThemedText style={styles.link}>Home</ThemedText>
         </Pressable>
        </Link>
        <Link href="/(tabs)/search" asChild>
            <Pressable style={styles.navItem}> 
            <MaterialCommunityIcons name="video" size={24} color="black" />
            <ThemedText style={styles.link}>Log</ThemedText>
            </Pressable>
           
        </Link>
        <Link href="/(tabs)/profile" asChild>
            <Pressable style={styles.navItem}> 
                <MaterialCommunityIcons name="account" size={24} color="black" />
            <ThemedText style={styles.link}>Profile</ThemedText>
            </Pressable>
            
        </Link>
    </ThemedView>
    
  )
}
// { paddingTop: insets.top, 
//     paddingBottom: insets.bottom,
//     paddingLeft: insets.left,
//     paddingRight: insets.right     }
const styles = StyleSheet.create({
    nav: {
        height: 56,
        paddingHorizontal: 24,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        borderTopWidth: 1,
        borderColor: '#ddd',
      },
      link: {
        fontSize: 14,
      },
      navItem: {
        alignItems: 'center',
        gap: 4,
      },
      navLabel: {
        fontSize: 12,
      },
})
