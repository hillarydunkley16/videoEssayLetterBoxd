import { Link,  router , useLocalSearchParams} from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import CreateLogScreen from '@/src/screens/createLogScreen';
import GetVideoEssayScreen from '@/src/screens/GetVideoEssayScreen';
import { useEffect } from 'react';
// import { ThemedText } from '@/components/themed-text'
// import { ThemedView } from '@/components/themed-view'
export default function logVideoModal() {
    const isPresented = router.canGoBack();
    const params = useLocalSearchParams<{essayId?: string | string[]}>();
    console.log("params ", params);
    const essayId = 
      typeof params.essayId === "string" ? 
      params.essayId
      : Array.isArray(params.essayId)
      ? params.essayId[0] 
      : undefined;
   
    console.log("essayID found", essayId)
     if (typeof essayId !== "string") {
        return (
          <View>
            <Text>Invalid video id</Text>
          </View>
        );
      }
    return(
        <View> 
            <GetVideoEssayScreen id = {essayId}/>
            <CreateLogScreen id = {essayId} />
        </View>
        
        
    )
}