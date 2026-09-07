import { useState, useEffect } from 'react';
import {View, TextInput, Button, Switch , Platform, StyleSheet, TouchableOpacity} from 'react-native'
import { useRouter } from 'expo-router';
import { createLog } from '../api/logs';
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import DateTimePicker from '@react-native-community/datetimepicker';
import Slider from '@react-native-community/slider';
import { useAuthPost} from '../api/authPost';
import { Rating } from 'react-native-ratings';
import { MaterialCommunityIcons } from '@expo/vector-icons';
type Props = {
    id: string;
    initialRating?: number;
    style: object;
    reviewText: string; 
    date: Date;
    rewatch: boolean;
    onRatingChange?: (value: number) => void;
    onRatingSetChange?: (isSet: boolean) => void;
    onWatchedChange?: (watched: boolean) => void;
    onLikedChange?: (liked: boolean) => void;
    onWatchListChange?: (inWatchList: boolean) => void;
    onReviewTextChange: (text: string) => void;
    onDateChange: (date: Date) => void;
}

export default function CreateLogScreen( 
    {
    id,
    initialRating,
    style,
    onRatingChange,
    onRatingSetChange,
    rewatch,
    onReviewTextChange,
    onDateChange,
    onWatchedChange,
    reviewText,
    date
    }: Props){
    const authFetch = useAuthPost();
    
    const [rating, setRating] = useState<number>(initialRating ?? 0);
    const [watchList, setWatchList] = useState(false);
    
    useEffect(() => {
        console.log("CreateLogScreen mounted with id ", id, " and initialRating ", initialRating);
    }, [id]);

    useEffect(() => {
        if (initialRating !== undefined) {
            setRating(initialRating);
        }
    }, [initialRating]);
    // const [reviewText, setReviewText] = useState(""); 
    // const [rewatch, setRewatch] = useState(false); 
    const [error, setError] = useState(""); 
    const [loading, setLoading] = useState(false); 
    // const [date, setDate] = useState(new Date());
    const [showPicker, setShowPicker] = useState(false);
    const [ratingIsSet,  setRatingIsSet] = useState(false);
    // const dateValue = date ? date.toISOString().split('T')[0] : '';

    // Handle web date input change
    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        console.log(value)
        onDateChange(new Date(value))
  
    };
    const router = useRouter();
    const handleWatched = async () => {
        // similar to handle like but for watched status
        if (!id) return;
        
        onWatchedChange?.(true);
    }
    const handleWatchList = async () => {
        // similar to handle like but for watchlist status
        if (!id) return;
        
        setWatchList((prev) => !prev);
    }
    async function handleSubmit() {
        setError("")
        const ratingNumber = rating;

        if (isNaN(ratingNumber)){
            setError("Rating must be a number"); 
            return; 
        }
        if (ratingNumber < 0 || ratingNumber > 5){
            setError("Rating must be between 0 and 5"); 
            return; 
        }
        try {
            setLoading(true); 
            console.log(id)
            console.log(date.toISOString().split('T')[0])
            await createLog(authFetch, {
                essay: id, 
                date: date.toISOString().split('T')[0], // Format as YYYY-MM-DD
                rating: ratingNumber, 
                review_text: reviewText, 
                rewatch: rewatch         
            });
           
            setRating(0);
            onReviewTextChange("");
            onWatchedChange?.(false);
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
        <ThemedView style = {style}>
            {error ? (
                <ThemedText>
                    {error}
                </ThemedText>
            ) : null}
            
            <View style = {{padding: 20}}> 
                <View style = {[styles.buttonRow, {marginBottom: 20}]}> 
                    <ThemedText>I watched this on: </ThemedText>
                    <DateTimePicker
                        value={date}
                        mode="date"
                        maximumDate={new Date()}
                        onChange={(event, selectedDate) => {
                            // setShowPicker(false);
                            if (selectedDate) {
                                console.log("Selected date: ", selectedDate);
                                onDateChange(selectedDate);
                                // format for Django
                                const formatted = selectedDate.toISOString().split('T')[0];
                                // use formatted when submitting
                            }
                        }}
                        
                    />
                </View>
                <View style={{marginBottom: 20}}>
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
                </View>
        
            
                <TextInput 
                    value = {reviewText}
                    placeholder='Add review...'
                    onChangeText={onReviewTextChange}
                    multiline
                    style={{
                        marginTop: 20,
                        borderTopWidth: 1,
                        borderColor: "black",
                        padding: 8,
                        marginBottom: 12,
                        height: 300,
                    }}
                />

            </View>
            
           
              
            {/* <View style={styles.iconRow}>
                <TouchableOpacity onPress = {handleWatched}>
                <MaterialCommunityIcons name= {rewatch ? "eye" : "eye-outline"} size={30} color="black" />
                <ThemedText style={styles.likeButtonText}>Watched</ThemedText>

                {/* rate slider one to ten? */}
                {/* <ThemedText>
                    Review or Log
                </ThemedText> */}
            {/* </TouchableOpacity>
            <TouchableOpacity onPress = {handleWatchList}>
                <MaterialCommunityIcons name= {watchList ? "clock-minus" : "clock-plus-outline"} size={30} color="black" />
                <ThemedText style={styles.likeButtonText}>Watchlist</ThemedText>
            </TouchableOpacity> */}
            {/* </View>  */}

        </ThemedView>
    );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
   
  },
   likeButtonText: {
    // color: '#fff',
    fontWeight: '600',
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'space-between', 
    marginBottom: 'auto'
  }
})