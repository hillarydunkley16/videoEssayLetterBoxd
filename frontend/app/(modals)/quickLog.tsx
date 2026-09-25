import { Link,  router , useLocalSearchParams} from 'expo-router';
import { Keyboard, StyleSheet, Text, Button, View } from 'react-native';
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
import { useAuth } from '@clerk/clerk-expo';
import { createLog } from '@/src/api/logs';
import { addToWatchlist } from '@/src/api/collection';
import { fetchProfile } from '@/src/api/users';
import { useAuthPost } from '@/src/api/authPost';
import { showToast } from '@/src/helpers/toast';
import { validationErrors, validationMessage } from '@/src/helpers/validationMessage';

export default function QuickLog() {
    const bottomSheetRef = useRef<BottomSheet>(null);
    const authFetch = useAuthPost();
    const { getToken } = useAuth();
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
    // Shown under the review box (next to the character count), not in the top banner.
    const [reviewError, setReviewError] = useState("");
    // useAuthPost returns a fresh function each render, so the close effect below re-runs
    // on every re-render; this makes sure closing the sheet logs at most once.
    const closeHandledRef = useRef(false);
    const submittingRef = useRef(false);
    const isPresented = router.canGoBack();
    const params = useLocalSearchParams<{essayId?: string | string[]}>();
    const essayId = 
      typeof params.essayId === "string" ? 
      params.essayId
      : Array.isArray(params.essayId)
      ? params.essayId[0] 
      : undefined;
    
    // console.log("essayID found", essayId)
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
    // Add Review replaces the sheet with the full review modal, which creates the log
    // itself — so closing must not also auto-save a quick log for the same watch.
    const handleAddReview = useCallback(() => {
        closeHandledRef.current = true;
        router.replace({
            pathname: '/logVideoModal',
            params: { essayId: essayId as string, rating: String(ratingValue) },
        });
    }, [essayId, ratingValue]);
    const handleRatingChange = useCallback((value: number) => {
    setRatingValue(value);
    }, []);

    const handleRatingSetChange = useCallback((isSet: boolean) => {
        setRatingIsSet(isSet);
    }, []);
    // Best-effort: a failure here shouldn't undo an already-saved log, so it's
    // logged rather than surfaced as a save error.
    const addEssayToWatchlist = async (id: string) => {
        try {
            const token = await getToken();
            const profile = await fetchProfile(token!);
            await addToWatchlist(id, profile.watchList.public_id, authFetch);
        } catch (err) {
            console.error("Failed to add to watchlist:", err);
        }
    };
    const handleSubmit = async () => {
        if (typeof essayId !== "string") return;
        // Guard against double-taps creating duplicate logs.
        if (submittingRef.current) return;
        submittingRef.current = true;
        setLoading(true);
        setError("");
        setReviewError("");
        try{
            const payload = {
                essay: essayId,
                date: date.toISOString().split('T')[0],
                rating: ratingValue,
                review_text: reviewText,
                rewatch: rewatch
            }

            await createLog(authFetch, payload);
            if (watchList) await addEssayToWatchlist(essayId);
            // The log is saved: closing the sheet must not also auto-save a quick log.
            closeHandledRef.current = true;
            showToast('Log created');
            router.back();
        } catch (err) {
            console.error("Error creating log:", err);
            const fieldErrors = validationErrors(err);
            setReviewError(fieldErrors?.review_text ?? "");
            setError(fieldErrors ? (validationMessage(err, ['review_text']) ?? "") : "Couldn't save this log — try again.");
            submittingRef.current = false;
            setLoading(false);
        }
    }

    // Close modal when BottomSheet is fully closed
    useEffect(() => {
        const handleSheetClose = async () => {
            if (sheetIndex === -1 && !closeHandledRef.current) {
                closeHandledRef.current = true;
                if (ratingIsSet && typeof essayId === "string") {
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

    if (typeof essayId !== "string") {
      return (
        <View>
          <Text>Invalid video id</Text>
        </View>
      );
    }
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
                  onDone={() => bottomSheetRef.current?.close()}
                  onAddReview={handleAddReview}
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
                {error ? <Text style={styles.errorText}>{error}</Text> : null}
                  <CreateLogScreen
                  id={essayId}
                  initialRating={ratingValue}
                  style={styles.container}
                  reviewText={reviewText}
                  reviewError={reviewError}
                  date={date}
                  rewatch={rewatch}
                  onRatingChange={setRatingValue}
                  onReviewTextChange={(text) => { setReviewText(text); setReviewError(""); }}
                  onDateChange={setDate}              // ← pass setter down
                  onWatchedChange={setRewatch}
                  onWatchListChange={setWatchList}
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
    errorText: {
        color: 'red',
        textAlign: 'center',
        paddingHorizontal: 10,
        paddingTop: 8,
    },
    buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
   
  },
});

 