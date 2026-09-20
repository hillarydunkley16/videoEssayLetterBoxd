import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, useColorScheme } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors, Fonts } from "@/constants/theme";
import { LogRow } from "@/components/ui/LogRow";
import { fetchFollowingFeed, fetchLogsPage } from "../api/logs";
import { Log } from "../types/log";

// Logs from the people you follow, newest first (server-side filtered).
export default function FollowingFeedScreen() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [nextUrl, setNextUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const theme = Colors[(useColorScheme() ?? "light") as "light" | "dark"];

  const loadFirstPage = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const page = await fetchFollowingFeed(token);
      setLogs(page.results);
      setNextUrl(page.next);
    } catch (error) {
      console.error("Failed to load following feed:", error);
    }
    // getToken's identity changes on every Clerk render; excluding it keeps
    // callers from re-fetching in a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    loadFirstPage().finally(() => setLoading(false));
  }, [isLoaded, isSignedIn, loadFirstPage]);

  const loadMore = useCallback(async () => {
    if (!nextUrl || loadingMore) return;
    setLoadingMore(true);
    try {
      const token = await getToken();
      if (!token) return;
      const page = await fetchLogsPage(nextUrl, token);
      setLogs((current) => [...current, ...page.results]);
      setNextUrl(page.next);
    } catch (error) {
      console.error("Failed to load more of the following feed:", error);
    } finally {
      setLoadingMore(false);
    }
  }, [nextUrl, loadingMore, getToken]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadFirstPage();
    setRefreshing(false);
  }, [loadFirstPage]);

  if (loading) {
    return <ActivityIndicator size="large" color={theme.accent} style={styles.loading} />;
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <FlatList
        testID="following-feed"
        data={logs}
        keyExtractor={(item) => item.public_id}
        contentContainerStyle={styles.listContent}
        onRefresh={onRefresh}
        refreshing={refreshing}
        onEndReachedThreshold={0.4}
        onEndReached={loadMore}
        ListFooterComponent={
          loadingMore ? <ActivityIndicator size="small" color={theme.accent} style={styles.footerSpinner} /> : null
        }
        ListEmptyComponent={
          <ThemedView style={styles.emptyWrap}>
            <ThemedText style={[styles.empty, { color: theme.muted }]}>
              Follow people to see their logs here.
            </ThemedText>
            <TouchableOpacity
              testID="feed-empty-search"
              style={[styles.searchButton, { borderColor: theme.border }]}
              onPress={() => router.push("/search")}
            >
              <Text style={{ color: theme.text, fontFamily: Fonts?.sans }}>Find people to follow</Text>
            </TouchableOpacity>
          </ThemedView>
        }
        renderItem={({ item }) => <LogRow item={item} />}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  loading: { justifyContent: "center", flex: 1 },
  listContent: { padding: 12, paddingBottom: 24 },
  emptyWrap: { alignItems: "center", marginTop: 32, gap: 16 },
  empty: { textAlign: "center" },
  searchButton: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  footerSpinner: { paddingVertical: 16 },
});
