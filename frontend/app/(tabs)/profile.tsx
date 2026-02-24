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
import { fetchLogs } from '@/src/api/logs'
import { useAuth } from '@clerk/clerk-expo'
import LogInfo from '@/src/screens/logInfo'

export default function Page() {
  const { user } = useUser()
  // const [profileImage, setProfileImage] = useState<String>();
  // If your user isn't appearing as signed in,
  // it's possible they have session tasks to complete.
  // Learn more: https://clerk.com/docs/guides/configure/session-tasks

  const { session } = useSession()
  console.log(session?.createdAt)
  console.log(user)
  console.log(user?.id)
  const [logs, setlogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const {getToken} = useAuth(); 
  const [userLogs, setUserLogs] = useState<Log>();
    // Runs once when the screen loads
    useEffect(() => {
        async function loadLogs(){
        try {
          const token = await getToken();
          // console.log("token: ", token);
          // console.log("load ")
          const data = await fetchLogs(token!);
          console.log(data.results)
          //can't do this atm because i have logs where the user id is undefined
          // console.log("filter results: ", data.results.filter((log: Log) => log.owner = user?.id.toString()));
          for (const log of data.results){
            // console.log("owner username: ", log.owner.id)
            // console.log("owner id: ", log.owner)
            if(log.owner != undefined && user?.id != undefined){
              if ((log.owner.toString() == user?.id) || (log.owner.toString() == user?.username)){
                console.log("MATCH")
                setUserLogs(log)
                console.log("USER LOGS: ", userLogs)
              }
              else{
                console.log("NO MATCH")
              }
            }
            else{
              console.log(`log.owner ${log.owner} is undef or user id ${user?.id}is undef`)
            }
            
          }
          setlogs(data.results);
          console.log("set logs: ", data);
          
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
        
        // convert to blob
        const response = await fetch(uri);
        const blob = await response.blob();
        
        // update via Clerk
        await user?.setProfileImage({ file: blob });
    }
}

  return (
    <SafeAreaProvider>
      <ThemedView>
      <SafeAreaView style = {styles.container}>
      <ThemedText>Welcome!</ThemedText>
      <SignedIn>
        <ThemedText>Hello {user?.username}</ThemedText>
        {/* <ThemedText>Hello {user?.id}</ThemedText> */}
       
          
        {/* <Image source={{ uri: user?.imageUrl }} style={{ width:  100, height: 100 }}/> */}
        {/* <Button title = "select profile photo" onPress={pickImageAsync}/> */}
        <TouchableOpacity onPress={updateProfileImage}>
            <Image source={{ uri: user?.imageUrl }} style={{ width: 100, height: 100, borderRadius: 50 }} />
            <ThemedText>Change Photo</ThemedText>
        </TouchableOpacity>
        <ThemedText>Your Logs</ThemedText>
        
        {/* {userLogs?.essay_details.title && ( <ThemedText>
              {userLogs.essay_details.title}
          </ThemedText>
      )}
      {userLogs?.essay_details.channel_name && (<ThemedText>
        {userLogs.essay_details.channel_name}
      </ThemedText>)}    */}
      <LogInfo id = {userLogs?.public_id}/>
     
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