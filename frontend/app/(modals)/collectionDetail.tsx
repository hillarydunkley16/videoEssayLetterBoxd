import { router, useLocalSearchParams } from 'expo-router'
import { StyleSheet, Text, TouchableOpacity } from 'react-native'
import GetVideoEssayScreen from '@/src/screens/GetVideoEssayScreen'
import VideoInfoLogs from '@/src/screens/VideoInfoLogs'
import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useEffect } from 'react'
import { useNavigation } from 'expo-router'
import { ReviewsTopNav } from '@/components/ui/reviewsTopNav'
import CollectionInfo from '@/src/screens/collectionInfo'
export default function collectionDetail(){
    const params = useLocalSearchParams<string>(); 
    console.log(params)
    const navigation = useNavigation();
    if (!params) return(
        <ThemedView>
            <ThemedText>Invalid collection ID</ThemedText>
        </ThemedView>
    )
    console.log(`TYPE OF PUBLIC ID PARAMS ${typeof params}`)
    return(
        <ThemedView>
            <CollectionInfo 
            public_id = {params}
            />
        </ThemedView>
    )
}