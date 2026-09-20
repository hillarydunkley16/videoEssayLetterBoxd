import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { router } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { ThemedView } from "@/components/themed-view";
import { Colors, Fonts } from "@/constants/theme";
import { RatingDots } from "@/components/ui/RatingDots";
import { getAVideoEssay } from "@/src/api/videos";
import { fetchProfile } from "@/src/api/users";
import { addToWatchlist, removeFromWatchlist } from "@/src/api/collection";
import { useAuthPost } from "@/src/api/authPost";
import { useAuthDelete } from "@/src/api/authDelete";
import { Log } from "@/src/types/log";
import { VideoEssay } from "@/src/types/videoEssay";
import { logRoute } from "@/src/helpers/logRoute";

function formatViews(views: number | null) {
  if (!views) return null;
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1).replace(/\.0$/, "")}M views`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(1).replace(/\.0$/, "")}K views`;
  return `${views} views`;
}

function formatShortDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function VideoInfoScreen({ id }: { id: string }) {
  const theme = Colors[useColorScheme() ?? "light"];
  const { getToken } = useAuth();
  const authPost = useAuthPost();
  const authDelete = useAuthDelete();

  const [video, setVideo] = useState<VideoEssay | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [logCount, setLogCount] = useState(0);
  const [watchlistId, setWatchlistId] = useState<string | null>(null);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [watchlistBusy, setWatchlistBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const [essayData, profile] = await Promise.all([
        getAVideoEssay(id, token!),
        fetchProfile(token!),
      ]);
      setVideo(essayData.video);
      setLogs(essayData.logs);
      setLogCount(essayData.log_count);
      setWatchlistId(profile.watchList.public_id);
      setInWatchlist(profile.watchList.essays.some((e) => e.public_id === id));
    } catch (err) {
      console.error("Failed to load video essay:", err);
      setError("Failed to load this essay.");
    } finally {
      setLoading(false);
    }
    // getToken's identity changes on every Clerk render; excluding it keeps
    // this callback (and the mount effect below) stable across re-renders
    // instead of re-fetching in an infinite loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // router.back() silently no-ops when this screen has no back-history (e.g.
  // opened via a direct/refreshed URL on web), so fall back to a known route
  // instead of leaving the back button dead.
  function handleBack() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }

  async function handleToggleWatchlist() {
    if (!watchlistId || watchlistBusy) return;
    setWatchlistBusy(true);
    try {
      if (inWatchlist) {
        await removeFromWatchlist(id, watchlistId, authDelete);
        setInWatchlist(false);
      } else {
        await addToWatchlist(id, watchlistId, authPost);
        setInWatchlist(true);
      }
    } catch (err) {
      console.error("Failed to update watchlist:", err);
    } finally {
      setWatchlistBusy(false);
    }
  }

  if (loading) {
    return <ActivityIndicator size="large" color={theme.accent} style={styles.loading} />;
  }
  if (error || !video) {
    return <Text style={[styles.error, { color: theme.text }]}>{error ?? "Essay not found."}</Text>;
  }

  const ratingCounts = [0, 0, 0, 0, 0];
  logs.forEach((log) => {
    const rating = Number(log.rating);
    if (rating >= 1 && rating <= 5) ratingCounts[rating - 1] += 1;
  });
  const avgRating = logs.length
    ? logs.reduce((sum, log) => sum + Number(log.rating), 0) / logs.length
    : 0;
  const recentLogs = logs.slice(0, 3);
  const views = formatViews(video.views);

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.page}>
        <View style={styles.hero}>
          <TouchableOpacity
            style={[styles.heroTouch, { borderColor: theme.border, backgroundColor: theme.surface }]}
            onPress={() => Linking.openURL(video.youtube_url)}
          >
            {video.thumbnail ? (
              <Image source={{ uri: video.thumbnail }} style={styles.heroImage} resizeMode="cover" />
            ) : (
              <View style={[styles.heroImage, { backgroundColor: theme.surface }]} />
            )}
            {video.duration ? (
              <View style={styles.durationBadge}>
                <Text style={styles.durationText}>{video.duration}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            accessibilityLabel="Back"
          >
            <Text style={styles.backIcon}>{"‹"}</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.titleBlock, { borderColor: theme.border }]}>
          <Text style={[styles.title, { color: theme.text, fontFamily: Fonts?.displayMedium }]}>
            {video.title}
          </Text>
          <View style={styles.channelRow}>
            <Text style={[styles.channelName, { color: theme.text, fontFamily: Fonts?.sansSemiBold }]}>
              {video.channel_name}
            </Text>
            {views ? (
              <>
                <Text style={[styles.metaDot, { color: theme.muted }]}>·</Text>
                <Text style={[styles.views, { color: theme.muted, fontFamily: Fonts?.sans }]}>{views}</Text>
              </>
            ) : null}
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary, { backgroundColor: theme.accent, borderColor: theme.accent }]}
            onPress={() => router.push(logRoute(id))}
          >
            <Text style={[styles.btnPrimaryText, { fontFamily: Fonts?.sansSemiBold }]}>Log this watch</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, { borderColor: theme.border, opacity: watchlistBusy ? 0.6 : 1 }]}
            onPress={handleToggleWatchlist}
            disabled={watchlistBusy}
          >
            <Text style={[styles.btnText, { color: theme.text, fontFamily: Fonts?.sansSemiBold }]}>
              {inWatchlist ? "Watchlisted" : "Watchlist"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.muted, fontFamily: Fonts?.sans }]}>Ratings</Text>

          <View style={styles.statsSummary}>
            <View>
              <Text style={[styles.bigStatN, { color: theme.text, fontFamily: Fonts?.displayMedium }]}>
                {logCount}
              </Text>
              <Text style={[styles.bigStatLabel, { color: theme.muted, fontFamily: Fonts?.sans }]}>Logs</Text>
            </View>
            {logs.length > 0 ? (
              <View style={styles.avgRating}>
                <RatingDots value={Math.round(avgRating)} size={15} />
                <Text style={[styles.avgVal, { color: theme.muted, fontFamily: Fonts?.sans }]}>
                  {avgRating.toFixed(1)} avg
                </Text>
              </View>
            ) : null}
          </View>

          {logs.length > 0 ? (
            <View style={styles.dist}>
              {ratingCounts.map((count, index) => {
                const pct = Math.round((count / logs.length) * 100);
                return (
                  <View key={index} style={styles.distRow}>
                    <RatingDots value={index + 1} size={11} />
                    <View style={[styles.distTrack, { backgroundColor: theme.surface }]}>
                      <View style={[styles.distFill, { width: `${pct}%`, backgroundColor: theme.accent }]} />
                    </View>
                    <Text style={[styles.distPct, { color: theme.muted, fontFamily: Fonts?.sans }]}>{pct}%</Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={[styles.empty, { color: theme.muted, fontFamily: Fonts?.sans }]}>
              No one has logged this yet — be the first.
            </Text>
          )}
        </View>

        {recentLogs.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={[styles.sectionTitle, { color: theme.muted, fontFamily: Fonts?.sans }]}>
                Recent Logs
              </Text>
              <TouchableOpacity onPress={() => router.push(`/logs?essayId=${id}`)}>
                <Text style={[styles.sectionLink, { color: theme.accent, fontFamily: Fonts?.sansSemiBold }]}>
                  See all {logCount}
                </Text>
              </TouchableOpacity>
            </View>

            {recentLogs.map((log) => (
              <TouchableOpacity
                key={log.public_id}
                style={[styles.logRow, { borderColor: theme.border }]}
                onPress={() => router.push(`/singleLog?logId=${log.public_id}`)}
              >
                {log.owner_image ? (
                  <Image source={{ uri: log.owner_image }} style={styles.logAvatar} />
                ) : (
                  <View style={[styles.logAvatar, { backgroundColor: theme.surface }]} />
                )}
                <View style={styles.logBody}>
                  <View style={styles.logTop}>
                    <Text style={[styles.logUser, { color: theme.text, fontFamily: Fonts?.sansSemiBold }]}>
                      {log.owner}
                    </Text>
                    <Text style={[styles.logDate, { color: theme.muted, fontFamily: Fonts?.sans }]}>
                      {formatShortDate(log.date)}
                    </Text>
                  </View>
                  <RatingDots value={log.rating} size={11} />
                  {log.review_text ? (
                    <Text
                      style={[styles.logReview, { color: theme.text, fontFamily: Fonts?.sans }]}
                      numberOfLines={2}
                    >
                      {log.review_text}
                    </Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
  },
  error: {
    flex: 1,
    textAlign: "center",
    marginTop: 32,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
    ...Platform.select({
      web: {
        alignItems: "center",
      },
    }),
  },
  // On web the content is capped and centered like the rest of the app's
  // modal-style screens; on native it already fills the available width.
  page: {
    width: "100%",
    ...Platform.select({
      web: {
        maxWidth: 480,
      },
    }),
  },
  hero: {
    width: "100%",
  },
  heroTouch: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderBottomWidth: 1,
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  durationBadge: {
    position: "absolute",
    right: 10,
    bottom: 10,
    backgroundColor: "rgba(20,21,26,0.72)",
    borderRadius: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  durationText: {
    color: "#F1F1EE",
    fontSize: 11,
    fontVariant: ["tabular-nums"],
  },
  backButton: {
    position: "absolute",
    top: 14,
    left: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(20,21,26,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: {
    color: "#fff",
    fontSize: 22,
    lineHeight: 22,
    marginRight: 2,
  },
  titleBlock: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 21,
    lineHeight: 26,
    marginBottom: 8,
  },
  channelRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  channelName: {
    fontSize: 13,
  },
  metaDot: {
    marginHorizontal: 6,
  },
  views: {
    fontSize: 12.5,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  btn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 3,
    borderWidth: 1,
  },
  btnPrimary: {
    flex: 2,
  },
  btnPrimaryText: {
    color: "#fff",
    fontSize: 14,
  },
  btnText: {
    fontSize: 14,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 22,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 14,
  },
  sectionLink: {
    fontSize: 12,
  },
  statsSummary: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 20,
    marginBottom: 16,
  },
  bigStatN: {
    fontSize: 28,
  },
  bigStatLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginTop: 2,
  },
  avgRating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingBottom: 4,
  },
  avgVal: {
    fontSize: 13,
  },
  dist: {
    gap: 8,
  },
  distRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  distTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  distFill: {
    height: "100%",
    borderRadius: 3,
  },
  distPct: {
    width: 32,
    textAlign: "right",
    fontSize: 11.5,
  },
  empty: {
    fontSize: 13,
  },
  logRow: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  logAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  logBody: {
    flex: 1,
    gap: 3,
  },
  logTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 8,
  },
  logUser: {
    fontSize: 13,
  },
  logDate: {
    fontSize: 11,
  },
  logReview: {
    fontSize: 12.5,
    lineHeight: 17,
    opacity: 0.9,
  },
});
