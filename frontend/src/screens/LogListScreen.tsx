import { useEffect, useState } from "react";
import { View, Text, FlatList, Image, ActivityIndicator, TouchableOpacity } from "react-native";
import { fetchLogs } from "../api/logs";
import { Log } from "../types/log";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { useAuth } from '@clerk/clerk-expo'
import { getAVideoEssay } from "../api/videos";
import { VideoEssay } from "../types/videoEssay";
import { router } from "expo-router";
type Props = {
  id: string; 
  onTitleLoaded? : (title: string) => void;
}
export default function LogListScreen({id, onTitleLoaded}: Props) {
  // Holds data returned from the API
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [video, setVideo] = useState<VideoEssay>();
  const {getToken} = useAuth(); 
  // Runs once when the screen loads
  useEffect(() => {
    async function loadLogs() {
      try {
        const token = await getToken();
        const data = await getAVideoEssay(id, token! );
        // setVideo(data.video);
        console.log("video: ", data.video)
        setLogs(data.logs);
        console.log("token: ", token);
        console.log("load videos function")
        onTitleLoaded?.(data.video.title); 
        // const data = await fetchLogs(token!);
        // console.log(data.results)
        // setlogs(data.results);
        console.log("set videos: ", data);
      } catch (error) {
        console.error("Failed to load videos:", error);
      } finally {
        setLoading(false);
      }
    }

    loadLogs();
  }, []);

  if (loading) {
    return <ActivityIndicator size="large" color="#0000ff" />;
  }


  return (
    <ThemedView> 
      {logs.length == 0 ? (
        <ThemedText>No logs yet...</ThemedText>
      ): 
      <FlatList
      data={logs}
      keyExtractor={(item) => item.id.toString()}
      renderItem={({ item }) => (
    <TouchableOpacity 
        style={{ padding: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderColor: "#ccc" }}
        onPress={() => router.push(`/singleLog?logId=${item.public_id}`)}
    >
        {/* left side — rating and review */}
        <ThemedView style={{ flex: 1, marginRight: 12 }}>
            <ThemedText style={{ fontWeight: "bold" }}>{item.rating}/5</ThemedText>
            {item.review_text && (
                <ThemedText>{item.review_text}</ThemedText>
            )}
        </ThemedView>

        {/* right side — profile image and username */}
        <ThemedView style={{ alignItems: "center", gap: 4 }}>
            <Image
                source={{ uri: item?.owner_image || 'https://img.clerk.com/eyJ0eXBlIjoiZGVmYXVsdCIsImlpZCI6Imluc18zOHFPakFDRkhNV1FPNXVBSTdBV20yQnY5YkgiLCJyaWQiOiJ1c2VyXzM5R2w1OFp2OGhZWHhjbTYzYjRUYnpuaElWbiJ9?width=96' }}
                style={{ width: 30, height: 30, borderRadius: 999, alignSelf: "flex-end" }}
            />
            <ThemedText style={{ fontSize: 12 }}>{item.owner}</ThemedText>
        </ThemedView>
    </TouchableOpacity>
)}
      
    />
    }
       
    </ThemedView>
    
  );
}
