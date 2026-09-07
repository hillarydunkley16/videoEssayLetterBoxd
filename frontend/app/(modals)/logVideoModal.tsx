import { Link,  router , useLocalSearchParams} from 'expo-router';
import { StyleSheet, Text, Button, View } from 'react-native';
import CreateLogScreen from '@/src/screens/createLogScreen';
import GetVideoEssayScreen from '@/src/screens/GetVideoEssayScreen';
import { useEffect, useState} from 'react';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
// import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'
import { ThemedText } from '@/components/themed-text';
import { createLog } from '@/src/api/logs';
import { authFetch } from '@/src/api/client';
import { useAuthPost } from '@/src/api/authPost';
export default function logVideoModal() {
  const authFetch = useAuthPost();  // ← use this instead of imported authFetch
    const [loading, setLoading] = useState(false);
    const [ratingValue, setRatingValue] = useState(0);
    const [rewatch, setRewatch] = useState(false);
    const [reviewText, setReviewText] = useState("");
    const [date, setDate] = useState(new Date());
    const isPresented = router.canGoBack();
    // const [loading, setLoading] = useState(false);
    // const [ratingValue, setRatingValue] = useState(0);
    // const [rewatch, setRewatch] = useState(false);
    // const [reviewText, setReviewText] = useState(""); 
    // const [date, setDate] = useState(new Date());
    const params = useLocalSearchParams<{essayId?: string | string[]}>();
    console.log("params logVideoModal ", params);
    const essayId = 
      typeof params.essayId === "string" ? 
      params.essayId
      : Array.isArray(params.essayId)
      ? params.essayId[0] 
      : undefined;
   
    // console.log("essayID found", essayId)
     if (typeof essayId !== "string") {
        return (
          <View>
            <Text>Invalid video id</Text>
          </View>
        );
      }
       async function handlePress() {
        router.replace('/');
      }
    const handleSubmit = async () => {
        try{
            const payload = {
                essay: essayId,
                date: date.toISOString().split('T')[0],
                rating: ratingValue,
                review_text: reviewText,
                rewatch: rewatch
            }
          
            await createLog(authFetch, payload);
            console.log("Log created successfully");
        } catch (error) {
            console.error("Error creating log:", error);
        }
    }
    return(
        <ThemedView style={styles.largeContainer}> 

          <MaterialCommunityIcons name = "arrow-left" size = {40} color = "white" onPress = {handlePress}/>
          <View style = {styles.buttonRow}> 
                <Button title = {"Cancel"}
                onPress = {() => router.back()}
                /> 
                <Button 
                title = {loading ? "Saving..." : "Save Log"}
                onPress={handleSubmit}
                disabled = {loading}
                />
            </View>
            <GetVideoEssayScreen id = {essayId}/>
            <CreateLogScreen 
            id={essayId} 
            style={styles.container}  
            initialRating={ratingValue}
            reviewText={reviewText}
            date={date}
            rewatch={rewatch}
            onRatingChange={setRatingValue}
            onReviewTextChange={setReviewText}  // ← pass setter down
            onDateChange={setDate}              // ← pass setter down
            onWatchedChange={setRewatch}    
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
    }, 
    buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
   
  },
});

// export default function logVideoModal() {
//     const authFetch = useAuthPost();  // ← use this instead of imported authFetch
//     const [loading, setLoading] = useState(false);
//     const [ratingValue, setRatingValue] = useState(0);
//     const [rewatch, setRewatch] = useState(false);
//     const [reviewText, setReviewText] = useState("");
//     const [date, setDate] = useState(new Date());
    
//     const handleSubmit = async () => {
//         try {
//             setLoading(true);
//             await createLog(authFetch, {
//                 essay: essayId,
//                 date: date.toISOString().split('T')[0],
//                 rating: ratingValue,
//                 review_text: reviewText,
//                 rewatch: rewatch
//             });
//             console.log("Log created successfully");
//             router.back();
//         } catch (error) {
//             console.error("Error creating log:", error);
//         } finally {
//             setLoading(false);
//         }
//     }

//     return (
//         <ThemedView style={styles.largeContainer}> 
//             <View style={styles.buttonRow}> 
//                 <Button title="Cancel" onPress={() => router.back()} /> 
//                 <Button 
//                     title={loading ? "Saving..." : "Save Log"}
//                     onPress={handleSubmit}
//                     disabled={loading}
//                 />
//             </View>
//             <GetVideoEssayScreen id={essayId}/>
//             <CreateLogScreen 
//                 id={essayId} 
//                 style={styles.container}  
//                 initialRating={ratingValue}
//                 reviewText={reviewText}
//                 date={date}
//                 rewatch={rewatch}
//                 onRatingChange={setRatingValue}
//                 onReviewTextChange={setReviewText}  // ← pass setter down
//                 onDateChange={setDate}              // ← pass setter down
//                 onWatchedChange={setRewatch}        // ← pass setter down
//             />
//         </ThemedView>
//     )
// }