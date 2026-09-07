import { router, useLocalSearchParams } from 'expo-router'
import { StyleSheet, Text, TouchableOpacity } from 'react-native'
import GetVideoEssayScreen from '@/src/screens/GetVideoEssayScreen'
import VideoInfoLogs from '@/src/screens/VideoInfoLogs'
import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'
import { MaterialCommunityIcons } from '@expo/vector-icons'

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
      <ThemedView style={styles.container}>
        <Text>Missing video id</Text>
      </ThemedView>
    )
  }

  return (
    <ThemedView style={styles.largeContainer}>
      {/* <MaterialCommunityIcons
        name="chevron-left"
        size={40}
        color="blue"
        onPress={() => router.replace('/')}
      /> */}

      <VideoInfoLogs id={essayId} />

      <TouchableOpacity onPress={() => router.push(`/quickLog?essayId=${essayId}`)}>
        <ThemedText>!!Add a review!!</ThemedText>
      </TouchableOpacity>
    </ThemedView>
  )
}

const styles = StyleSheet.create({
  largeContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 20,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
})