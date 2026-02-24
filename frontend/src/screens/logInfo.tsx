import { View, Text, FlatList, Image, StyleSheet } from "react-native";
import { fetchVideoEssays, getAVideoEssay } from "../api/videos";
import { fetchALog } from "../api/logs";
import { VideoEssay } from "../types/videoEssay";
import { Log } from "../types/log";
import {VideoEssayData} from "../types/videoEssay";
import {useEffect, useState} from "react";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { useUser } from "@clerk/clerk-expo";
// import { getAccessToken } from "../helpers/jwt";
import { useAuth } from "@clerk/clerk-expo";
export default function LogInfo( {id}: {id:string}){
    const [log, setLog] = useState<Log>();
    const [loading, setLoading] = useState(true);
    const [video, setVideo] = useState<VideoEssay>(); 
    const { user } = useUser(); // Clerk hook
    const { getToken } = useAuth();
    
    
    useEffect(() => {

        async function loadLog() {
            try{
                const token = await getToken();
                // console.log("token: ", token);
                // console.log("id: ", id )
                // console.log("user: ", user?.id);
                
                // const access = await getAccessToken(); 
                // console.log("ACCESS token: ", access);
                const data = await fetchALog(id, token!);
                //fetch user 
                console.log(data.owner.username)
                setLog(data);
                // console.log("log: ", data);
                // console.log("essay: ", data.essay_details);
                // console.log("owner: ", data.owner); 
                setVideo(data.essay_details);
                
            }catch(e){
                console.log("Error: ", e);
            }
            finally{
                setLoading(false);
            }
        }
        loadLog()
    }, [id]);
    return (
        <SafeAreaProvider>
            <SafeAreaView>
                <ThemedView style = {style.container}>
                    <a href = {log?.essay_details.youtube_url}> 
                    <Image source={{ uri: log?.essay_details.thumbnail }}
            style={style.thumbnail}/>
                    </a>
                    
                    <ThemedView style = {style.info}> 
                    <ThemedView style = {style.byline}>
                    <Image source={{ uri: user?.imageUrl }} style={{ width: 50, height: 50, borderRadius: 50 }}/>
                        {log?.owner == user?.id ? <ThemedText>Review by Me</ThemedText> : <ThemedText>{log?.owner.username}</ThemedText>}
                        {/* {log?.owner.username != null ? <ThemedText>Review by {log?.owner.username}</ThemedText> :  <ThemedText>Review by {log?.owner.toString()}</ThemedText> } */}
                       
                    </ThemedView>
                    <ThemedText>{log?.essay_details.title}</ThemedText>
                    <ThemedText>{log?.date}</ThemedText>
                    <ThemedText>{log?.rating}/10</ThemedText>
                    <ThemedText>{log?.review_text}</ThemedText>
                    </ThemedView>
                    
                </ThemedView>
            </SafeAreaView>
        </SafeAreaProvider>
    )   
}

const style = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    thumbnail: {
       width: 300, 
       height: 160, 
       borderRadius: 6
    //    alignItems: 'center',
    },
    info: {
        flex: 1
    },
    byline: {
        flexDirection: 'row', 
        alignItems: 'center', 
        gap: 20
    },
    profilePicture: {
        width: 50,
        height: 50, 
        borderRadius: 50
    }
  })