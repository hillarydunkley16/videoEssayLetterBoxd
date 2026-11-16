import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, TextStyle, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import AccountSheet from "@/src/components/AccountSheet";
import RatingSheet from "@/src/components/RatingSheet";
import { fetchPopularVideoEssaysPublic, searchDataBasePublic, searchYoutube } from "@/src/api/videos";
import { extractYoutubeId } from "@/src/lib/shareIntent";
import { clearPendingLog, savePendingLog } from "@/src/lib/pendingLog";
import { SearchResult } from "@/src/types/youtubeResult";
import { VideoEssay } from "@/src/types/videoEssay";

const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 400;
const POPULAR_COUNT = 6;

type Row = {
  youtubeId: string;
  title: string;
  channel: string;
  thumbnail?: string;
  duration?: string | null;
};

type SearchState = "idle" | "loading" | "ok" | "rate_limited" | "unavailable" | "error";

// A row needs a youtube_id to be logged later. Search results and stored essays both carry a
// YouTube link, so one parser (the share-to-app one) covers them; a row without one is skipped.
function toRow(video: Pick<VideoEssay, "youtube_url" | "title" | "channel_name" | "thumbnail"> & { duration?: string | null }): Row | null {
  const youtubeId = extractYoutubeId(video.youtube_url ?? "");
  if (!youtubeId) return null;
  return {
    youtubeId,
    title: video.title,
    channel: video.channel_name,
    thumbnail: video.thumbnail,
    duration: video.duration,
  };
}

function toRows(results: SearchResult[]): Row[] {
  return results.flatMap((r) => toRow(r.video) ?? []);
}

