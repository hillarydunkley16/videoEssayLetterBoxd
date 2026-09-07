import { router, useLocalSearchParams } from 'expo-router'
import { StyleSheet, Text, TouchableOpacity } from 'react-native'
import GetVideoEssayScreen from '@/src/screens/GetVideoEssayScreen'
import VideoInfoLogs from '@/src/screens/VideoInfoLogs'
import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import { useNavigation } from 'expo-router'
import { ReviewsTopNav } from '@/components/ui/reviewsTopNav'
import { fetchUsersCollections } from '@/src/api/collection'
import { Collection } from '@/src/types/collection'
import { useAuth } from '@clerk/clerk-expo'
import UserListsScreen from '@/src/screens/userLists';
export default function listVideoEssay(){
    const params = useLocalSearchParams<{essayId: string}>();
    const [collections, setCollections] = useState<Collection[]>([]);
    const { getToken } = useAuth(); 
    //  useEffect(() => {
    //         async function fetchCollections(){
    //             try{
    //                 const token = await getToken(); 
    //                 if (!token) return 
    //                 const data = await fetchUsersCollections(token);
    //                 setCollections(data); 
    //             }
    //             catch (err) {
    //                 console.error(err)
    //             }
    //         }
    //         fetchCollections();
    //     }, [])
    return(
        <ThemedView> 
            <UserListsScreen essayId = {params.essayId}/>
        </ThemedView>
    )
}