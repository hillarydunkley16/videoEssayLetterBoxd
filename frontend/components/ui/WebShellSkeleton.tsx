import { View, StyleSheet } from 'react-native'
import { Colors } from '@/constants/theme'
import { useColorScheme } from '@/hooks/use-color-scheme'

// Web-only placeholder for the content area while Clerk loads. It is baked into the
// statically exported HTML, so it must be deterministic: no auth state, no dates.
export function WebShellSkeleton() {
  const theme = Colors[useColorScheme()]
  const block = { backgroundColor: theme.surface }
  return (
    <View testID="web-shell-skeleton" aria-busy style={styles.container}>
      <View style={[styles.heading, block]} />
      <View style={[styles.row, block]} />
      <View style={[styles.row, block]} />
      <View style={[styles.row, block]} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    gap: 16,
  },
  heading: {
    width: '40%',
    height: 28,
    borderRadius: 4,
  },
  row: {
    width: '100%',
    height: 72,
    borderRadius: 4,
  },
})
