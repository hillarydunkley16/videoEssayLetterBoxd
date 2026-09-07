import { useState } from 'react';
import {View, Text, TextInput, Button, Switch , Platform, Touchable, TouchableOpacity, StyleSheet} from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router';
import { createLog } from '../api/logs';
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuthPost} from '../api/authPost';
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { likeLog } from '../api/logs';
import Slider from '@react-native-community/slider';
import { Rating } from 'react-native-ratings';
type Props = {
    id: String;
    style: object;
    onRatingChange?: (value: number) => void;
    onRatingSetChange?: (isSet: boolean) => void;
    onWatchedChange?: (watched: boolean) => void;
    onLikedChange?: (liked: boolean) => void;
    onWatchListChange?: (inWatchList: boolean) => void;
    initialRating?: number;
}
// date is automatically set to today's date 
// review text will be blank  
// 
export default function QuickLogScreen( { id, onRatingChange, onRatingSetChange, style, initialRating}: Props){
    
    // console.log("QuickLogScreen mounted");
    const authFetch = useAuthPost();
    const [rating, setRating] = useState<number>(initialRating ?? 0);
    const [reviewText, setReviewText] = useState(""); 
    const [rewatch, setRewatch] = useState(false); 
    const [error, setError] = useState(""); 
    const [loading, setLoading] = useState(false); 
    const [date, setDate] = useState(new Date());
    const [showPicker, setShowPicker] = useState(false);
    const [liked, setLiked] = useState(false);
    const [ratingIsSet,  setRatingIsSet] = useState(false);
    const [watchList, setWatchList] = useState(false);
    const [sheetIndex, setSheetIndex] = useState(0);
    // const dateValue = date ? date.toISOString().split('T')[0] : '';
    // console.log("QUICK LOG SCREEN");
    // console.log("quick log screen got id ", id)
    // Handle web date input change
    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        console.log(value)
        setDate(new Date(value));
  
    };
    const handleWatchList = async () => {
        // similar to handle like but for watchlist status
        if (!id) return;
        
        setWatchList((prev) => !prev);
    }
    const handleLike = async () => {
            if (!id) return;
            const result = await likeLog(id.toString(), authFetch);
            // setLikesCount(result.data.likes_count);
            setLiked(result.data.liked ?? ((prev) => !prev));
        }
    const handleWatched = async () => {
        // similar to handle like but for watched status
        if (!id) return;
        
        setRewatch((prev) => !prev);
    }
    const router = useRouter();
    async function handleSubmit() {
        setError("")
        const ratingNumber = Number(rating); 

        if (isNaN(ratingNumber)){
            setError("Rating must be a number"); 
            return; 
        }
        if (ratingNumber < 0 || ratingNumber > 10){
            setError("Rating must be between 0 and 10"); 
            return; 
        }
        try {
            setLoading(true); 
            console.log(id)
            console.log(date.toISOString().split('T')[0])
            await createLog(authFetch, {
                essay: id, 
                date: new Date().toISOString().split('T')[0], // Format as YYYY-MM-DD
                rating: ratingNumber, 
                review_text: "", 
                rewatch: rewatch         
            });
           
            setRating(0);
            setReviewText("");
            setRewatch(false);
            alert("log created!");
            router.replace('/');
        } catch(err){
            setError("failed to create log");
            //i need a specific error message for if the user has already created a log for this essay.
            // if (err.response == 400){
            //     setError("You have already created a log for this essay");
            // }
            console.error(err)
        } finally {
            setLoading(false)
        }
    }
    // watched, liked, add to watchlist 
    // quick log with just rating and date, then option to add review text later?
    return (
        <View style = {style}>
            <View style = {styles.iconRow}>
            <TouchableOpacity onPress={handleLike} style={[styles.likeButton]}>
                    <MaterialCommunityIcons name = {liked ? "heart" : "heart-outline"} size={30} color={liked ? "red" : "black"} />
            <ThemedText style={styles.likeButtonText}>{liked ? 'Liked' : 'Like'} </ThemedText>
           </TouchableOpacity>
            <TouchableOpacity onPress = {handleWatched}>
                <MaterialCommunityIcons name= {rewatch ? "eye" : "eye-outline"} size={30} color="black" />
                <ThemedText style={styles.likeButtonText}>Watched</ThemedText>

                {/* <ThemedText>
                    Review or Log =
                </ThemedText> */}
            </TouchableOpacity>
            <TouchableOpacity onPress = {handleWatchList}>
                <MaterialCommunityIcons name= {watchList ? "clock-minus" : "clock-plus-outline"} size={30} color="black" />
                <ThemedText style={styles.likeButtonText}>Watchlist</ThemedText>
            </TouchableOpacity>
           </View>
            <Rating 
            ratingCount={5}
            startingValue={rating}            
            onSwipeRating={(value: number) => {
                setRating(value);
                onRatingChange?.(value);
                if (!ratingIsSet) {
                    setRatingIsSet(true);
                    onRatingSetChange?.(true);
                }
            }}            onFinishRating={(value: number) => {
                setRating(value);
                onRatingChange?.(value);
                if (!ratingIsSet) {
                    setRatingIsSet(true);
                    onRatingSetChange?.(true);
                }
            }}
            />
            {error ? <ThemedText style={{ color: 'red' }}>{error}</ThemedText> : null}
           
            {/* <Button title = {"Add Review"} onPress = {() => setSheetIndex(1)} /> */}
            <Button title = {"Share"} />
            <Button title = {"Add Review"} onPress = {() => router.push(`/logVideoModal?essayId=${id}`)} />
            <Button title = {"Add to List"} onPress = {() => router.push(`/(modals)/listVideoEssay?essayId=${id}`)} />
            {/* setSheetIndex to -1 to close the modal */}
            <Button title = {"Done"} />
            </View>
    )
}

const styles = StyleSheet.create({
    largeContainer: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 30,
        paddingBottom: 20,
        margin: 20
    },
    container: {
        width: '100%',
        marginBottom: 16,
    }, 
    likeButton: {
    // backgroundColor: '#1f2937',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  likeButtonText: {
    // color: '#fff',
    fontWeight: '600',
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'space-between'
  }
});