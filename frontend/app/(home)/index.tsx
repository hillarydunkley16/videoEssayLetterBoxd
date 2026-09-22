import { SignOutButton } from '../components/sign-out-button'
import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'
import { SignedIn, SignedOut, useSession, useUser } from '@clerk/clerk-expo'
import { Link } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View, useColorScheme, useWindowDimensions } from 'react-native'
import { Colors, Fonts } from '@/constants/theme'
import RecentLogsScreen from '@/src/screens/RecentLogsScreen'
import { ProfileCard } from '@/components/ui/ProfileCard'
import { PeopleToFollowCard, PopularThisWeekCard } from '@/components/ui/SidebarCards'
import FollowingFeedScreen from '@/src/screens/FollowingFeedScreen'
import SignedOutHomeScreen from '@/src/screens/SignedOutHomeScreen'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import '../../global.css';
import SwitchComponent from '@/src/screens/SearchScreen';
import UsernameGateBanner from '@/src/components/UsernameGateBanner';
export default function Page() {
  const [feed, setFeed] = useState<'everyone' | 'following'>('everyone')
  const theme = Colors[(useColorScheme() ?? 'light') as 'light' | 'dark']
  const { user } = useUser()
  const { width } = useWindowDimensions()
  const showSidebar = width >= 900
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
        
        <SignedOut>
          <SignedOutHomeScreen />
        </SignedOut>
        <SignedIn>
          {/* <ThemedText>Hello {user?.username}</ThemedText> */}
           <UsernameGateBanner />
           <View style={[styles.feedTabs, { borderColor: theme.border }]}>
             {(['everyone', 'following'] as const).map((f) => (
               <TouchableOpacity key={f} testID={`home-tab-${f}`} style={styles.feedTab} onPress={() => setFeed(f)}>
                 <Text
                   style={{
                     color: feed === f ? theme.text : theme.muted,
                     fontFamily: feed === f ? Fonts?.displayMedium : Fonts?.sans,
                   }}
                 >
                   {f === 'everyone' ? 'Everyone' : 'Following'}
                 </Text>
               </TouchableOpacity>
             ))}
           </View>
           <View style={styles.body}>
             <View style={styles.feed}>
               {feed === 'everyone' ? <RecentLogsScreen/> : <FollowingFeedScreen/>}
             </View>
             {showSidebar && (
               <View style={styles.sidebar}>
                 <ProfileCard />
                 <PopularThisWeekCard />
                 <PeopleToFollowCard />
               </View>
             )}
           </View>
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
  feedTabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  feedTab: {
    marginRight: 22,
    paddingVertical: 12,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
  },
  feed: {
    flex: 1,
  },
  sidebar: {
    width: 300,
    marginRight: 20,
    marginTop: 20,
  },
  text: {
    fontSize: 35,
    paddingHorizontal: 20,
  }
})