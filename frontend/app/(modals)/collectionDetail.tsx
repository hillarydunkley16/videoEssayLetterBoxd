import { useLocalSearchParams } from 'expo-router'
import { Text } from 'react-native'
import { ThemedView } from '@/components/themed-view'
import CollectionInfo from '@/src/screens/collectionInfo'
export default function CollectionDetail(){
    const params = useLocalSearchParams<{ publicId: string }>();
    if (!params.publicId) return(
        <ThemedView>
            <Text>Invalid collection ID</Text>
        </ThemedView>
    )
    return(
        <ThemedView style={{ flex: 1 }}>
            <CollectionInfo
            public_id = {params.publicId}
            />
        </ThemedView>
    )
}