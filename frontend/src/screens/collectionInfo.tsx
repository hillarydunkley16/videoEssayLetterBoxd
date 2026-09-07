import { View, Text, Image, StyleSheet, ActivityIndicator, Linking, TouchableOpacity, Platform, FlatList } from 'react-native'
import { getAVideoEssay } from '../api/videos'
import { VideoEssay } from '../types/videoEssay'
import { useEffect, useState } from 'react'
import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'
import { useAuth } from '@clerk/clerk-expo'
import { fetchACollection } from '../api/collection'
import { Collection } from '../types/collection'


export default function CollectionInfo({ public_id }: { public_id: string }){
    const { getToken, isLoaded, isSignedIn } = useAuth();
    console.log(typeof public_id, public_id)
    const [collection, setCollection] = useState<Collection>();
    const [loading, setLoading] = useState(true); 
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!public_id) return
        async function loadCollection(){
            try{
                const token = await getToken()
                console.log(`TYPE OF PUBLIC ID ${typeof public_id}`)
                const data = await fetchACollection(public_id, token!)
                setCollection(data)
                console.log(`DATA.RESULTS IS ${data}`)
                
            }
            catch(err){
                console.error(`Load collection error: ${err}`)
                setError("Failed to load collection")
            } 
            
        }
        loadCollection();

    }, [public_id])
   
    return(
        <ThemedView style = {styles.container}>
            <ThemedText>
                Text
            </ThemedText>
            <ThemedText>
                COLLECTION {collection?.name}
            </ThemedText>
            <ThemedText>
                COLLECTION OWNER {collection?.owner.toString()}
            </ThemedText>
           <FlatList
      data={collection?.essays}
      keyExtractor={(item) => item}
      renderItem={({ item }) => (
        <ThemedView style={{ padding: 12, flex: 1 }}>
            <ThemedText>{item.log_count}</ThemedText>
          
        </ThemedView>
      )}
    />
        </ThemedView>
    )
}


const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 350,
    alignItems: 'flex-start',
    gap: 12,
    ...Platform.select({
      web: {
        width: 350,
      },
    }),
  },
  thumbnail: {
    width: '100%',
    aspectRatio: 2.25 / 1.25,
    borderRadius: 12,
    ...Platform.select({
      web: {
        width: 350,
        height: 233,
      },
    }),
  },
})