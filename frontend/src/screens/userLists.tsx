import { useEffect, useState } from 'react';
import {View, Text, TextInput, Button, Switch , Platform, Touchable, TouchableOpacity, StyleSheet, FlatList} from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router';
import { createLog } from '../api/logs';
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuthPost} from '../api/authPost';
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { likeLog } from '../api/logs';
import Slider from '@react-native-community/slider';
import { fetchUsersCollections } from '../api/collection';
import { Collection } from '../types/collection';
import { useAuth } from '@clerk/clerk-expo'
import {addVideoEssayToCollection} from '../api/collection'; 
// type Props = {
//     lists
// }
export default function UserListsScreen({ essayId }: { essayId: string }){
    const router = useRouter();
    const [collections, setCollections] = useState<Collection[]>([]);
    const { getToken } = useAuth()
    const authFetch = useAuthPost();
    useEffect(() => {
        async function fetchCollections(){
            try{
                const token = await getToken(); 
                if (!token) return 
                const data = await fetchUsersCollections(token);
                console.log("fetched collections: ", JSON.stringify(data));
                setCollections(data.results); 
            }
            catch (err) {
                console.error(err)
            }
        }
        fetchCollections()
    }, [])

    async function addVideoToList(collection_public_id: string){
        const token = await getToken();
        if (!token) return 
        await addVideoEssayToCollection(token, essayId, collection_public_id )
    }
    return (
        <ThemedView>
            {/* <ThemedText>User Lists</ThemedText> */}

            <Button title = "New list"/>
            <FlatList
            data = {collections}
            keyExtractor={(item) => item.public_id.toString()}
            renderItem={({item}) => (
                //on click add video to list 
                <TouchableOpacity onPress = {() => addVideoToList(item.public_id)}> 
                    
                    <View style={{padding: 10, borderBottomWidth: 1, borderBottomColor: '#ccc'}}>
                        <Text style={{fontSize: 18}}>{item.name}</Text>
                        
                        <Text style={{color: '#666'}}>{item.owner.toString()}</Text>
                        <MaterialCommunityIcons name="plus-thick" size={24} color="black" />
                    </View>
                 </TouchableOpacity>
                
            )}
            />
             
         </ThemedView>
    )
}