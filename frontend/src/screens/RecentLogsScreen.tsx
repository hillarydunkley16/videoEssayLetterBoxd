import { useCallback, useEffect, useState } from "react";
import { View, Image, FlatList, ActivityIndicator, TouchableOpacity, StyleSheet, Text } from "react-native";
import { fetchLogs, fetchLogsPage } from "../api/logs";
import { fetchPopularVideoEssays } from "../api/videos";
import { Log } from "../types/log";
import { VideoEssay } from "../types/videoEssay";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuth } from "@clerk/clerk-expo";
import { router } from "expo-router";
import { Colors, Fonts } from "@/constants/theme";
import { LogRow } from "@/components/ui/LogRow";

// Global "what people are watching" feed — every log across every user,
// newest first (logList/ is unfiltered, ordered by Log.Meta not set so this
// relies on API pagination order; see backend note in tasks/todo.md about
// missing Meta.ordering on Log).
export default function RecentLogsScreen() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [nextUrl, setNextUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [popular, setPopular] = useState<VideoEssay[]>([]);
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const theme = Colors[useColorScheme()];

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    async function loadInitial() {
      try {
        const token = await getToken();
        if (!token) return;
        const [logsPage, popularPage] = await Promise.all([
          fetchLogs(token),
          fetchPopularVideoEssays(token).catch((error) => {
            console.error("Failed to load popular essays:", error);
            return null;
          }),
        ]);
        setLogs(logsPage.results);
        setNextUrl(logsPage.next);
        if (popularPage) setPopular(popularPage.results);
      } catch (error) {
        console.error("Failed to load recent logs:", error);
      } finally {
        setLoading(false);
      }
    }
    loadInitial();
  }, [isLoaded, isSignedIn]);

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
      console.error("Failed to load more logs:", error);
    } finally {
      setLoadingMore(false);
    }
  }, [nextUrl, loadingMore, getToken]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const token = await getToken();
      if (!token) return;
      const logsPage = await fetchLogs(token);
      setLogs(logsPage.results);
      setNextUrl(logsPage.next);
    } catch (error) {
      console.error("Failed to refresh recent logs:", error);
    } finally {
      setRefreshing(false);
    }
  }, [getToken]);

  if (loading) {
    return <ActivityIndicator size="large" color={theme.accent} style={styles.loading} />;
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <FlatList
        data={logs}
        keyExtractor={(item) => item.public_id}
        contentContainerStyle={styles.listContent}
        onRefresh={onRefresh}
        refreshing={refreshing}
        onEndReachedThreshold={0.4}
        onEndReached={loadMore}
        ListHeaderComponent={
          popular.length > 0 ? (
            <View style={styles.popularSection}>
              <ThemedText style={[styles.sectionLabel, { color: theme.muted, fontFamily: Fonts?.sans }]}>
                popular this week
              </ThemedText>
              <FlatList
                data={popular}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.public_id}
                contentContainerStyle={styles.popularList}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.popularCard}
                    onPress={() => router.push(`/videoInfo?essayId=${item.public_id}`)}
                  >
                    <View style={[styles.popularThumbWrap, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                      {item.thumbnail ? (
                        <Image source={{ uri: item.thumbnail }} style={styles.thumbnail} />
                      ) : (
                        <View style={[styles.thumbnail, { backgroundColor: theme.surface }]} />
                      )}
                      {item.duration ? (
                        <View style={styles.durationBadge}>
                          <Text style={styles.durationText}>{item.duration}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text
                      style={[styles.popularTitle, { color: theme.text, fontFamily: Fonts?.sansMedium }]}
                      numberOfLines={2}
                    >
                      {item.title}
                    </Text>
                    {typeof item.log_count === "number" ? (
                      <Text style={[styles.popularCount, { color: theme.muted, fontFamily: Fonts?.sans }]}>
                        {item.log_count} {item.log_count === 1 ? "log" : "logs"} this week
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                )}
              />
              <ThemedText style={[styles.sectionLabel, { color: theme.muted, fontFamily: Fonts?.sans, marginTop: 24 }]}>
                recently logged
              </ThemedText>
            </View>
          ) : null
        }
        ListFooterComponent={
          loadingMore ? <ActivityIndicator size="small" color={theme.accent} style={styles.footerSpinner} /> : null
        }
        ListEmptyComponent={
          <ThemedText style={[styles.empty, { color: theme.muted }]}>
            No one has logged anything yet.
          </ThemedText>
        }
        renderItem={({ item }) => <LogRow item={item} />}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  loading: {
    justifyContent: "center",
    flex: 1,
  },
  listContent: {
    padding: 12,
    paddingBottom: 24,
  },
  empty: {
    textAlign: "center",
    marginTop: 32,
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  durationBadge: {
    position: "absolute",
    right: 4,
    bottom: 4,
    backgroundColor: "rgba(20,21,26,0.78)",
    borderRadius: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  durationText: {
    color: "#F1F1EE",
    fontSize: 11,
    fontVariant: ["tabular-nums"],
  },
  popularSection: {
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 13,
    marginBottom: 14,
  },
  popularList: {
    gap: 14,
    paddingBottom: 4,
  },
  popularCard: {
    width: 150,
  },
  popularThumbWrap: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 2,
    overflow: "hidden",
    borderWidth: 1,
    marginBottom: 6,
  },
  popularTitle: {
    fontSize: 13,
    lineHeight: 17,
  },
  popularCount: {
    fontSize: 11,
    marginTop: 2,
  },
  footerSpinner: {
    paddingVertical: 16,
  },
});
