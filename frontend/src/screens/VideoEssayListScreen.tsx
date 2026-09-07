import { useEffect, useState } from "react";
import { View, Text, FlatList, Image,ActivityIndicator, Pressable, TouchableOpacity, StyleSheet, ScrollView, useWindowDimensions, Platform } from "react-native";
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
  const {width} = useWindowDimensions();
  const numColumns = Platform.OS === "web" ? 3: 2 
  // Runs once when the screen loads
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    async function loadVideos() {
      try {
        const token = await getToken();
        console.log(`TOKEN IS ${token}`)
        if (!token) {
          console.warn("No token found");
          return;
        }
        // console.log("!!token!!: ", token);
        console.log("Is signed in: ", isSignedIn);
        console.log("Is auth loaded: ", isLoaded);
        console.log("load videos function")
        const data = await fetchVideoEssays(token!);
        // console.log(data.results)
        setVideos(data.results);
        console.log("IDS: ",data.results.map(v => v.id) );
        // console.log("set videos: ", data); 
      } catch (error) {
        console.error("Failed to load videos:", error);
      } finally {
        setLoading(false);
      }
    }

    loadVideos();
  }, [isLoaded, isSignedIn]);

  if (loading) {
    return <ActivityIndicator size="large" color="#0000ff" style = {styles.loading}/>;
  }
  // console.log(videos.map(v => v.id));


  return (
    <ThemedView style={{ flex: 1 }}>
      <FlatList
        key={`videos-${numColumns}`}
        data={videos}
        numColumns={numColumns}
        keyExtractor={(item) => item.public_id}
        columnWrapperStyle={numColumns > 1 ? styles.columnWrapper : undefined}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/modal?essayId=${item.public_id}`)}
          >
            {item.thumbnail ? (
              <Image source={{ uri: item.thumbnail }} style={styles.thumbnail} />
            ) : null}
            <ThemedText style={styles.title}>{item.title}</ThemedText>
            {item.channel_name ? (
              <ThemedText style={styles.subtitle}>{item.channel_name}</ThemedText>
            ) : null}
          </TouchableOpacity>
        )}
      />
    </ThemedView>
   
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    padding: 12,
    paddingBottom: 24,
  },
  columnWrapper: {
    justifyContent: "space-between",
  },
  card: {
    flex: 1,
    minWidth: 0,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    marginHorizontal: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  thumbnail: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: "#e5e7eb",
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
  },
  loading: {
    justifyContent: "center",
    display: 'flex'
  }
})