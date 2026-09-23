import { router, useLocalSearchParams} from 'expo-router';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import CreateLogScreen from '@/src/screens/createLogScreen';
import GetVideoEssayScreen from '@/src/screens/GetVideoEssayScreen';
import { useEffect, useRef, useState} from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { ThemedView } from '@/components/themed-view'
import { createLog, fetchALog, updateLog } from '@/src/api/logs';
import { useAuthPost } from '@/src/api/authPost';
import { useAuthUpdate } from '@/src/api/authUpdate';
import { Colors, Fonts } from '@/constants/theme';
import { showToast } from '@/src/helpers/toast';

export default function LogVideoModal() {
  const authFetch = useAuthPost();  // ← use this instead of imported authFetch
    const authUpdate = useAuthUpdate();
    const { getToken } = useAuth();
    const [loading, setLoading] = useState(false);
    const submittingRef = useRef(false);
    const params = useLocalSearchParams<{essayId?: string | string[]; rating?: string; logId?: string}>();
    // With a logId the modal edits that log (pre-filled) instead of creating one.
    const logId = typeof params.logId === "string" ? params.logId : undefined;
    const [loadedEssayId, setLoadedEssayId] = useState<string>();
    const [loadingLog, setLoadingLog] = useState(!!logId);
    const [loadError, setLoadError] = useState(false);
    // A rating already given in the quick-log sheet arrives as a param.
    const [ratingValue, setRatingValue] = useState(Number(params.rating) || 0);
    const [rewatch, setRewatch] = useState(false);
    const [reviewText, setReviewText] = useState("");
    const [date, setDate] = useState(new Date());
    const [error, setError] = useState("");
    const theme = Colors[useColorScheme() ?? 'light'];
    const essayId = logId ? loadedEssayId :
      typeof params.essayId === "string" ?
      params.essayId
      : Array.isArray(params.essayId)
      ? params.essayId[0]
      : undefined;

    useEffect(() => {
        if (!logId) return;
        let cancelled = false;
        (async () => {
            try {
                const token = await getToken();
                const log = await fetchALog(logId, token!);
                if (cancelled) return;
                setRatingValue(log.rating);
                setReviewText(log.review_text ?? "");
                setRewatch(log.rewatch);
                // Local noon, not UTC midnight: the date round-trips through
                // toISOString() and toLocaleDateString(), and noon keeps the same
                // calendar day in either for any real timezone offset.
                const [y, m, d] = String(log.date).split('-').map(Number);
                setDate(new Date(y, m - 1, d, 12));
                setLoadedEssayId(log.essay_details.public_id);
            } catch (err) {
                console.error("Error loading log:", err);
                if (!cancelled) setLoadError(true);
            } finally {
                if (!cancelled) setLoadingLog(false);
            }
        })();
        return () => { cancelled = true; };
        // getToken's identity changes on every Clerk render; excluding it keeps
        // this from refetching (and clobbering in-progress edits) each render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [logId]);

     if (logId && loadingLog) {
        return (
          <ThemedView style={styles.page}>
            <ActivityIndicator size="large" color={theme.accent} style={styles.loading} />
          </ThemedView>
        );
      }
     if (logId && loadError) {
        return (
          <ThemedView style={styles.page}>
            <Text style={[styles.errorText, { color: theme.accent }]}>{"Couldn't load this log."}</Text>
          </ThemedView>
        );
      }
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
            const fields = {
                date: date.toISOString().split('T')[0],
                rating: ratingValue,
                review_text: reviewText,
                rewatch: rewatch
            }

            if (logId) {
                await updateLog(logId, fields, authUpdate);
                setLoading(false);
                handleClose();
                return;
            }
            await createLog(authFetch, { essay: essayId, ...fields });
            console.log("Log created successfully");
            setLoading(false);
            router.replace('/');
            showToast('Log created');
        } catch (err) {
            console.error("Error saving log:", err);
            setError("Couldn't save this log — try again.");
            submittingRef.current = false;
            setLoading(false);
        }
    }
    return(
        <ThemedView style={[styles.page, { backgroundColor: theme.surface }]}>
        <KeyboardAvoidingView
          style={[styles.largeContainer, { borderColor: theme.border, backgroundColor: theme.background }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.header, { borderColor: theme.border }]}>
            <TouchableOpacity onPress={handleClose} style={styles.headerSide} accessibilityLabel="Close">
              <Text style={[styles.closeIcon, { color: theme.muted }]}>{"✕"}</Text>
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: theme.text, fontFamily: Fonts?.displayMedium }]}>
              {logId ? "Edit log" : "Log this watch"}
            </Text>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={loading}
              style={[styles.headerSide, styles.headerSideRight]}
            >
              <Text style={[styles.saveText, { color: theme.accent, opacity: loading ? 0.5 : 1 }]}>
                {loading ? "Saving..." : logId ? "Save changes" : "Save Log"}
              </Text>
            </TouchableOpacity>
          </View>

          {error ? (
            <Text style={[styles.errorText, { color: theme.accent }]}>{error}</Text>
          ) : null}

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
            onScrollBeginDrag={Keyboard.dismiss}
          >
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
        </KeyboardAvoidingView>
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
    loading: {
        flex: 1,
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
