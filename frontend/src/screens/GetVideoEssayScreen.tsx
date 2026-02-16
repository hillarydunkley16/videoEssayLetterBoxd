import { View, Text, FlatList, Image } from "react-native";
import { fetchVideoEssays, getAVideoEssay } from "../api/videos";
import { VideoEssay } from "../types/videoEssay";
import { Log } from "../types/log";
import {VideoEssayData} from "../types/videoEssay";
import {useEffect, useState} from "react";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useLocalSearchParams} from 'expo-router';
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
// import { View, Text, FlatList, Image } from "react-native";
type Props = {
  id: string;
}
export default function GetVideoEssayScreen(id: Props){
    const [video, setVideo] = useState<VideoEssay | null>(null);
    const [logs, setLogs] = useState<Log[]>([]);
    const [loading, setLoading] = useState(true); 
    const [logCount, setLogCount] = useState<number>(0); 
    const {essayId}= useLocalSearchParams<{ essayId: string }>()
    useEffect(() => {
        async function loadVideo() {
          try {
            const data = await getAVideoEssay(essayId);
            console.log(data);
            console.log("data.logs: ", data.logs)
            setVideo(data.video);
            setLogs(data.logs);
            // console.log("logs: ", logs)
            setLogCount(data.log_count);
          } finally {
            setLoading(false);
          }
        }
      
        loadVideo();
      }, [essayId]);
    
    if (!video) return <Text>Loading...</Text>;
    return (
        <SafeAreaProvider>
          <SafeAreaView>
            <ThemedView style={{ padding: 12 }}>
          {video.thumbnail && (
            <Image
              source={{ uri: video.thumbnail }}
              style={{ width: 200, height: 150 }}
            />
            
          )}

          <ThemedText style={{ fontWeight: "bold", marginTop: 8 }}>
            {video.title}
          </ThemedText>

          {video.channel_name && (
            <ThemedText>{video.channel_name}</ThemedText>
          )}
          </ThemedView>

          </SafeAreaView>

        </SafeAreaProvider>
        
    )
}

