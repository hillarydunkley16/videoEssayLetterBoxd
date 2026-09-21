import { router, useLocalSearchParams} from 'expo-router';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import CreateLogScreen from '@/src/screens/createLogScreen';
import GetVideoEssayScreen from '@/src/screens/GetVideoEssayScreen';
import { useRef, useState} from 'react';
import { ThemedView } from '@/components/themed-view'
import { createLog } from '@/src/api/logs';
import { useAuthPost } from '@/src/api/authPost';
import { Colors, Fonts } from '@/constants/theme';

export default function LogVideoModal() {
  const authFetch = useAuthPost();  // ← use this instead of imported authFetch
    const [loading, setLoading] = useState(false);
    const submittingRef = useRef(false);
    const params = useLocalSearchParams<{essayId?: string | string[]; rating?: string}>();
    // A rating already given in the quick-log sheet arrives as a param.
    const [ratingValue, setRatingValue] = useState(Number(params.rating) || 0);
    const [rewatch, setRewatch] = useState(false);
    const [reviewText, setReviewText] = useState("");
    const [date, setDate] = useState(new Date());
    const [error, setError] = useState("");
    const theme = Colors[useColorScheme() ?? 'light'];
    const essayId =
      typeof params.essayId === "string" ?
      params.essayId
      : Array.isArray(params.essayId)
      ? params.essayId[0]
      : undefined;

     if (typeof essayId !== "string") {
        return (
          <View>
            <Text>Invalid video id</Text>
          </View>
        );
      }
    // router.back() silently no-ops when this modal has no back-history (e.g.
    // opened via a direct/refreshed URL on web), so callers must fall back to
    // a known route instead of assuming navigation always happens.
    const handleClose = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/');
        }
    };
    const handleSubmit = async () => {
        // Guard against double-taps creating duplicate logs.
        if (submittingRef.current) return;
        submittingRef.current = true;
        setLoading(true);
        setError("");
        try{
            const payload = {
                essay: essayId,
                date: date.toISOString().split('T')[0],
                rating: ratingValue,
                review_text: reviewText,
                rewatch: rewatch
            }

            await createLog(authFetch, payload);
            console.log("Log created successfully");
            setLoading(false);
            router.replace('/');
        } catch (err) {
            console.error("Error creating log:", err);
            setError("Couldn't save this log — try again.");
            submittingRef.current = false;
            setLoading(false);
        }
    }
    return(
        <ThemedView style={[styles.page, { backgroundColor: theme.surface }]}>
        <ThemedView style={[styles.largeContainer, { borderColor: theme.border, backgroundColor: theme.background }]}>
          <View style={[styles.header, { borderColor: theme.border }]}>
            <TouchableOpacity onPress={handleClose} style={styles.headerSide} accessibilityLabel="Close">
              <Text style={[styles.closeIcon, { color: theme.muted }]}>{"✕"}</Text>
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: theme.text, fontFamily: Fonts?.displayMedium }]}>
              Log this watch
            </Text>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={loading}
              style={[styles.headerSide, styles.headerSideRight]}
            >
              <Text style={[styles.saveText, { color: theme.accent, opacity: loading ? 0.5 : 1 }]}>
                {loading ? "Saving..." : "Save Log"}
              </Text>
            </TouchableOpacity>
          </View>

          {error ? (
            <Text style={[styles.errorText, { color: theme.accent }]}>{error}</Text>
          ) : null}

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            <GetVideoEssayScreen id={essayId} compact />
            <CreateLogScreen
              id={essayId}
              style={styles.form}
              initialRating={ratingValue}
              reviewText={reviewText}
              date={date}
              rewatch={rewatch}
              onRatingChange={setRatingValue}
              onReviewTextChange={setReviewText}
              onDateChange={setDate}
              onWatchedChange={setRewatch}
            />
          </ScrollView>
        </ThemedView>
        </ThemedView>
    )
}

const styles = StyleSheet.create({
    // On web the modal floats as a capped-width card over the page, like the
    // mockup; on native it's already presented full-screen by the router, so
    // it just fills the available space.
    page: {
        flex: 1,
        ...Platform.select({
            web: {
                alignItems: 'center',
            },
        }),
    },
    largeContainer: {
        flex: 1,
        width: '100%',
        ...Platform.select({
            web: {
                maxWidth: 480,
                borderWidth: 1,
                borderRadius: 10,
                marginVertical: 32,
                overflow: 'hidden',
            },
        }),
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 20,
        paddingBottom: 14,
        borderBottomWidth: 1,
    },
    headerSide: {
        minWidth: 64,
    },
    headerSideRight: {
        alignItems: 'flex-end',
    },
    closeIcon: {
        fontSize: 20,
    },
    headerTitle: {
        fontSize: 17,
    },
    saveText: {
        fontWeight: '700',
        fontSize: 15,
    },
    errorText: {
        textAlign: 'center',
        paddingTop: 10,
        fontSize: 13,
    },
    body: {
        flex: 1,
    },
    bodyContent: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 24,
    },
    form: {
        width: '100%',
        marginTop: 22,
    },
});
