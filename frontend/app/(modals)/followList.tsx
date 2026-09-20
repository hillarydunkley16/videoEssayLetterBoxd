import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import FollowListScreen from '@/src/screens/FollowListScreen';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { fetchProfile } from '@/src/api/users';

export default function FollowList() {
    const params = useLocalSearchParams<{ userId?: string; tab?: string }>();
    const { getToken } = useAuth();
    const paramId = params.userId ? Number(params.userId) : undefined;
    const [ownId, setOwnId] = useState<number>();
    const [failed, setFailed] = useState(false);

    // A reload or deep link can drop userId; default to the signed-in user's own list.
    useEffect(() => {
        if (paramId !== undefined) return;
        (async () => {
            try {
                const token = await getToken();
                if (!token) throw new Error('No token');
                setOwnId((await fetchProfile(token)).user.id);
            } catch (err) {
                console.error('Failed to resolve own user id:', err);
                setFailed(true);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [paramId]);

    const userId = paramId ?? ownId;
    const tab = params.tab === 'following' ? 'following' : 'followers';

    if (paramId !== undefined && Number.isNaN(paramId) || failed) return (
        <ThemedView style={{ flex: 1, padding: 20 }}>
            <ThemedText>Couldn&apos;t load this list.</ThemedText>
        </ThemedView>
    );
    if (userId === undefined) return (
        <ThemedView style={{ flex: 1, padding: 20 }}>
            <ActivityIndicator />
        </ThemedView>
    );
    return <FollowListScreen userId={userId} tab={tab} />;
}
