import { Link,  router , useLocalSearchParams, useNavigation} from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import GetVideoEssayScreen from '@/src/screens/GetVideoEssayScreen';
import { useEffect } from 'react';
import LogInfo from '@/src/screens/logInfo';
import { ThemedView } from '@/components/themed-view';
import { ReviewsTopNav } from '@/components/ui/reviewsTopNav';

export default function singleLog(){
    console.log("singleLog component rendered")
    const params = useLocalSearchParams<{logId: string}>();
    const navigation = useNavigation();
    console.log("params: ", params)
    // const isPresented = router.canGoBack();
    // const params = useLocalSearchParams<{logId: string}>();
    // console.log("params: ", params)
    if (!params.logId) return (
        <ThemedView>
            <Text>NULL</Text>
        </ThemedView>
    ); 
    return(
       <ThemedView style = {styles.largeContainer}>
        <LogInfo id = {params.logId}
       onTitleLoaded = {(title) => {
            navigation.setOptions({
                header: () => <ReviewsTopNav title = {`Review of ${title}`}/>
            })
        }} 
        
        />
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
        width: '100%',
        marginBottom: 16,
    }
});