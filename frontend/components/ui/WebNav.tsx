// components/WebNav.tsx
import { View, Text, Pressable, StyleSheet, useColorScheme } from 'react-native'
import { Link, usePathname } from 'expo-router'
import { SignedIn, SignedOut } from '@clerk/clerk-expo'
import { Colors, Fonts } from '@/constants/theme'
import { SearchField } from './SearchField'

function NavLink({ href, label, active, theme }: { href: string; label: string; active: boolean; theme: (typeof Colors)['light'] }) {
  return (
    <Link href={href as any} asChild>
      <Pressable>
        <Text
          style={[
            styles.link,
            { color: active ? theme.text : theme.muted, fontFamily: Fonts?.sansSemiBold },
          ]}
        >
          {label}
        </Text>
      </Pressable>
    </Link>
  )
}

export function WebNav() {
  const theme = Colors[useColorScheme() ?? 'light']
  const pathname = usePathname()

  return (
    <View style={[styles.nav, { borderColor: theme.border, backgroundColor: theme.background }]}>
      <Link href="/" asChild>
        <Pressable>
          <Text style={[styles.brand, { color: theme.text, fontFamily: Fonts?.display }]}>
            Visual Arguments
          </Text>
        </Pressable>
      </Link>

      <SignedIn>
        <SearchField theme={theme} style={styles.searchContainer} />
      </SignedIn>

      <View style={styles.links}>
        <SignedOut>
          <NavLink href="/(auth)/sign-in" label="Log in" active={pathname.includes('sign-in')} theme={theme} />
          <NavLink href="/(auth)/sign-up" label="Sign up" active={pathname.includes('sign-up')} theme={theme} />
        </SignedOut>
        <SignedIn>
          <NavLink href="/(tabs)/lists" label="Lists" active={pathname.includes('lists')} theme={theme} />
          <NavLink href="/(tabs)/profile" label="Profile" active={pathname.includes('profile')} theme={theme} />
        </SignedIn>
      </View>
    </View>
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
  },
  links: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  brand: {
    fontSize: 17,
  },
  link: {
    fontSize: 14,
    marginLeft: 24,
  },
  searchContainer: {
    flex: 1,
    maxWidth: 360,
  },
})
