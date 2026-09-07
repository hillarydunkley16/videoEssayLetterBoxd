import { router, useLocalSearchParams, useNavigation } from 'expo-router'
import { StyleSheet, Text, TouchableOpacity } from 'react-native'
import GetVideoEssayScreen from '@/src/screens/GetVideoEssayScreen'
import VideoInfoLogs from '@/src/screens/VideoInfoLogs'
import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import LogListScreen from '@/src/screens/LogListScreen'
import { ReviewsTopNav } from '@/components/ui/reviewsTopNav'
export default function Modal() {
  const params = useLocalSearchParams<{ essayId?: string | string[] }>()
  const navigation = useNavigation();
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
      
      <LogListScreen id = {essayId} 
      onTitleLoaded={(title) => {
        navigation.setOptions({
          header: () => <ReviewsTopNav title={`Reviews of ${title}`} />
        })
      }}
      />
      {/* <GetVideoEssayScreen id={essayId} />
      <VideoInfoLogs id={essayId} />
       
      <TouchableOpacity style = {styles.button} onPress={() => router.push(`/logVideoModal?essayId=${essayId}`)}>
        <ThemedText style={styles.buttonText}>Add a review</ThemedText>
      </TouchableOpacity> */}
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
  button: {
  
    fontSize: 16,
    fontWeight: '600',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#7accff',
    marginTop: 20,
  },
  buttonText:{
    // color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  }
})