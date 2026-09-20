import { View, Text, Pressable, StyleSheet, useColorScheme } from 'react-native'
import { Link, usePathname } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { Colors, Fonts } from '@/constants/theme'

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
      <Pressable style={styles.navItem}>
        <MaterialCommunityIcons name={icon} size={22} color={color} />
        <Text style={[styles.label, { color, fontFamily: Fonts?.sansMedium }]}>{label}</Text>
      </Pressable>
    </Link>
  )
}

export function MobileNav() {
  const insets = useSafeAreaInsets()
  const theme = Colors[useColorScheme() ?? 'light']
  const pathname = usePathname()

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
      <NavItem href="/(tabs)/search" label="Search" icon="magnify" active={pathname.includes('search')} theme={theme} />
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
