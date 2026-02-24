import { Link,  router , useLocalSearchParams} from 'expo-router';
import { Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import GetVideoEssayScreen from '@/src/screens/GetVideoEssayScreen';
import VideoInfoLogs from '@/src/screens/VideoInfoLogs';
import { useEffect } from 'react';
import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'
export default function Modal() {
  const isPresented = router.canGoBack();
  const essayId= useLocalSearchParams<{ essayId: string }>()
  console.log(essayId.essayId)
  // console.log("params: ", params)
  // console.log(params.essayId)
  // const essayId = params.essayId
  // console.log(Number(params.essayId))
  
  if (!essayId) {
    return (
      <View style={styles.container}>
        <Text>Invalid video id</Text>
      </View>
    );
  }

  return (
    <ThemedView style = {styles.largeContainer} >
      <ThemedView style = {styles.container}>
      <GetVideoEssayScreen id={essayId.essayId} />
      <VideoInfoLogs id={essayId.essayId}/>
      </ThemedView>
      
      <TouchableOpacity onPress = {() => router.push(`/logVideoModal?essayId=${essayId.essayId}`)}>
        <ThemedText>Add a review</ThemedText>
      </TouchableOpacity>
      <Link href="../">
        Dismiss
      </Link>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 10,
  }, 
  thumbnail: {
    width: 350, 
    height: 200
  }, 
  largeContainer: {
    // margin: 30,
    // gap: 30, 
    padding: 50
  }
  
});
