import { useEffect, useState } from "react";
import { View, Text, FlatList, Image, Pressable, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { fetchVideoEssays } from "../api/videos";
import { VideoEssay } from "../types/videoEssay";
import {Link} from "@react-navigation/native";
import {router} from 'expo-router';
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAuth } from "@clerk/clerk-expo";
import { tokenCache } from "../helpers/tokenCache";
export default function VideoEssayListScreen() {
  // Holds data returned from the API
  const [videos, setVideos] = useState<VideoEssay[]>([]);
  const [loading, setLoading] = useState(true);
  const {getToken,  isSignedIn, isLoaded} = useAuth(); 
  // Runs once when the screen loads
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    async function loadVideos() {
      try {
        const token = await getToken();
        if (!token) {
          console.warn("No token found");
          return;
        }
        console.log("!!token!!: ", token);
        console.log("Is signed in: ", isSignedIn);
        console.log("Is auth loaded: ", isLoaded);
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
  }, [isLoaded, isSignedIn]);

  if (loading) {
    return <Text>Loading…</Text>;
  }
  // console.log(videos.map(v => v.id));


  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 12 }}>
        {videos.map((item) => (
          <TouchableOpacity 
            key={item.public_id}
            onPress={() => router.push(`/modal?essayId=${item.public_id}`)}
          >
            <View style={{ width: '100%', padding: 12, marginBottom: 12 }}>
              {item.thumbnail && (
                <Image
                  source={{ uri: item.thumbnail }}
                  style={style.thumbnail}
                />
              )}
              <ThemedText style={{ fontWeight: 'bold', marginTop: 8 }}>
                {item.title}
              </ThemedText>
              {item.channel_name && (
                <ThemedText>{item.channel_name}</ThemedText>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </ThemedView>
   
  );
}

const style = StyleSheet.create({
  container: {
    // alignItems: 'flex-start', 
    // gap: 12, 
    // flex: 1,
  }, 
  thumbnail: {
    width: 350, 
    height: 200
  }
})