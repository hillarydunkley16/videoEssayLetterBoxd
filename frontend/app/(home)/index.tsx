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

  // If your user isn't appearing as signed in,
  // it's possible they have session tasks to complete.
  // Learn more: https://clerk.com/docs/guides/configure/session-tasks
  const { session } = useSession()
  console.log(session?.currentTask)
  // console.log(user)
  return (
    <SafeAreaProvider>
      <ThemedView>
      <SafeAreaView style = {styles.container}>
      <ThemedText style = {styles.text}>Welcome!</ThemedText>
      
      <SignedIn>
        <ThemedText>Hello {user?.username}</ThemedText>
      </SignedIn>
      <VideoEssayListScreen/>
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
  text : {
    fontSize: 35
  }
})