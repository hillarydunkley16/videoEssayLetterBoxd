import { View, Text, FlatList, Image, StyleSheet, Linking, TouchableOpacity, Platform } from "react-native";
import { fetchVideoEssays, getAVideoEssay } from "../api/videos";
import { VideoEssay } from "../types/videoEssay";
import { Log } from "../types/log";
import {VideoEssayData} from "../types/videoEssay";
import {useEffect, useState} from "react";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@clerk/clerk-expo";
import { useLocalSearchParams } from "expo-router";
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
    const {getToken} = useAuth(); 
    useEffect(() => {
        async function loadVideo() {
          try {
            const token = await getToken();
            console.log("load videos function")
            const data = await getAVideoEssay(essayId, token!);
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
       
            <ThemedView style={style.container}>
          {video.thumbnail && (
            
           <TouchableOpacity onPress = {() => Linking.openURL(video.youtube_url)}> 
            <Image
              source={{ uri: video.thumbnail }}
              style={style.thumbnail}
              resizeMode="cover"
            />
           </TouchableOpacity>
          )}

          <ThemedText style={{ fontWeight: "bold", marginTop: 8 }}>
            {video.title}
          </ThemedText>

          {video.channel_name && (
            <ThemedText>{video.channel_name}</ThemedText>
          )}
          </ThemedView>

         
        
    )
}

const style = StyleSheet.create({
    container: {
        width: '100%',
        maxWidth: 350,
        alignItems: 'flex-start',
        gap: 12,
        ...Platform.select({
            web: {
                width: 350,  // explicit width on web
            }
        })
    },
    thumbnail: {
        width: '100%',
        aspectRatio: 3 / 2,
        borderRadius: 12,
        ...Platform.select({
            web: {
                width: 350,  // explicit width on web
                height: 233,
            }
        })
    }
})