import { View, Text, FlatList, Image } from "react-native";
import { fetchVideoEssays, getAVideoEssay } from "../api/videos";
import { VideoEssay } from "../types/videoEssay";
import { Log } from "../types/log";
import {VideoEssayData} from "../types/videoEssay";
import {useEffect, useState} from "react";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
export default function VideoInfoLogs({ id }: { id: string}){
    const [video, setVideo] = useState<VideoEssay | null>(null);
    const [logs, setLogs] = useState<Log[]>([]);
    const [loading, setLoading] = useState(true); 
    const [logCount, setLogCount] = useState<number>(0); 
    const {essayId}= useLocalSearchParams<{ essayId: string }>()
    useEffect(() => {
            async function loadVideo() {
              try {
                const data = await getAVideoEssay(essayId);
          
                setVideo(data.video);
                console.log("video: ", data.video)
                setLogs(data.logs);
                console.log("data.logs: ", data.logs)
                // console.log("logs: ", logs)
                setLogCount(data.log_count);
              } finally {
                setLoading(false);
              }
            }
          
            loadVideo();
          }, [id]);
    return(
      <SafeAreaProvider>
        <SafeAreaView>
        <ThemedView>
            {logs.length == 0 ? (
                <ThemedText>No logs yet...</ThemedText>
            ):<FlatList 
            data = {logs}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({item}) => (
                <SafeAreaView>
                  <ThemedText>{item.date?.toString()}</ThemedText>
                <ThemedText>{item.owner?.toString()}</ThemedText>
                <ThemedText>{item.review_text}</ThemedText>
                </SafeAreaView>
            )}
            /> } 
            
        </ThemedView>
        </SafeAreaView>
      </SafeAreaProvider>
        
        
    )
}