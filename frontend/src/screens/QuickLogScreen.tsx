import { useState } from 'react';
import { View, Text, TouchableOpacity, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router';
import { ThemedText } from "@/components/themed-text";
import { useAuthPost} from '../api/authPost';
import { TappableRatingDots } from '@/components/ui/RatingDots';
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const ICON_SIZE = 44;

type Props = {
    id: string;
    style: object;
    onRatingChange?: (value: number) => void;
    onRatingSetChange?: (isSet: boolean) => void;
    onWatchedChange?: (watched: boolean) => void;
    onLikedChange?: (liked: boolean) => void;
    onWatchListChange?: (inWatchList: boolean) => void;
    onDone?: () => void;
    onAddReview?: () => void;
    initialRating?: number;
}
// date is automatically set to today's date
// review text will be blank
//
export default function QuickLogScreen( { id, onRatingChange, onRatingSetChange, style, initialRating, onDone, onAddReview}: Props){
    const theme = Colors[useColorScheme()];
    const authFetch = useAuthPost();
    const [rating, setRating] = useState<number>(initialRating ?? 0);
    const [rewatch, setRewatch] = useState(false);
    const [error, setError] = useState("");
    const [ratingIsSet,  setRatingIsSet] = useState(false);
    const [watchList, setWatchList] = useState(false);
    const handleWatchList = async () => {
        // similar to handle like but for watchlist status
        if (!id) return;

        setWatchList((prev) => !prev);
    }
    const handleWatched = async () => {
        // similar to handle like but for watched status
        if (!id) return;

        setRewatch((prev) => !prev);
    }
    const router = useRouter();
    function handleRatingChange(value: number) {
        setRating(value);
        onRatingChange?.(value);
        if (!ratingIsSet) {
            setRatingIsSet(true);
            onRatingSetChange?.(true);
        }
    }
    // watched, liked, add to watchlist
    // quick log with just rating and date, then option to add review text later?
    return (
        <View style = {style}>
            <View style = {styles.iconRow}>
                <TouchableOpacity onPress = {handleWatched} style={styles.iconButton}>
                    <MaterialCommunityIcons name={rewatch ? "eye" : "eye-outline"} size={ICON_SIZE} color={rewatch ? theme.accent : theme.muted} />
                    <ThemedText style={[styles.iconButtonText, { color: theme.muted, fontFamily: Fonts?.sans }]}>{rewatch ? "Watched" : "Watch"}</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity onPress = {handleWatchList} style={styles.iconButton}>
                    <MaterialCommunityIcons name={watchList ? "clock-minus" : "clock-plus-outline"} size={ICON_SIZE} color={watchList ? theme.accent : theme.muted} />
                    <ThemedText style={[styles.iconButtonText, { color: theme.muted, fontFamily: Fonts?.sans }]}>Watchlist</ThemedText>
                </TouchableOpacity>
           </View>

            <View style={styles.rateBlock}>
                <Text style={[styles.fieldLabel, { color: theme.muted, fontFamily: Fonts?.sans }]}>
                    your rating
                </Text>
                <TappableRatingDots value={rating} onChange={handleRatingChange} />
                <Text style={[styles.rateCaption, { color: theme.muted, fontFamily: Fonts?.sans }]}>
                    {rating > 0 ? `${rating} out of 5` : 'Tap a dot to rate'}
                </Text>
            </View>

            {error ? <ThemedText style={{ color: 'red' }}>{error}</ThemedText> : null}

            <View style={[styles.actions, { borderTopColor: theme.border }]}>
                <Pressable style={styles.linkButton}>
                    <Text style={[styles.linkButtonText, { color: theme.text, fontFamily: Fonts?.sansMedium }]}>Share</Text>
                </Pressable>
                <Pressable style={styles.linkButton} onPress={() => (onAddReview ? onAddReview() : router.push(`/logVideoModal?essayId=${id}&rating=${rating}`))}>
                    <Text style={[styles.linkButtonText, { color: theme.text, fontFamily: Fonts?.sansMedium }]}>Add Review</Text>
                </Pressable>
                <Pressable style={styles.linkButton} onPress={() => router.push(`/(modals)/listVideoEssay?essayId=${id}`)}>
                    <Text style={[styles.linkButtonText, { color: theme.text, fontFamily: Fonts?.sansMedium }]}>Add to List</Text>
                </Pressable>
            </View>

            <Pressable
                style={[styles.doneButton, { backgroundColor: theme.accent }]}
                onPress={() => (onDone ? onDone() : router.back())}
            >
                <Text style={[styles.doneButtonText, { color: theme.background, fontFamily: Fonts?.sansSemiBold }]}>Done</Text>
            </Pressable>
            </View>
    )
}

const styles = StyleSheet.create({
  iconRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: "center",
    paddingVertical: 8,
  },
  iconButton: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  iconButtonText: {
    fontSize: 15,
  },
  rateBlock: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 13,
    marginBottom: 10,
  },
  rateCaption: {
    fontSize: 13,
    marginTop: 10,
  },
  actions: {
    borderTopWidth: 1,
    marginTop: 24,
    paddingTop: 8,
  },
  linkButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  linkButtonText: {
    fontSize: 16,
  },
  doneButton: {
    marginTop: 16,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 16,
  },
});
