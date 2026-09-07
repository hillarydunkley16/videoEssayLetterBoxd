import { fetchCollections } from "@/src/api/collection";
import { Collection } from "@/src/types/collection";
import { useAuth } from "@clerk/clerk-expo";
import { useEffect, useState } from "react";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { FlatList, TouchableOpacity } from "react-native";
import {router} from 'expo-router';
export default function PopularLists(){
    const [collections, setCollections] = useState<Collection[]>([]);
    const {getToken} = useAuth();
    useEffect(() => {
        async function loadCollections() {
            try{
                const token = await getToken();
                const data = await fetchCollections(token!);
                
                // console.log("PRINTING IDS", data.results.filter(item => !item.name.includes("Watchlist") ));
                const filteredData = data.results.filter(
                    item => !item.name.includes("Watchlist")
                )
                console.log("FILTERED DATA: ", filteredData)
                setCollections(filteredData);
            }
            catch(error){
                console.error("Failed to load collections: ", error);
            }
    }
    loadCollections();
}, []);

return (
    
         <ThemedView style={{flex: 1, alignItems: "center", justifyContent: "center"}}>
        <ThemedText style={{fontSize: 24, fontWeight: "bold", marginBottom: 20}}>Popular Lists</ThemedText>
         <FlatList  data = {collections}
            renderItem = {({item}) => (
                <TouchableOpacity
                onPress = {() => router.push(`/collectionDetail?publicId=${item.public_id}`)}
                >
                <ThemedView key={item.public_id} style={{marginBottom: 15, padding: 10, borderWidth: 1, borderColor: "gray", borderRadius: 5, width: "80%"}}>
                    <ThemedText>{item.id}</ThemedText>
                    <ThemedText style={{fontSize: 18, fontWeight: "bold"}}>{item.name}</ThemedText>
                    <ThemedText style={{fontSize: 14, color: "gray"}}>By {item.owner.toString()}</ThemedText>
                </ThemedView>
                </TouchableOpacity>
            )}
            keyExtractor={(item) => item.public_id}
            />
    </ThemedView>
    
    
   
            
      

    
)
}