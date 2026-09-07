import { View, Image, StyleSheet, Pressable, Linking, ActivityIndicator, ScrollView, Platform, TextInput, Button, Modal, KeyboardAvoidingView, Keyboard } from "react-native"
import { fetchALog } from "../api/logs";
import { VideoEssay } from "../types/videoEssay";
import { Log } from "../types/log";
import {useEffect, useState} from "react";
import { ThemedText } from "@/components/themed-text";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useUser } from "@clerk/clerk-expo";
import { likeLog } from "../api/logs";
import { TouchableOpacity } from "react-native";
import { useAuthPost } from "../api/authPost";
import { commentOnLog } from "../api/logs";
import {router} from 'expo-router';
import dayjs from 'dayjs';
import BottomSheet, { BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { Like } from "../types/like";
// import { getAccessToken } from "../helpers/jwt";
import { useAuth } from "@clerk/clerk-expo";
import { MaterialCommunityIcons } from "@expo/vector-icons";
type Props = {
  id: string; 
  onTitleLoaded? : (title: string) => void;
}
export default function LogInfo( {id, onTitleLoaded}: Props){
    const authFetch = useAuthPost();
    const [log, setLog] = useState<Log>();
    const [loading, setLoading] = useState(true);
    const [video, setVideo] = useState<VideoEssay>(); 
    const { user } = useUser(); // Clerk hook
    const { getToken } = useAuth();
    const [liked, setLiked] = useState(false);
    const [likesCount, setLikesCount] = useState(0);
    const [comment, setComment] = useState(''); 
    const [modalVisible, setModalVisible] = useState(false);
    const [firstCommentVisible, setFirstCommentVisible] = useState(false);
    const [commentLoading, setCommentLoading] = useState(false);
    const [date, setDate] = useState(""); 
    const [error, setError] = useState(""); 
    const backgroundColor = useThemeColor({}, 'background');
    const cardBackground = useThemeColor({ light: '#f8fafc', dark: '#111827' }, 'background');
    const sectionBackground = useThemeColor({ light: '#f1f5f9', dark: '#111827' }, 'background');
    const secondaryTextColor = useThemeColor({ light: '#475569', dark: '#94a3b8' }, 'text');
    const borderColor = useThemeColor({ light: '#e2e8f0', dark: '#334155' }, 'text');

    useEffect(() => {

        async function loadLog() {
        try {
            const token = await getToken();
            const data = await fetchALog(id, token!);
            setLog(data);
            setVideo(data.essay_details);
            onTitleLoaded?.(data.essay_details.title); 
            setLikesCount(data.likes.length);
            setLiked(
                data.likes.some(
                    (item) => item.user.id === Number(user?.id)
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
            if (!log) {
                setError("Unable to submit comment");
                return;
            }
            setCommentLoading(true);
            console.log(id); 
            console.log(log.public_id)
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
    if (loading) return <ActivityIndicator size="large" color="#0000ff" />;
    if (!log) return <ThemedText>Log not found</ThemedText>;
    
    return (
        <SafeAreaProvider>
      <SafeAreaView style={[styles.safe, { backgroundColor }]}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.page}>
            <View style={styles.mainColumn}>
              <View style={[styles.card, { backgroundColor: cardBackground, borderColor }]}>
                {/* <Pressable onPress={() => Linking.openURL(log?.essay_details.youtube_url || '')}>
                  <Image source={{ uri: log?.essay_details.thumbnail }} style={styles.thumbnail} />
                </Pressable> */}

                <View style={styles.userInfoRow}>
                  {/* <ThemedText>{log?.owner_id}</ThemedText> */}
                 
                  <TouchableOpacity onPress={() => {
                    console.log('Navigating to otherProfile with id', log?.owner_id);
                    router.replace(`/otherProfile/${log?.owner_id}`);
                  }}> 
                  <Image
                    source={{ uri: log?.owner_image || 'https://img.clerk.com/eyJ0eXBlIjoiZGVmYXVsdCIsImlpZCI6Imluc18zOHFPakFDRkhNV1FPNXVBSTdBV20yQnY5YkgiLCJyaWQiOiJ1c2VyXzM5R2w1OFp2OGhZWHhjbTYzYjRUYnpuaElWbiJ9?width=96' }}
                    style={styles.profilePicture}
                  />
                  </TouchableOpacity>
                 
                  <View style={styles.textColumn}>
                    <ThemedText style={[styles.rating, { color: secondaryTextColor }]}>{log?.rating}/10</ThemedText>
                    <ThemedText style={[styles.byline, { color: secondaryTextColor }]}>
                      {log?.owner_id === parseInt(user?.id || '0') ? 'Review by Me' : log?.owner}
                    </ThemedText>
                  </View>
                  <Image source = {{uri: log?.essay_details.thumbnail}} style={styles.thumbnail}/>
                  
                </View>

                <ThemedText style={styles.reviewText}>{log?.review_text}</ThemedText>
                <View style = {{flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12}}> 
                <TouchableOpacity onPress={handleLike} style={[styles.likeButton]}>
                    <MaterialCommunityIcons name = {liked ? "heart" : "heart-outline"} size={20} color={liked ? "red" : "black"} />
                  <ThemedText style={styles.likeButtonText}>{liked ? 'Liked' : 'Like'} </ThemedText>
                  
                  {/* <ThemedText>{likesCount}</ThemedText> */}
                </TouchableOpacity>
                {likesCount > 1 ? (
                    <ThemedText style={styles.likeButtonText} >{likesCount} likes</ThemedText>
                  ): (
                    <ThemedText style={styles.likeButtonText}>{likesCount} like</ThemedText>
                  )} 
                  </View>
               <ThemedText style={[styles.date, { color: secondaryTextColor }]}>Watched on {dayjs(log?.date).format('D MMMM YYYY')}</ThemedText>
               {/* <TouchableOpacity onPress = {() => router.replace(`/modal?essayId=${log?.essay_details.public_id}`)} style = {{marginTop: 12}}>
                <ThemedText>Video</ThemedText>
               </TouchableOpacity> */}
                {log.comments.length > 0 ? ( <TouchableOpacity style={{ marginTop: 12 }} onPress = {() => setModalVisible(true)}>
                <ThemedText>Comments</ThemedText>
               </TouchableOpacity>): (<TouchableOpacity style={{ marginTop: 12 }} onPress = {() => setFirstCommentVisible(true)}>
                <ThemedText>Reply</ThemedText>
               </TouchableOpacity>)}
              
              </View>
              {/* if no comments, then label will be "reply" and it'll have a big popup modal to comment that's basically a big text box */}
              {/* {log.comments.length > 0 ? (
                <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
                
                >
                   <View style={[styles.commentsSection, { backgroundColor: sectionBackground, borderColor }]}>
                <ThemedText style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 12 }}>Comments</ThemedText>
                </View>
                </Modal>
               ) : (
                <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
                
                >
                  </Modal>
              )} */}
                <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
                >
                <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, justifyContent: 'flex-end' }}>
                  <View style={[styles.commentsSection, { backgroundColor: sectionBackground, borderColor }]}>
                    <View style={{flexDirection: "row", justifyContent: "space-between"}}>
                      <TouchableOpacity onPress = {() => setModalVisible(false)}>
                        <ThemedText style={{fontSize: 16, fontWeight: "bold", marginBottom: 12}}>Cancel</ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity onPress = {handleSubmit} disabled={commentLoading} style={{marginBottom: 12}}>
                        <ThemedText style={{fontSize: 16, fontWeight: "bold", marginBottom: 12, color: commentLoading ? "grey" : "blue"}}>Submit</ThemedText>
                      </TouchableOpacity>
                    </View>
                <ScrollView>
                  {log.comments.length === 0 ? (
                    <ThemedText>No comments yet. Be the first to comment!</ThemedText>
                  ) : (
                    log.comments.map((comment) => (
                      <View key={comment.id} style={{ marginBottom: 16 }}>
                        <ThemedText style={{ fontWeight: 'bold', marginBottom: 4 }}>{comment.user}</ThemedText>
                        <ThemedText>{comment.text}</ThemedText>
                      </View>
                    ))
                  )}
                
                </ScrollView>
                  <TextInput 
                    value = {comment}
                    onChangeText={setComment}
                    multiline
                    style={{
                        borderWidth: 1,
                        borderColor: "grey",
                        padding: 8,
                        marginBottom: 12,
                        height: "30%",
                      }}
                />
              </View>
                </KeyboardAvoidingView>
                
              </Modal>
              {/* fix styling for modal so the modal takes up ~80% of the space. the text box should float up upon tapping upon it to make space for the keyboard */}
              <Modal
               animationType="slide"
                transparent={true}
                visible={firstCommentVisible}
                onRequestClose={() => setFirstCommentVisible(false)}
              >
                <View style={[styles.commentsSection, { backgroundColor: sectionBackground, borderColor }]} >
                  <View style={{flexDirection: "row", justifyContent: "space-between"}}>
                  <TouchableOpacity onPress = {() => setFirstCommentVisible(false)}>
                    <ThemedText style={{fontSize: 16, fontWeight: "bold", marginBottom: 12}}>Cancel</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity onPress = {handleSubmit} disabled={commentLoading} style={{marginBottom: 12}}>
                    <ThemedText style={{fontSize: 16, fontWeight: "bold", marginBottom: 12, color: commentLoading ? "grey" : "blue"}}>Submit</ThemedText>
                  </TouchableOpacity>
                  </View>
                  <TextInput 
                    value = {comment}
                    onChangeText={setComment}
                    multiline
                    style={{
                        borderWidth: 1,
                        borderColor: "grey",
                        padding: 8,
                        marginBottom: 12,
                        height: "80%",
                      }}
                />
                </View>
              </Modal>
              
            </View>

            <View style={styles.sidebar}>
              <View style={[styles.sidebarCard, { backgroundColor: sectionBackground, borderColor }]}>
                <ThemedText>Video details</ThemedText>
                <ThemedText>{log?.essay_details.title}</ThemedText>
                <ThemedText>By {log?.essay_details.channel_name}</ThemedText>
                <ThemedText>{log?.essay_details.views} views</ThemedText>
                 
                <ThemedText>Add to watchlist</ThemedText>
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
    // padding: 10,
    alignItems: 'center',
  },
  page: {
    width: '100%',
    maxWidth: 1200,
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    // gap: 16,
  },
  mainColumn: {
    flex: 1,
    minWidth: 0,
  },
  sidebar: {
    flex: 1,
    minWidth: 280,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    // gap: 16,
    borderWidth: 1,
  },
  sidebarCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
  },
  thumbnail: {
    // width: 120,
    // height: 220,
    borderRadius: 14,
    // marginBottom: 16,
    width: 150,
    height: 120,
    resizeMode: 'contain', 
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
    height: "80%",
    marginTop: 40,
    // backgroundColor: '#0f172a',
    // borderRadius: 16,
    padding: 20,
    // height: "100%",
  },
  // modal: {
  //   flex: 1, 
  //   padding: 50,
  //   height: "100%", 
  //   borderRadius: 16,
  //   // backgroundColor: "pink",
  //   // backgroundColor: 'rgba(0, 0, 0, 0.5)',
  //   // height: "100%",
  // }
})


