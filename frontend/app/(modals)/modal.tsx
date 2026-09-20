import { router, useLocalSearchParams } from 'expo-router'
import { StyleSheet, Text, TouchableOpacity } from 'react-native'
import GetVideoEssayScreen from '@/src/screens/GetVideoEssayScreen'
import VideoInfoLogs from '@/src/screens/VideoInfoLogs'
import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useEffect } from 'react'
import { useNavigation } from 'expo-router'
import { ReviewsTopNav } from '@/components/ui/reviewsTopNav'
import { logRoute } from '@/src/helpers/logRoute'
export default function Modal() {
  const params = useLocalSearchParams<{ essayId?: string | string[] }>(); 
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
      <GetVideoEssayScreen id={essayId}
      onTitleLoaded = {(title) => {
            navigation.setOptions({
                header: () => <ReviewsTopNav title = {`${title}`}/>
            })
        }} 
      />
      <VideoInfoLogs id={essayId} />
       {/* <TouchableOpacity style = {styles.button} onPress={() => router.push(`/logs?essayId=${essayId}`)}>
        <ThemedText style={styles.buttonText}>See Logs</ThemedText>
        </TouchableOpacity> */}
      <TouchableOpacity style = {styles.button} onPress={() => router.push(logRoute(essayId))}>
        <ThemedText style={styles.buttonText}>Log or Review</ThemedText>
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