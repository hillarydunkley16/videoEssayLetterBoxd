import { useEffect, useState } from "react";
import { View, Text, FlatList, Image, Pressable, TouchableOpacity } from "react-native";
import { fetchVideoEssays } from "../api/videos";
import { VideoEssay } from "../types/videoEssay";
import {Link} from "@react-navigation/native";
import {router} from 'expo-router';
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
export default function VideoEssayListScreen() {
  // Holds data returned from the API
  const [videos, setVideos] = useState<VideoEssay[]>([]);
  const [loading, setLoading] = useState(true);
    
  // Runs once when the screen loads
  useEffect(() => {
    async function loadVideos() {
      try {
        console.log("load videos function")
        const data = await fetchVideoEssays();
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
  }, []);

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
          <ThemedText style={{ fontWeight: "bold" }}>{item.title}</ThemedText>
          <View style={{ padding: 12 }}>
        {item.thumbnail && (
          <Image
            source={{ uri: item.thumbnail }}
            style={{ width: "100%", height: 180 }}
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
