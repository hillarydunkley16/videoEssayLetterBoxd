import { useLocalSearchParams } from 'expo-router'
import { Text } from 'react-native'
import VideoInfoScreen from '@/src/screens/VideoInfoScreen'
import { ThemedView } from '@/components/themed-view'

export default function Modal() {
  const params = useLocalSearchParams<{ essayId?: string | string[] }>()
  const essayId =
    typeof params.essayId === 'string'
      ? params.essayId
      : Array.isArray(params.essayId)
      ? params.essayId[0]
      : undefined

  if (!essayId) {
    return (
      <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Missing video id</Text>
      </ThemedView>
    )
  }

  return <VideoInfoScreen id={essayId} />
}
