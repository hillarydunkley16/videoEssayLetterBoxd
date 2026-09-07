import { Link,  router , useLocalSearchParams} from 'expo-router';
import { StyleSheet, Text, Button, View } from 'react-native';
import CreateLogScreen from '@/src/screens/createLogScreen';
import GetVideoEssayScreen from '@/src/screens/GetVideoEssayScreen';
import { useEffect, useRef, useCallback, useState } from 'react';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
// import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'
import QuickLogScreen from '@/src/screens/QuickLogScreen';
import { ReviewsTopNav } from '@/components/ui/reviewsTopNav';
import { useNavigation } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet'
import { createLog } from '@/src/api/logs';
import { useAuthPost } from '@/src/api/authPost';

export default function quickLog() {
    const bottomSheetRef = useRef<BottomSheet>(null);
    const authFetch = useAuthPost();
    const [loading, setLoading] = useState(false);
    const [sheetIndex, setSheetIndex] = useState(0);
    const [ratingIsSet, setRatingIsSet] = useState(false);
    const [liked, setLiked] = useState(false);
    const [ratingValue, setRatingValue] = useState(0);
    const [rewatch, setRewatch] = useState(false);
    const [reviewText, setReviewText] = useState("");
    const [date, setDate] = useState(new Date());
    const [watchList, setWatchList] = useState(false);
    const [error, setError] = useState("");
    const isPresented = router.canGoBack();
    const params = useLocalSearchParams<{essayId?: string | string[]}>();
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
      // useEffect(() => {
      //   if (sheetIndex === -1 && ratingIsSet){
      //      handleSetValue(ratingValue);
      //   }
      // }, [sheetIndex, ratingIsSet, ratingValue, rewatch, liked, watchList]);
       const handleSheetChanges = useCallback((index: number) => {
        console.log('handleSheetChanges', index);
        console.log("rating is set? ", ratingIsSet)
        console.log("rating value: ", ratingValue)
        setSheetIndex(index);
    }, []);
    const handleRatingChange = useCallback((value: number) => {
    setRatingValue(value);
    }, []);

    const handleRatingSetChange = useCallback((isSet: boolean) => {
        setRatingIsSet(isSet);
    }, []);
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

    // Close modal when BottomSheet is fully closed
    useEffect(() => {
        const handleSheetClose = async () => {
            if (sheetIndex === -1) {
                if (ratingIsSet) {
                  console.log('RATING IS SET');
                  const payload = {
                    essay: essayId,
                    date: new Date().toISOString().split('T')[0],
                    rating: ratingValue,
                    rewatch: rewatch,
                    review_text: "Blank review text for quick log",
                  }
                  console.log("Payload to create log: ", payload);
                  try{
                     await createLog(authFetch, payload);
                     console.log("Log created successfully");
                  }
                  catch(err){
                    console.error("Failed to create log: ", err);
                  }
                }
                router.back();
            }
        };
        handleSheetClose();
    }, [sheetIndex, essayId, ratingValue, rewatch, authFetch, ratingIsSet, router]);
    return(
        <GestureHandlerRootView
        style={styles.container}
        >
          <BottomSheet
          ref={bottomSheetRef}
          index={0}
          snapPoints={['90%']}
          enablePanDownToClose={true}
          onChange={handleSheetChanges}
          >
            <BottomSheetView style={styles.container}>
             {/* <MaterialCommunityIcons name = "arrow-left" size = {40} color = "white" onPress = {handlePress}/>  */}
              {/* <GetVideoEssayScreen id = {essayId}/> */}
              {sheetIndex === 0 && (
                <QuickLogScreen
                  id={essayId}
                  onRatingChange={handleRatingChange}
                  onRatingSetChange={handleRatingSetChange}
                  style={styles.container}
                />
              )}
              {sheetIndex === 1 && (
                <View>
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
                  <CreateLogScreen
                  id={essayId}
                  initialRating={ratingValue}
                  style={styles.container}
                  reviewText={reviewText}
                  date={date}
                  rewatch={rewatch}
                  onRatingChange={setRatingValue}
                  onReviewTextChange={setReviewText}  // ← pass setter down
                  onDateChange={setDate}              // ← pass setter down
                  onWatchedChange={setRewatch}
                />
                </View>
               
                
                
              )}
             
              {/* needs to detect if slider in quick log screen was touched 
              if it was touched, when the  user closes the quicklogscreen modal, it should automatically create a log with the rating they set and blank review text. If the slider was not touched, it should just close the modal without creating a log. If the user opens the quicklogscreen modal and sets a rating but does not click submit, when they close the modal it should still create a log with the rating they set.  
              if the user touches the slider and then opens the bottomsheet view to createlogscreen the slider value should go to createlogscreen and be prepopulated there.  
              */}
              {/* don't call to API to add videoessay to watchlist or make rating until  */}
            {/* <QuickLogScreen id = {essayId}/> */}
            </BottomSheetView>
          </BottomSheet>
        </GestureHandlerRootView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 10
        // paddingHorizontal: 20,
        // paddingTop: 30,
        // paddingBottom: 20,
    },
    buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
   
  },
});

 