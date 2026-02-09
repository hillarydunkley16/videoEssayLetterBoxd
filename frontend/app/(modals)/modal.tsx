import { Link,  router , useLocalSearchParams} from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import GetVideoEssayScreen from '@/src/screens/GetVideoEssayScreen';
import VideoInfoLogs from '@/src/screens/VideoInfoLogs';
import { useEffect } from 'react';
import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'
export default function Modal() {
  const isPresented = router.canGoBack();
  const essayId= useLocalSearchParams<{ essayId: string }>()
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
    <ThemedView style={styles.container}>
      <GetVideoEssayScreen essayId={essayId} />
      <VideoInfoLogs essayId={essayId}/>
      <Link href="../">
        Dismiss
      </Link>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