// Home screen shown to signed-out visitors (SignedOut branch of app/(home)/index.tsx). Search is
// the hero: the visitor finds an essay, rates it, and only then is asked to make an account. The
// rated log is saved to pendingLog first, so it survives the sign-up and is replayed afterwards
// (usePendingLogReplay). Top-right Log in lives in the shared nav (WebNav / MobileTopNav).
export default function SignedOutHomeScreen() {
  const theme = Colors[useColorScheme()];
  const [popular, setPopular] = useState<Row[]>([]);
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [state, setState] = useState<SearchState>("idle");
  const [retry, setRetry] = useState(0);

  const [pick, setPick] = useState<Row | null>(null);
  const [sheet, setSheet] = useState<"rating" | "account" | null>(null);
  const [answer, setAnswer] = useState({ rating: 0, review: "" });

  useEffect(() => {
    let cancelled = false;
    fetchPopularVideoEssaysPublic()
      .then((page) => {
        if (!cancelled) setPopular(page.results.flatMap((e) => toRow(e) ?? []).slice(0, POPULAR_COUNT));
      })
      .catch((error) => {
        console.error("Failed to load popular essays for the signed-out home screen:", error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced search. Each new query aborts the previous request, so a slow early answer can
  // never replace a newer one.
  useEffect(() => {
    const text = query.trim();
    if (text.length < MIN_QUERY_LENGTH) {
      setRows([]);
      setState("idle");
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setState("loading");
      const out = await searchYoutube(text, controller.signal);
      if (controller.signal.aborted || out.status === "cancelled") return;
      if (out.status === "unavailable") {
        // External search is switched off: show what is already on watchd instead.
        const stored = await searchDataBasePublic(text);
        if (controller.signal.aborted) return;
        setRows(toRows(stored));
        setState("unavailable");
        return;
      }
      setRows(toRows(out.results));
      setState(out.status);
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, retry]);

  const searching = query.trim().length >= MIN_QUERY_LENGTH;
  const list = searching ? rows : popular;
  const [focused, setFocused] = useState(false);

  const openRating = (row: Row) => {
    setPick(row);
    setAnswer({ rating: 0, review: "" });
    setSheet("rating");
  };

  const submitRating = async (rating: number, reviewText: string) => {
    if (!pick) return;
    setAnswer({ rating, review: reviewText });
    await savePendingLog({ youtubeId: pick.youtubeId, rating, reviewText });
    setSheet("account");
  };

  const cancelRating = () => {
    setSheet(null);
    setPick(null);
    setAnswer({ rating: 0, review: "" });
    void clearPendingLog();
  };

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.column}>
          <Text style={[styles.eyebrow, { color: theme.accent2, fontFamily: Fonts?.sansSemiBold }]}>
            Bootleg Letterboxd for video essays
          </Text>
          <Text style={[styles.headline, { color: theme.text, fontFamily: Fonts?.display }]}>
            Find an essay you watched, then log it
          </Text>
          <Text style={[styles.subhead, { color: theme.muted, fontFamily: Fonts?.sans }]}>
            Rate it now and make an account at the end, so your first log is saved
          </Text>

          <View
            style={[
              styles.search,
              { backgroundColor: theme.surface, borderColor: focused ? theme.accent : theme.border },
              focused && styles.searchFocused,
            ]}
          >
            <View style={styles.searchIcon}>
              <MaterialCommunityIcons name="magnify" size={20} color={theme.muted} />
            </View>
            <TextInput
              style={[styles.searchInput, { color: theme.text, fontFamily: Fonts?.sans }]}
              value={query}
              onChangeText={setQuery}
              placeholder="Search video essays"
              placeholderTextColor={theme.muted}
              accessibilityLabel="Search video essays"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
            />
          </View>

          {searching || popular.length > 0 ? (
            <View style={styles.listHeader}>
              <Text style={[styles.listTitle, { color: theme.muted, fontFamily: Fonts?.sansSemiBold }]}>
                {searching ? "Results" : "Popular this week"}
              </Text>
            </View>
          ) : null}

          {state === "loading" ? (
            <Text style={[styles.note, { color: theme.muted, fontFamily: Fonts?.sans }]}>Searching</Text>
          ) : null}
          {state === "rate_limited" ? (
            <Text style={[styles.note, { color: theme.muted, fontFamily: Fonts?.sans }]}>
              Too many searches. Try again in a minute
            </Text>
          ) : null}
          {state === "unavailable" ? (
            <Text style={[styles.note, { color: theme.muted, fontFamily: Fonts?.sans }]}>
              Search is limited right now. Showing essays already on watchd
            </Text>
          ) : null}
          {state === "error" ? (
            <View style={styles.errorRow}>
              <Text style={[styles.note, { color: theme.muted, fontFamily: Fonts?.sans }]}>Search didn&apos;t work</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Try again" onPress={() => setRetry((n) => n + 1)}>
                <Text style={[styles.retry, { color: theme.accent, fontFamily: Fonts?.sansSemiBold }]}>Try again</Text>
              </Pressable>
            </View>
          ) : null}
          {searching && state === "ok" && list.length === 0 ? (
            <Text style={[styles.note, { color: theme.muted, fontFamily: Fonts?.sans }]}>
              No essays match &quot;{query.trim()}&quot;. Try a channel name
            </Text>
          ) : null}

          {list.map((row) => (
            <Pressable
              key={row.youtubeId}
              accessibilityRole="button"
              accessibilityLabel={`Log ${row.title}`}
              onPress={() => openRating(row)}
              style={({ pressed }) => [
                styles.row,
                { borderColor: theme.border },
                pressed && { backgroundColor: theme.surface },
              ]}
            >
              <View style={[styles.thumb, { backgroundColor: theme.surface }]}>
                {row.thumbnail ? (
                  <Image source={{ uri: row.thumbnail }} style={styles.thumbImage} accessibilityIgnoresInvertColors />
                ) : null}
                {row.duration ? (
                  <Text style={[styles.stamp, { fontFamily: Fonts?.sansMedium }]}>{row.duration}</Text>
                ) : null}
              </View>
              <View style={styles.rowBody}>
                <Text style={[styles.rowTitle, { color: theme.text, fontFamily: Fonts?.displayMedium }]} numberOfLines={2}>
                  {row.title}
                </Text>
                <Text style={[styles.rowChannel, { color: theme.muted, fontFamily: Fonts?.sans }]} numberOfLines={1}>
                  {row.channel}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {pick ? (
        <>
          <RatingSheet
            visible={sheet === "rating"}
            title={pick.title}
            channel={pick.channel}
            initialRating={answer.rating}
            initialReview={answer.review}
            onSubmit={submitRating}
            onCancel={cancelRating}
          />
          <AccountSheet
            visible={sheet === "account"}
            title={pick.title}
            thumbnail={pick.thumbnail}
            rating={answer.rating}
            onBack={() => setSheet("rating")}
            onDismiss={() => setSheet(null)}
          />
        </>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 40 },
  column: { width: "100%", maxWidth: 640, alignSelf: "center", paddingHorizontal: 16, paddingTop: 32 },
  eyebrow: { fontSize: 13, marginBottom: 8 },
  headline: { fontSize: 32, lineHeight: 36, marginBottom: 12 },
  subhead: { fontSize: 16, lineHeight: 24, marginBottom: 24, maxWidth: 480 },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  // The icon renders nothing until its font loads; reserve its size so the field doesn't shift.
  searchIcon: { width: 20, height: 20 },
  // Web draws its own outline on the inner input; the ring is drawn on the field instead.
  searchFocused: { borderWidth: 2, paddingHorizontal: 11 },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 12, fontSize: 16, outlineStyle: "none" } as unknown as TextStyle,
  listHeader: { marginTop: 32, marginBottom: 8 },
  listTitle: { fontSize: 14 },
  note: { fontSize: 14, lineHeight: 20, paddingVertical: 12 },
  errorRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  retry: { fontSize: 14, paddingVertical: 12 },
  row: { flexDirection: "row", gap: 12, paddingVertical: 12, borderBottomWidth: 1, alignItems: "center" },
  thumb: { width: 96, aspectRatio: 16 / 9, borderRadius: 8, overflow: "hidden" },
  thumbImage: { width: "100%", height: "100%" },
  stamp: {
    position: "absolute",
    right: 4,
    bottom: 4,
    fontSize: 11,
    color: "#fff",
    backgroundColor: "rgba(0,0,0,0.75)",
    paddingHorizontal: 4,
    borderRadius: 4,
    fontVariant: ["tabular-nums"],
    overflow: "hidden",
  },
  rowBody: { flex: 1, minWidth: 0, gap: 4 },
  rowTitle: { fontSize: 16, lineHeight: 20, textAlign: "left", writingDirection: "auto" },
  rowChannel: { fontSize: 14, textAlign: "left", writingDirection: "auto" },
});
