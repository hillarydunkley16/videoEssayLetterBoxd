import { View, StyleSheet, useColorScheme } from 'react-native'
import { SignedIn } from '@clerk/clerk-expo'
import { usePathname } from 'expo-router'
import { Colors } from '@/constants/theme'
import { SearchField } from './SearchField'

// Mobile equivalent of WebNav's embedded search bar — MobileNav (the bottom
// tab bar) has no room for it, so it sits in its own thin bar above the
// stack content. Only shown when signed in, matching MobileNav.
export function MobileTopNav() {
  const theme = Colors[useColorScheme() ?? 'light']
  const pathname = usePathname()
  const hideSearch = pathname === '/profile' || pathname === '/singleLog'

  if (hideSearch) return null

  return (
    <SignedIn>
      <View style={[styles.nav, { borderColor: theme.border, backgroundColor: theme.background }]}>
        <SearchField theme={theme} style={styles.searchContainer} />
      </View>
    </SignedIn>
  )
}

const styles = StyleSheet.create({
  nav: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  searchContainer: {
    width: '100%',
  },
})
