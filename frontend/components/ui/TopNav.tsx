import { Pressable, StyleSheet, View } from 'react-native'
import { Link } from 'expo-router'
import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
type Props = {
    title?: string;
}
export function TopNav() {
    
  return (
    <ThemedView style={styles.nav}>
        <Pressable onPress={() => router.back()}>
        <MaterialCommunityIcons name="chevron-left" size={28} color="blue" />
        
      </Pressable>
      <MaterialCommunityIcons name="dots-horizontal" size={28} color="blue" />
       
     
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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