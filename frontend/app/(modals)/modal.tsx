import { Link,  router , useLocalSearchParams} from 'expo-router';
import { Easing, StyleSheet, Text, TouchableOpacity, View, Button, Platform } from 'react-native';
import GetVideoEssayScreen from '@/src/screens/GetVideoEssayScreen';
import VideoInfoLogs from '@/src/screens/VideoInfoLogs';
import { useEffect } from 'react';
import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'
import { MaterialCommunityIcons } from 'expo-vector-icons';
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
  async function handlePress() {
    router.replace('/');
  }
  return (
    <ThemedView style={styles.largeContainer}>
        {/* back button */}
        <MaterialCommunityIcons name="arrow-left" size={40} color="blue" onPress={handlePress}/>
        
        {/* video info at top */}
        <GetVideoEssayScreen id={essayId.essayId} />
        
        {/* logs below */}
        <VideoInfoLogs id={essayId.essayId}/>
        
        {/* add review button at bottom */}
        <TouchableOpacity onPress={() => router.push(`/logVideoModal?essayId=${essayId.essayId}`)}>
            <ThemedText>Add a review</ThemedText>
        </TouchableOpacity>
    </ThemedView>
);
  
}

const styles = StyleSheet.create({
    largeContainer: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 30,
        paddingBottom: 20,
        
    },
    container: {
        width: '100%',
        marginBottom: 16,
    }
});

//  ...Platform.select({
//       ios: {
//         alignItems: 'center',
//         justifyContent: 'center',
//         borderColor: 'blue',
//         borderWidth: 1,
//       },
//       android: {
//         alignItems: 'flex-start',
//         justifyContent: 'flex-start',
//       },
//       web: {
//         alignItems: 'center',
//         justifyContent: 'center',
//       },
//     }),