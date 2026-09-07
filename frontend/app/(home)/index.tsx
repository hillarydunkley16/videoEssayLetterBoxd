import { SignOutButton } from '../components/sign-out-button'
import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'
import { SignedIn, SignedOut, useSession, useUser } from '@clerk/clerk-expo'
import { Link } from 'expo-router'
import { StyleSheet } from 'react-native'
import VideoEssayListScreen from '@/src/screens/VideoEssayListScreen'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import '../../global.css';
import SwitchComponent from '@/src/screens/SearchScreen';
export default function Page() {
  const { user } = useUser()
  console.log("User is undefined: ", user == undefined); 
  // If your user isn't appearing as signed in,
  // it's possible they have session tasks to complete.
  // Learn more: https://clerk.com/docs/guides/configure/session-tasks
  const { session } = useSession()
  console.log("SESSION  CURRENT TASK: " , session?.currentTask)
  // console.log(user)
  return (
  <SafeAreaProvider>
    <ThemedView style={styles.container}>
      <SafeAreaView style={{ flex: 1, width: '100%' }}>
        
        {/* <ThemedText style={styles.text}>Welcome!</ThemedText> */}
        {/* this should be a slick slideshow evetually */}
        <SignedOut>
          <ThemedText>USER IS UNDEFINED/ NOT SIGNED IN</ThemedText>
        </SignedOut>
        <SignedIn>
          {/* <ThemedText>Hello {user?.username}</ThemedText> */}
           <VideoEssayListScreen/>
        </SignedIn>
       
      </SafeAreaView>
    </ThemedView>
  </SafeAreaProvider>
)
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  text: {
    fontSize: 35,
    paddingHorizontal: 20,
  }
})