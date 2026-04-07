import { View, Text, FlatList, Image, StyleSheet, TextInput, Button, Pressable, Linking, ScrollView, Platform } from "react-native"
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
import { likeLog } from "../api/logs";
import { TouchableOpacity } from "react-native";
import { useAuthPost } from "../api/authPost";
import { commentOnLog } from "../api/logs";
import { Like } from "../types/like";
// import { getAccessToken } from "../helpers/jwt";
import { useAuth } from "@clerk/clerk-expo";
import { MaterialCommunityIcons } from "expo-vector-icons";
export default function LogInfo( {id}: {id:string}){
    const authFetch = useAuthPost();
    const [log, setLog] = useState<Log>();
    const [loading, setLoading] = useState(true);
    const [video, setVideo] = useState<VideoEssay>(); 
    const { user } = useUser(); // Clerk hook
    const { getToken } = useAuth();
    const [liked, setLiked] = useState(false);
    const [likesCount, setLikesCount] = useState(0);
    const [comment, setComment] = useState(''); 
    const [commentLoading, setCommentLoading] = useState(false);
    const [date, setDate] = useState(""); 
    const [error, setError] = useState(""); 
    useEffect(() => {

        async function loadLog() {
        try {
            const token = await getToken();
            const data = await fetchALog(id, token!);
            setLog(data);
            setVideo(data.essay_details);
            setLikesCount(data.likes.length);
            setLiked(
                data.likes.some(
                    (item) => item.user_id === user?.id || item.user === user?.id
                )
            );
        } catch (e) {
            console.log("Error: ", e);
        } finally {
            setLoading(false);
        }
    }
        loadLog()
    }, [id]);
   const handleLike = async () => {
        if (!log) return;
        const result = await likeLog(log.public_id, authFetch);
        setLikesCount(result.data.likes_count);
        setLiked(result.data.liked ?? ((prev) => !prev));
    }
    async function handleSubmit() {
        setError("")
        if (!comment){
            setError("Comment is empty"); 
            return error;
        }
        try{
            setCommentLoading(true);
            console.log(id); 
            console.log(log?.public_id)
            const result = await commentOnLog(log, authFetch, {text: comment });
            // setComment(result)
            const token = await getToken();
            const data = await fetchALog(id, token!);
            setLog(data); 
            console.log("log comments: ", log?.comments); 
            console.log("comment: " , comment)
            setComment("")
            
            
        }catch(err){
            setError("Failed to create comment"); 
            console.error(err)
        }finally {
            setCommentLoading(false); 
        }
    }
    console.log(log)
    if (loading) return <ThemedText>Loading...</ThemedText>;

    if (!log) return <ThemedText>Log not found</ThemedText>;
    
    return (
        <SafeAreaProvider>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.page}>
            <View style={styles.mainColumn}>
              <View style={styles.card}>
                <Pressable onPress={() => Linking.openURL(log?.essay_details.youtube_url || '')}>
                  <Image source={{ uri: log?.essay_details.thumbnail }} style={styles.thumbnail} />
                </Pressable>

                <View style={styles.userInfoRow}>
                  <Image
                    source={{ uri: log?.owner_image || 'https://img.clerk.com/...' }}
                    style={styles.profilePicture}
                  />
                  <View style={styles.textColumn}>
                    <Text style={styles.rating}>{log?.rating}/10</Text>
                    <Text style={styles.byline}>
                      {log?.owner_id === parseInt(user?.id || '0') ? 'Review by Me' : log?.owner}
                    </Text>
                  </View>
                  <Text style={styles.date}>{log?.date}</Text>
                </View>

                <Text style={styles.reviewText}>{log?.review_text}</Text>

                <TouchableOpacity onPress={handleLike} style={styles.likeButton}>
                    <MaterialCommunityIcons name = {liked ? "heart" : "heart-outline"} size={20} color={liked ? "red" : "white"} />
                  <Text style={styles.likeButtonText}>{liked ? 'Liked' : 'Like'} ({likesCount})</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.commentsSection}>
                {/* comments */}
              </View>
            </View>

            <View style={styles.sidebar}>
              <View style={styles.sidebarCard}>
                <Text>Movie details</Text>
                {/* add metadata, buttons, watch/list actions here */}
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
    
)   
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  scroll: {
    padding: 20,
    alignItems: 'center',
  },
  page: {
    width: '100%',
    maxWidth: 1200,
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    gap: 24,
  },
  mainColumn: {
    flex: 2,
    minWidth: 0,
  },
  sidebar: {
    flex: 1,
    minWidth: 280,
  },
  card: {
    // backgroundColor: '#11182d',
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  sidebarCard: {
    // backgroundColor: '#11182d',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  thumbnail: {
    width: '100%',
    height: 220,
    borderRadius: 14,
    marginBottom: 16,
  },
  userInfoRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 16,
  },
  profilePicture: {
    width: 54,
    height: 54,
    borderRadius: 999,
  },
  textColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  rating: {
    // color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  byline: {
    // color: '#cbd5e1',
    marginTop: 4,
  },
  date: {
    // color: '#94a3b8',
  },
  reviewText: {
    // color: '#e2e8f0',
    lineHeight: 24,
  },
  likeButton: {
    // backgroundColor: '#1f2937',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  likeButtonText: {
    // color: '#fff',
    fontWeight: '600',
  },
  commentsSection: {
    marginTop: 24,
    // backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 20,
  },
})


