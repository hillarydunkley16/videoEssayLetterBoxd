import { useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';
import FollowListScreen from '@/src/screens/FollowListScreen';
import { ThemedView } from '@/components/themed-view';

export default function FollowList() {
    const params = useLocalSearchParams<{ userId?: string; tab?: string }>();
    const userId = Number(params.userId);
    if (!params.userId || Number.isNaN(userId)) return (
        <ThemedView>
            <Text>Missing user id</Text>
        </ThemedView>
    );
    return <FollowListScreen userId={userId} tab={params.tab === 'following' ? 'following' : 'followers'} />;
}
