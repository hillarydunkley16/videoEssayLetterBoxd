import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { Colors, Fonts } from "@/constants/theme";
import { ListCard, listsGridStyles } from "@/components/ui/ListsGrid";
import { searchCollections } from "@/src/api/collection";
import { Collection } from "@/src/types/collection";

// Matches the backend: a shorter query returns an empty page, so we show a prompt instead.
const MIN_QUERY_LENGTH = 2;
// Wait this long after the last keystroke so typing doesn't fire a request per character.
const DEBOUNCE_MS = 250;

// The Lists mode of the search screen: a debounced search over list names with infinite
// scroll. The backend never returns watchlists, so nothing here needs to filter them.
export default function ListResults({ q }: { q: string }) {
  const theme = Colors[(useColorScheme() ?? "light") as "light" | "dark"];
  const { getToken } = useAuth();

  const query = q.trim();
  const searching = query.length >= MIN_QUERY_LENGTH;

  const [lists, setLists] = useState<Collection[]>([]);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(searching);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const nextPage = useRef(1);
  const fetching = useRef(false);
  // Bumped whenever the query changes or the view goes away, so a slow answer to an earlier
  // query is dropped instead of overwriting the list.
  const generation = useRef(0);

  useEffect(() => {
    const mine = ++generation.current;
    nextPage.current = 1;
    fetching.current = false;
    setLists([]);
    setHasNext(false);
    setFailed(false);
    setLoading(searching);
    if (!searching) return;

    const handle = setTimeout(async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const data = await searchCollections(query, 1, token);
        if (mine !== generation.current) return;
        nextPage.current = 2;
        setLists(data.results);
        setHasNext(data.next !== null);
      } catch (err) {
        if (mine !== generation.current) return;
        console.error("Failed to search lists:", err);
        setFailed(true);
      } finally {
        if (mine === generation.current) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      generation.current += 1;
      clearTimeout(handle);
    };
    // getToken's identity changes on every Clerk render; excluding it keeps this from
    // re-fetching in a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, attempt]);

  const loadMore = useCallback(async () => {
    if (!searching || !hasNext || fetching.current) return;
    fetching.current = true;
    const mine = generation.current;
    try {
      const token = await getToken();
      if (!token) return;
      const data = await searchCollections(query, nextPage.current, token);
      if (mine !== generation.current) return;
      nextPage.current += 1;
      setLists((prev) => [...prev, ...data.results]);
      setHasNext(data.next !== null);
    } catch (err) {
      if (mine === generation.current) console.error("Failed to load more lists:", err);
    } finally {
      if (mine === generation.current) fetching.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searching, hasNext, query]);

  if (!searching) {
    return (
      <Text style={[styles.message, { color: theme.muted, fontFamily: Fonts?.sans }]}>Search lists by name</Text>
    );
  }

  if (loading) {
    return <ActivityIndicator testID="lists-loading" size="large" color={theme.accent} style={styles.loading} />;
  }

  if (failed) {
    return (
      <View style={styles.center}>
        <Text style={[styles.message, { color: theme.muted, fontFamily: Fonts?.sans }]}>Something went wrong.</Text>
        <TouchableOpacity
          testID="lists-retry"
          style={[styles.retry, { borderColor: theme.border }]}
          onPress={() => setAttempt((n) => n + 1)}
        >
          <Text style={{ color: theme.text, fontFamily: Fonts?.sans }}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      testID="lists-list"
      data={lists}
      numColumns={2}
      columnWrapperStyle={lists.length > 0 ? listsGridStyles.row : undefined}
      keyExtractor={(item) => item.public_id}
      contentContainerStyle={styles.listContent}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      ListEmptyComponent={
        <Text style={[styles.message, { color: theme.muted, fontFamily: Fonts?.sans }]}>
          {`No lists match “${query}”`}
        </Text>
      }
      renderItem={({ item }) => <ListCard list={item} theme={theme} showOwner />}
    />
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: 32 },
  listContent: { paddingTop: 16, paddingBottom: 32 },
  center: { alignItems: "center", marginTop: 32, gap: 16 },
  message: { textAlign: "center", marginTop: 32, fontSize: 15 },
  retry: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
});
