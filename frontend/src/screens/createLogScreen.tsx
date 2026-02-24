import { useState } from 'react';
import {View, Text, TextInput, Button, Switch , Platform} from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router';
import { createLog } from '../api/logs';
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

import DatePicker  from 'react-native-date-picker'
import { useAuthPost} from '../api/authPost';
type Props = {
    id: String;
}
export default function CreateLogScreen( { id }: Props){
    const authFetch = useAuthPost();
    const [rating, setRating] = useState(""); 
    const [reviewText, setReviewText] = useState(""); 
    const [rewatch, setRewatch] = useState(false); 
    const [error, setError] = useState(""); 
    const [loading, setLoading] = useState(false); 
    const [date, setDate] = useState("")
    // const dateValue = date ? date.toISOString().split('T')[0] : '';

    // Handle web date input change
    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        console.log(value)
        setDate(value);
  
    };
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
            await createLog(authFetch, {
                essay: id, 
                date: date, // Format as YYYY-MM-DD
                rating: ratingNumber, 
                review_text: reviewText, 
                rewatch: rewatch         
            });
           
            setRating("");
            setReviewText("");
            setRewatch(false);
            alert("log created!");
            router.replace('/');
        } catch(err){
            setError("failed to create log");
            console.error(err)
        } finally {
            setLoading(false)
        }
    }
    return (
        <ThemedView style = {{padding: 16}}>
            <ThemedText>
                {id}
            </ThemedText>
            <ThemedText>
                Add a log
            </ThemedText>
            {error ? (
                <ThemedText>
                    {error}
                </ThemedText>
            ) : null}
            {Platform.OS === 'web' ? (
                <input 
                type = "date"
                value = {date}
                onChange = {handleDateChange}
                />
            ): <Text>Not web</Text>}
            <ThemedText> Rating (0-10)</ThemedText> 
            <TextInput
                value = {rating}
                onChangeText={setRating}
                keyboardType='numeric'
                style={{
                    borderWidth: 1,
                    borderColor: "black",
                    padding: 8,
                    marginBottom: 12,
                  }}
            />
            <ThemedText> Review</ThemedText> 
            <TextInput 
                value = {reviewText}
                onChangeText={setReviewText}
                multiline
                style={{
                    borderWidth: 1,
                    borderColor: "black",
                    padding: 8,
                    marginBottom: 12,
                  }}
            />
             <View style={{ flexDirection: "row", alignItems: "center" }}>
                <ThemedText> Rewatch?</ThemedText> 
                <Switch value={rewatch} onValueChange={setRewatch} />
            </View>
            <Button 
                title = {loading ? "Saving..." : "Save Log"}
                onPress={handleSubmit}
                disabled = {loading}
            />
        </ThemedView>
    );
}