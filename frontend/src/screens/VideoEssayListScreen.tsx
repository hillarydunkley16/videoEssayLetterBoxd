import { useEffect, useState } from "react";
import { View, Text, FlatList, Image, Pressable, TouchableOpacity, StyleSheet } from "react-native";
import { fetchVideoEssays } from "../api/videos";
import { VideoEssay } from "../types/videoEssay";
import {Link} from "@react-navigation/native";
import {router} from 'expo-router';
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAuth } from "@clerk/clerk-expo";
export default function VideoEssayListScreen() {
  // Holds data returned from the API
  const [videos, setVideos] = useState<VideoEssay[]>([]);
  const [loading, setLoading] = useState(true);
  const {getToken,  isSignedIn} = useAuth(); 
  // Runs once when the screen loads
  useEffect(() => {
    console.log("isSignedIn: ", isSignedIn); 
    if (!isSignedIn) return;
    async function loadVideos() {
      try {
        const token = await getToken();
        console.log("token: ", token);
        console.log("load videos function")
        const data = await fetchVideoEssays(token!);
        console.log(data.results)
        setVideos(data.results);
        console.log("IDS: ",data.results.map(v => v.id) );
        console.log("set videos: ", data);
      } catch (error) {
        console.error("Failed to load videos:", error);
      } finally {
        setLoading(false);
      }
    }

    loadVideos();
  }, [isSignedIn]);

  if (loading) {
    return <Text>Loading…</Text>;
  }
  // console.log(videos.map(v => v.id));


  return (
    <ThemedView>
       
       <FlatList
    data={videos}
    horizontal
    keyExtractor={(item: VideoEssay) => item.public_id}
    renderItem={({ item }) => (
      <TouchableOpacity onPress={() => router.push(`/modal?essayId=${item.public_id}`)}>
          {/* <ThemedText style={{ fontWeight: "bold" }}>{item.title}</ThemedText> */}
          <View style={{ padding: 12 }}>
            
        {item.thumbnail && (
          <Image
            source={{ uri: item.thumbnail }}
            style={style.thumbnail}
          />
        )}
        
        <ThemedText style={{ fontWeight: "bold", marginTop: 8 }}>
          {item.title}
        </ThemedText>

        {item.channel_name && (
          <ThemedText>{item.channel_name}</ThemedText>
        )}
      </View>
      </TouchableOpacity>
  
    )}
    />
    </ThemedView>
   
  );
}

const style = StyleSheet.create({
  container: {
    alignItems: 'flex-start', 
    gap: 12
  }, 
  thumbnail: {
    width: 350, 
    height: 200
  }
})