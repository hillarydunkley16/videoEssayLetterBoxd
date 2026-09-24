import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { addToWatchlist } from "@/src/api/collection";
import { useAuthPost } from "@/src/api/authPost";
import { callSerpAPI, searchDataBase, useVideoApi } from "@/src/api/videos";
import { SearchResult } from "@/src/types/youtubeResult";

const DB_FILTER_DEBOUNCE_MS = 250;

// Modal for adding an essay to a list: typing filters existing essays,
// Enter also searches YouTube (same split as SearchScreen). Picking a
// YouTube-only result creates the VideoEssay first, then adds it.
export default function AddEssayToListScreen({ collectionId }: { collectionId: string }) {
  const theme = Colors[useColorScheme()];
  const { getToken } = useAuth();
  const authPost = useAuthPost();
  const { convertYouTubeResultToVideoEssay } = useVideoApi();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  async function search(includeYouTube: boolean) {
    const q = query.trim();
    const requestId = ++requestIdRef.current;
    if (!q) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let db: SearchResult[] = [];
    try {
      const token = await getToken();
      if (token) db = (await searchDataBase(q, token)) ?? [];
    } catch (err) {
      console.warn("database search failed", err);
    }
    let yt: SearchResult[] = [];
    if (includeYouTube) {
      try {
        yt = await callSerpAPI(q);
      } catch (err) {
        console.warn("youtube search failed", err);
      }
    }
    if (requestIdRef.current !== requestId) return;
    const seen = new Set(db.map((r) => (r.video.title ?? "").toLowerCase()));
    setResults([...db, ...yt.filter((r) => !seen.has((r.video.title ?? "").toLowerCase()))]);
    setLoading(false);
  }

  useEffect(() => {
    const handle = setTimeout(() => search(false), DB_FILTER_DEBOUNCE_MS);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function handleBack() {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }

  async function handleAdd(item: SearchResult, key: string) {
    if (addingKey) return;
    setAddingKey(key);
    setError(null);
    try {
      const essay = item.source === "database" ? item : await convertYouTubeResultToVideoEssay(item.video);
      if (essay.source !== "database") throw new Error("essay was not saved");
      await addToWatchlist(essay.video.public_id, collectionId, authPost);
      handleBack();
    } catch (err) {
      console.error("Failed to add essay to list:", err);
      setError("Couldn't add that essay. Try again.");
      setAddingKey(null);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.topnav, { borderColor: theme.border }]}>
        <TouchableOpacity onPress={handleBack} accessibilityLabel="Back" style={styles.backBtn}>
          <Text style={[styles.backIcon, { color: theme.text }]}>{"‹"}</Text>
        </TouchableOpacity>
        <Text style={[styles.heading, { color: theme.text, fontFamily: Fonts?.displayMedium }]}>Add essay</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.page}>
        <TextInput
          style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.surface }]}
          placeholder="Search a video essay…"
          placeholderTextColor={theme.muted}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => search(true)}
          returnKeyType="search"
          autoFocus
        />
        <Text style={[styles.hint, { color: theme.muted, fontFamily: Fonts?.sans }]}>
          Press enter to also search YouTube.
        </Text>
        {error ? <Text style={[styles.hint, { color: theme.accent }]}>{error}</Text> : null}

        {loading ? (
          <ActivityIndicator color={theme.accent} style={styles.loading} />
        ) : (
          <FlatList
            data={results}
            keyboardShouldPersistTaps="handled"
            keyExtractor={(item, i) => (item.source === "database" ? item.video.public_id : `api-${i}`)}
            ListEmptyComponent={
              query.trim() ? (
                <Text style={[styles.hint, { color: theme.muted, fontFamily: Fonts?.sans }]}>No results found</Text>
              ) : null
            }
            renderItem={({ item, index }) => {
              const key = item.source === "database" ? item.video.public_id : `api-${index}`;
              return (
                <TouchableOpacity
                  style={[styles.row, { borderColor: theme.border, opacity: addingKey && addingKey !== key ? 0.5 : 1 }]}
                  onPress={() => handleAdd(item, key)}
                  disabled={!!addingKey}
                >
                  <View style={[styles.thumbWrap, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                    {item.video.thumbnail ? (
                      <Image source={{ uri: item.video.thumbnail }} style={styles.thumbnail} resizeMode="cover" />
                    ) : null}
                  </View>
                  <View style={styles.body}>
                    <Text
                      style={[styles.rowTitle, { color: theme.text, fontFamily: Fonts?.sansSemiBold }]}
                      numberOfLines={2}
                    >
                      {item.video.title}
                    </Text>
                    <Text style={[styles.rowChannel, { color: theme.muted, fontFamily: Fonts?.sans }]}>
                      {item.source === "api" ? "from YouTube" : item.video.channel_name}
                    </Text>
                  </View>
                  <Text style={[styles.plus, { color: theme.accent }]}>{addingKey === key ? "…" : "+"}</Text>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topnav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backBtn: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  backIcon: { fontSize: 26, lineHeight: 26 },
  heading: { fontSize: 17 },
  page: {
    flex: 1,
    width: "100%",
    paddingHorizontal: 20,
    paddingTop: 16,
    ...Platform.select({ web: { maxWidth: 480, alignSelf: "center" } }),
  },
  input: { borderWidth: 1, borderRadius: 3, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  hint: { fontSize: 12, marginTop: 8 },
  loading: { marginTop: 24 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  thumbWrap: { width: 96, aspectRatio: 16 / 9, borderRadius: 2, overflow: "hidden", borderWidth: 1 },
  thumbnail: { width: "100%", height: "100%" },
  body: { flex: 1, gap: 4 },
  rowTitle: { fontSize: 14, lineHeight: 18 },
  rowChannel: { fontSize: 12 },
  plus: { fontSize: 22, width: 30, textAlign: "center" },
});
