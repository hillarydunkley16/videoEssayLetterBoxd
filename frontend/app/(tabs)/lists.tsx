import { ThemedView } from '@/components/themed-view'
import ListsScreen from '@/src/screens/ListsScreen'

export default function Page() {
  return (
    <ThemedView style={{ flex: 1 }}>
      <ListsScreen />
    </ThemedView>
  )
}
