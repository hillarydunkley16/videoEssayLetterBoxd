import { ThemedView } from '@/components/themed-view'
import ProfileScreen from '@/src/screens/ProfileScreen'

export default function Page() {
  return (
    <ThemedView style={{ flex: 1 }}>
      <ProfileScreen />
    </ThemedView>
  )
}
