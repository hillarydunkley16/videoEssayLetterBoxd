import { Pressable, StyleSheet, View } from 'react-native'
import { Link } from 'expo-router'
import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'
import { MaterialCommunityIcons } from '@expo/vector-icons'

export function HomeTopNav() {
  return (
    <ThemedView style={styles.nav}>
      <View style={styles.titleRow}>
        <ThemedText style={styles.title}>Visual Arguments</ThemedText>
      </View>

      <View style={styles.linksRow}>
        <Link href="/(home)" asChild>
          <Pressable style={styles.navItem}>
            <ThemedText style={styles.link}>Videos</ThemedText>
          </Pressable>
        </Link>

        <Link href="/(home)/popularReviews" asChild>
          <Pressable style={styles.navItem}>
            <ThemedText style={styles.link}>Reviews</ThemedText>
          </Pressable>
        </Link>

        <Link href="/(home)/popularLists" asChild>
          <Pressable style={styles.navItem}>
            <ThemedText style={styles.link}>Lists</ThemedText>
          </Pressable>
        </Link>
      </View>
    </ThemedView>
  )
}

const styles = StyleSheet.create({
  nav: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 8,
  },
  titleRow: {
    marginBottom: 12,
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  linksRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  navItem: {
    alignItems: 'center',
    flex: 1,
  },
  link: {
    fontSize: 12,
    fontWeight: '600',
  },
})