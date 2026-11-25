import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Link, router, useGlobalSearchParams, usePathname } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { Colors, Fonts } from '@/constants/theme'
import { useColorScheme } from '@/hooks/use-color-scheme'

function NavItem({
  href,
  label,
  icon,
  active,
  theme,
}: {
  href: string
  label: string
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']
  active: boolean
  theme: (typeof Colors)['light']
}) {
  const color = active ? theme.accent : theme.muted
  return (
    <Link href={href as any} asChild>
      <Pressable style={styles.navItem} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: active }}>
        <MaterialCommunityIcons name={icon} size={22} color={color} />
        <Text style={[styles.label, { color, fontFamily: Fonts?.sansMedium }]}>{label}</Text>
      </Pressable>
    </Link>
  )
}

// Opens search in "log mode": picking a result goes to the quick-log sheet. `focus` is a
// fresh timestamp each tap so SearchField re-grabs the keyboard even if we're already there.
function LogButton({ active, theme }: { active: boolean; theme: (typeof Colors)['light'] }) {
  const pathname = usePathname()
  const handlePress = () => {
    const params = { mode: 'log', focus: String(Date.now()) }
    if (pathname.includes('search')) {
      router.setParams(params)
    } else {
      router.push({ pathname: '/(tabs)/search', params })
    }
  }
  return (
    <Pressable
      testID="tab-log"
      style={styles.navItem}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel="Log"
      accessibilityState={{ selected: active }}
    >
      <MaterialCommunityIcons name="plus-circle" size={34} color={theme.accent} />
      <Text style={[styles.label, { color: active ? theme.accent : theme.muted, fontFamily: Fonts?.sansMedium }]}>Log</Text>
    </Pressable>
  )
}

export function MobileNav() {
  const insets = useSafeAreaInsets()
  const theme = Colors[useColorScheme()]
  const pathname = usePathname()
  const { mode } = useGlobalSearchParams<{ mode?: string }>()

  return (
    <View
      style={[
        styles.nav,
        {
          height: 64 + insets.bottom,
          paddingBottom: insets.bottom,
          borderColor: theme.border,
          backgroundColor: theme.background,
        },
      ]}
    >
      <NavItem href="/" label="Home" icon="home" active={pathname === '/'} theme={theme} />
      <NavItem href="/(tabs)/lists" label="Lists" icon="format-list-bulleted" active={pathname.includes('lists')} theme={theme} />
      <LogButton active={pathname.includes('search') && mode === 'log'} theme={theme} />
      <NavItem href="/(tabs)/profile" label="Profile" icon="account" active={pathname.includes('profile')} theme={theme} />
    </View>
  )
}

const styles = StyleSheet.create({
  nav: {
    paddingTop: 8,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
  },
  navItem: {
    alignItems: 'center',
    gap: 3,
    flex: 1,
  },
  label: {
    fontSize: 11,
  },
})
