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
import { router } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { Colors, Fonts } from "@/constants/theme";
import { FollowListUser, fetchSuggestedUsers, followUser, searchUsers } from "@/src/api/users";
import { useAuthPost } from "@/src/api/authPost";
import UserRow from "./UserRow";

// Matches the backend: a shorter query returns an empty page, so we show suggestions instead.
const MIN_QUERY_LENGTH = 2;
// Wait this long after the last keystroke so typing doesn't fire a request per character.
const DEBOUNCE_MS = 250;

// The People mode of the search screen. Under two characters it lists suggested people; from
// two on it runs a debounced username search with infinite scroll. The backend never returns
// the signed-in user, so every row can be followed.
export default function PeopleResults({ q }: { q: string }) {
  const theme = Colors[(useColorScheme() ?? "light") as "light" | "dark"];
  const { getToken } = useAuth();
  const authPost = useAuthPost();

  const query = q.trim();
  const searching = query.length >= MIN_QUERY_LENGTH;

  const [rows, setRows] = useState<FollowListUser[]>([]);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [busyIds, setBusyIds] = useState<number[]>([]);
  const nextPage = useRef(1);
  const fetching = useRef(false);
  // Bumped whenever the query changes or the view goes away, so a slow answer to an earlier
  // query (or one that lands after switching modes) is dropped instead of overwriting the list.
  const generation = useRef(0);

  useEffect(() => {
    const mine = ++generation.current;
    nextPage.current = 1;
    fetching.current = false;
    setRows([]);
    setHasNext(false);
    setFailed(false);
    setLoading(true);

    const load = async () => {
      try {
        const token = await getToken();
        if (!token) return;
        if (searching) {
          const data = await searchUsers(query, 1, token);
          if (mine !== generation.current) return;
          nextPage.current = 2;
          setRows(data.results);
          setHasNext(data.next !== null);
        } else {
          const suggested = await fetchSuggestedUsers(token);
          if (mine !== generation.current) return;
          setRows(suggested);
        }
      } catch (err) {
        if (mine !== generation.current) return;
        console.error("Failed to load people:", err);
        setFailed(true);
      } finally {
        if (mine === generation.current) setLoading(false);
      }
    };

    const handle = searching ? setTimeout(load, DEBOUNCE_MS) : undefined;
    if (!searching) load();
    return () => {
      generation.current += 1;
      if (handle) clearTimeout(handle);
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
      const data = await searchUsers(query, nextPage.current, token);
      if (mine !== generation.current) return;
      nextPage.current += 1;
      setRows((prev) => [...prev, ...data.results]);
      setHasNext(data.next !== null);
    } catch (err) {
      if (mine === generation.current) console.error("Failed to load more people:", err);
    } finally {
      if (mine === generation.current) fetching.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searching, hasNext, query]);

  async function toggle(id: number) {
    if (busyIds.includes(id)) return;
    setBusyIds((prev) => [...prev, id]);
    try {
      const result = await followUser(id, authPost);
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, is_following: result.following } : r)));
    } catch (err) {
      console.error("Failed to toggle follow:", err);
    } finally {
      setBusyIds((prev) => prev.filter((b) => b !== id));
    }
  }

  if (loading) {
    return <ActivityIndicator testID="people-loading" size="large" color={theme.accent} style={styles.loading} />;
  }

  if (failed) {
    return (
      <View style={styles.center}>
        <Text style={[styles.message, { color: theme.muted, fontFamily: Fonts?.sans }]}>Something went wrong.</Text>
        <TouchableOpacity
          testID="people-retry"
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
      testID="people-list"
      style={styles.list}
      data={rows}
      keyExtractor={(item) => String(item.id)}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      ListHeaderComponent={
        !searching && rows.length > 0 ? (
          <Text style={[styles.header, { color: theme.muted, fontFamily: Fonts?.sansSemiBold }]}>Suggested</Text>
        ) : null
      }
      ListEmptyComponent={
        <Text style={[styles.message, { color: theme.muted, fontFamily: Fonts?.sans }]}>
          {searching ? `No one found for “${query}”` : "No suggestions yet. Search for someone by username."}
        </Text>
      }
      renderItem={({ item }) => (
        <UserRow
          user={item}
          showFollow
          busy={busyIds.includes(item.id)}
          onOpen={(id) => router.push(`/otherProfile/${id}`)}
          onToggleFollow={toggle}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: 32 },
  list: { paddingHorizontal: 16 },
  header: { fontSize: 13, paddingVertical: 12 },
  center: { alignItems: "center", marginTop: 32, gap: 16 },
  message: { textAlign: "center", marginTop: 32, fontSize: 15 },
  retry: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
});
