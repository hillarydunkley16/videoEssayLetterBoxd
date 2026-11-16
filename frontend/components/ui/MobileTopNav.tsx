import { View, Text, Pressable, StyleSheet } from 'react-native'
import { SignedIn, SignedOut } from '@clerk/clerk-expo'
import { router, usePathname } from 'expo-router'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { Colors, Fonts } from '@/constants/theme'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { SearchField } from './SearchField'

// Mobile top bar: app name + a circular search button that jumps to the
// search tab. On the search tab itself, the button turns into the full
// search bar. MobileNav (the bottom tab bar) has no room for either, so
// they sit in their own thin bar above the stack content. Only shown when
// signed in, matching MobileNav. Hidden on Profile and the single-log page,
// where a search entry point doesn't make sense.
// Signed out, the bar shows the app name and a Log in button at the right (web gets its Log
// in from WebNav). It is hidden on the auth screens, where the button would point at the
// screen you are already on.
const AUTH_ROUTES = ['/sign-in', '/sign-up', '/choose-username', '/sso-callback']

export function MobileTopNav() {
  const theme = Colors[useColorScheme()]
  const pathname = usePathname()
  const hideSearch = pathname === '/profile' || pathname === '/singleLog'
  const onSearchPage = pathname.includes('search')

  return (
    <>
      <SignedIn>
        {hideSearch ? null : (
          <View style={[styles.nav, { borderColor: theme.border, backgroundColor: theme.background }]}>
            <Text style={[styles.brand, { color: theme.text, fontFamily: Fonts?.display }]}>watchd</Text>
            {onSearchPage ? (
              <SearchField theme={theme} style={styles.searchContainer} />
            ) : (
              <Pressable
                style={[styles.searchButton, { backgroundColor: theme.accent }]}
                onPress={() => router.push('/(tabs)/search')}
                accessibilityRole="button"
                accessibilityLabel="Search"
              >
                <MaterialCommunityIcons name="magnify" size={20} color="#fff" />
              </Pressable>
            )}
          </View>
        )}
      </SignedIn>
      <SignedOut>
        {AUTH_ROUTES.some((route) => pathname.includes(route)) ? null : (
          <View style={[styles.nav, { borderColor: theme.border, backgroundColor: theme.background }]}>
            <Text style={[styles.brand, { color: theme.text, fontFamily: Fonts?.display }]}>watchd</Text>
            <Pressable
              onPress={() => router.push('/(auth)/sign-in')}
              accessibilityRole="button"
              accessibilityLabel="Log in"
              hitSlop={8}
            >
              <Text style={[styles.login, { color: theme.accent, fontFamily: Fonts?.sansSemiBold }]}>Log in</Text>
            </Pressable>
          </View>
        )}
      </SignedOut>
    </>
  )
}

const styles = StyleSheet.create({
  nav: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderBottomWidth: 1,
  },
  brand: {
    fontSize: 17,
  },
  login: {
    fontSize: 15,
  },
  searchContainer: {
    flex: 1,
  },
  searchButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
