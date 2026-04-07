import { SignOutButton } from '../components/sign-out-button'
import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'
import { SignedIn, SignedOut, useSession, useUser } from '@clerk/clerk-expo'
import { Link } from 'expo-router'
import { StyleSheet, TouchableOpacity, Text, FlatList} from 'react-native'
// import VideoEssayListScreen from '@/src/screens/VideoEssayListScreen'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import {Image,  Button} from 'react-native'
import * as ImagePicker from 'expo-image-picker';
import { useState, useEffect } from 'react'; 
import { Log } from '@/src/types/log'; 
import { fetchUserLogs } from '@/src/api/logs'
import { updateProfileImageAPI } from '@/src/api/users'
import { deleteLog } from '@/src/api/logs'
import { useAuth } from '@clerk/clerk-expo'
import LogInfo from '@/src/screens/logInfo'
import LogListScreen from '@/src/screens/LogListScreen'
import { useAuthUpdate } from '@/src/api/authUpdate'
import { fetchProfile } from '@/src/api/users'
import { useAuthDelete } from '@/src/api/authDelete'
export default function Page({id}: {id:string}) {
//   const { user } = useUser()
  // const [profileImage, setProfileImage] = useState<String>();
  // If your user isn't appearing as signed in,
  // it's possible they have session tasks to complete.
  // Learn more: https://clerk.com/docs/guides/configure/session-tasks

//   const { session } = useSession()
  const authDelete = useAuthDelete();
//   console.log(session?.createdAt)
  // console.log(user)
  // console.log(user?.id)
  const [logs, setlogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const {getToken} = useAuth(); 
  const authUpdate = useAuthUpdate();
  const [userLogs, setUserLogs] = useState<Log[]>([]);
  const [numLogs, setNumLogs] = useState(0); 
  const [numEssays, setNumEssays] = useState(0);
    // Runs once when the screen loads
    useEffect(() => {
        async function loadLogs(){
        try {
          const token = await getToken();
          console.log("user's username", user?.username)
          const data = await fetchUserLogs(token!);
          // console.log(user?.username)
          const profile = await fetchProfile(token!);
          // console.log("PROFILE RESULTS: ", profile)
          // console.log("PROFILE. id : ", data)
          // console.log("USER LOGS: ", profile.user_logs);
          const uniqueCount = new Set(profile.user_logs.map(item => item.essay)).size;
          // console.log(`USER HAS LOGGED ${uniqueCount} VIDEOESSAYS`);
          setUserLogs(profile.user_logs);
          // console.log(`USER HAS ${profile.user_logs.length} LOGS`);
          setNumLogs(profile.user_logs.length); 
          setNumEssays(uniqueCount);
        } catch (error) {
          console.error("Failed to load logs:", error);
        } finally {
          setLoading(false);
        }
      }
  
      loadLogs();
    }, []);
  // console.log(user?.imageUrl)
  async function updateProfileImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
    });

    if (!result.canceled) {
        const uri = result.assets[0].uri;
        // console.log(result.assets)
        // console.log("URI: ", uri);
        // convert to blob
        const response = await fetch(uri);
        const blob = await response.blob();
        await user?.setProfileImage({ file: blob });
        console.log(user?.id);
        await user?.reload();
        const clerkImageUrl = user?.imageUrl
        console.log("clerk image url: ", clerkImageUrl);
        await updateProfileImageAPI(clerkImageUrl, authUpdate)
    }
}
async function handleDelete(id: string) {
  try{
    const token = await getToken();
    await deleteLog(id, token, authDelete); 
    const data = await fetchProfile(token!);
    setUserLogs(data.user_logs);

  }
  catch (error) {
    console.error("Failed to delete logs:", error);
  }
}

  return (
    <SafeAreaProvider>
      <ThemedView>
      <SafeAreaView style = {styles.container}>
      <ThemedText>Welcome!</ThemedText>
      <SignedIn>
        <ThemedText>Hello {user?.username}</ThemedText>
        <ThemedText>{user?.imageUrl}</ThemedText>
        <TouchableOpacity onPress={updateProfileImage}>
            <Image source={{ uri: user?.imageUrl }} style={{ width: 100, height: 100, borderRadius: 50 }} />
            <ThemedText>Change Photo</ThemedText>
        </TouchableOpacity>
        <ThemedText>{numLogs} Logs</ThemedText>
        <ThemedText>{numEssays} Essays</ThemedText>
        <ThemedText>Your Logs</ThemedText>
       <FlatList
      data={userLogs}
      keyExtractor={(item) => item.id.toString()}
      renderItem={({ item }) => (
        <ThemedView style={{ padding: 12, flex: 1 }}>

          <ThemedText style={{ fontWeight: "bold", marginTop: 8 }}>
            {item.owner}
          </ThemedText>
          {item.essay_details.title && (
              <ThemedText> 
              {item.essay_details.title}
              </ThemedText>
          )}
          {item.owner_id && (
            <ThemedText>
              {item.owner_id}
            </ThemedText>
          )}
          

          {item.review_text && (
            <ThemedText>{item.review_text}</ThemedText>
          )}
          <TouchableOpacity onPress={() => handleDelete(item.public_id)}>
            <Text>Delete Log</Text>
          </TouchableOpacity>
        </ThemedView>
      )}
    />
      </SignedIn>
      </SafeAreaView>   
      </ThemedView>
      
    </SafeAreaProvider>
    
  )
}

const styles = StyleSheet.create({
    container: {
      flex: 1,
      padding: 20,
      gap: 16,
    },
  })