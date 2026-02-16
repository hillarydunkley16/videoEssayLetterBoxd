import { SignOutButton } from '../components/sign-out-button'
import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'
import { SignedIn, SignedOut, useSession, useUser } from '@clerk/clerk-expo'
import { Link } from 'expo-router'
import { StyleSheet } from 'react-native'
import VideoEssayListScreen from '@/src/screens/VideoEssayListScreen'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'

export default function Page() {
  const { user } = useUser()

  // If your user isn't appearing as signed in,
  // it's possible they have session tasks to complete.
  // Learn more: https://clerk.com/docs/guides/configure/session-tasks
  const { session } = useSession()
  console.log(session?.currentTask)
  console.log(user)
  return (
    <SafeAreaProvider>
      <ThemedView>
      <SafeAreaView style = {styles.container}>
      <ThemedText>Welcome!</ThemedText>
      {/* Show the sign-in and sign-up buttons when the user is signed out */}
      {/* <SignedOut>
        <Link href="/(auth)/sign-in">
          <ThemedText>Sign in</ThemedText>
        </Link>
        <Link href="/(auth)/sign-up">
          <ThemedText>Sign up</ThemedText>
        </Link>
      </SignedOut>
      Show the sign-out button when the user is signed in */}
      <SignedIn>
        <ThemedText>Hello {user?.emailAddresses[0].emailAddress}</ThemedText>
      
        <SignOutButton />
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