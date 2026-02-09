import { SignOutButton } from '../components/sign-out-button'
import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'
import { SignedIn, SignedOut, useSession, useUser } from '@clerk/clerk-expo'
import { Link } from 'expo-router'
import { StyleSheet } from 'react-native'
import VideoEssayListScreen from '@/src/screens/VideoEssayListScreen'
import SwitchComponent from '@/src/screens/SearchScreen';

export default function Page(){
    return(
        <ThemedView>
            <SwitchComponent/>
        </ThemedView>
    )
}