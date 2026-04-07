import { FlatList, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { getAVideoEssay } from "../api/videos";
import { VideoEssay } from "../types/videoEssay";
import { Log } from "../types/log";
import { useEffect, useState } from "react";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import {router } from "expo-router";
import { useAuth, useUser } from "@clerk/clerk-expo";
export default function VideoInfoLogs({ id }: { id: string}){
    const [video, setVideo] = useState<VideoEssay | null>(null);
    const [logs, setLogs] = useState<Log[]>([]);
    const [loading, setLoading] = useState(true); 
    const [logCount, setLogCount] = useState<number>(0); 
    const { getToken } = useAuth();
    const { user } = useUser(); // Clerk hook
    useEffect(() => {
            if (!id) {
              setLoading(false);
              return;
            }

            async function loadVideo() {
              try {
                const token = await getToken();
                const data = await getAVideoEssay(id, token! );
                setVideo(data.video);
                console.log("video: ", data.video)
                setLogs(data.logs);
                console.log("data.logs: ", data.logs)
                setLogCount(data.log_count);
              } finally {
                setLoading(false);
              }
            }
          
            loadVideo();
          }, [id]);
    return (
      <ThemedView style={style.container}>
        {loading ? (
          <ThemedText>Loading...</ThemedText>
        ) : logs.length === 0 ? (
          <ThemedText>No logs yet...</ThemedText>
        ) : (
           <ScrollView contentContainerStyle={style.logContainer}>
            {logs.map((log) => (
              <TouchableOpacity key={log.public_id} onPress={() => router.push(`/singleLog?logId=${log.public_id}`)}>
                <ThemedText>{log.date?.toString()}</ThemedText>
                {log?.owner.toString() === user?.id ? (
                  <ThemedText>Review by Me</ThemedText>
                ) : (
                  <ThemedText>{log.owner}</ThemedText>
                )}
                <ThemedText>{log.review_text}</ThemedText>
              </TouchableOpacity>))}
        </ScrollView>
          
        )}
       
      </ThemedView>
      
    );

}
const style = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 350,
    alignSelf: 'stretch',
    padding: 12,
    alignItems: 'flex-start',
    gap: 12,
  },
  thumbnail: {
    width: '100%',
    aspectRatio: 3 / 2,
    borderRadius: 12,
  },
  titleText: {
    fontWeight: 'bold',
    fontSize: 18,
    marginTop: 12,
  },
  subtitleText: {
    fontSize: 14,
    color: '#666',
  },
  logContainer: {
    width: '100%',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    marginBottom: 12,
  }
})