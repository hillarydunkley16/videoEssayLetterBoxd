import { View, Image, StyleSheet, Pressable, Linking, ActivityIndicator, ScrollView, Platform, TextInput, TouchableOpacity, useColorScheme } from "react-native"
import { fetchALog, likeLog, commentOnLog } from "../api/logs";
import { addToWatchlist, removeFromWatchlist } from "../api/collection";
import { fetchProfile } from "../api/users";
import { VideoEssay } from "../types/videoEssay";
import { Log } from "../types/log";
import { useEffect, useState } from "react";
import { Text } from "react-native";
import { ThemedView } from "@/components/themed-view";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { useUser, useAuth } from "@clerk/clerk-expo";
import { useAuthPost } from "../api/authPost";
import { useAuthDelete } from "../api/authDelete";
import dayjs from 'dayjs';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors, Fonts } from "@/constants/theme";
import { RatingDots } from "@/components/ui/RatingDots";
import { logRoute } from "@/src/helpers/logRoute";

type Props = {
  id: string;
  onTitleLoaded?: (title: string) => void;
}

function formatViews(views: number | null) {
  if (!views) return null;
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1).replace(/\.0$/, "")}M views`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(1).replace(/\.0$/, "")}K views`;
  return `${views} views`;
}

export default function LogInfo({ id, onTitleLoaded }: Props) {
  const theme = Colors[useColorScheme() ?? "light"];
  const authPost = useAuthPost();
  const authDelete = useAuthDelete();
  const { user } = useUser(); // Clerk hook
  const { getToken } = useAuth();

  const [log, setLog] = useState<Log>();
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [comment, setComment] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [error, setError] = useState("");
  const [watchlistId, setWatchlistId] = useState<string | null>(null);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [watchlistBusy, setWatchlistBusy] = useState(false);

  useEffect(() => {
    async function loadLog() {
      try {
        const token = await getToken();
        const [data, profile] = await Promise.all([
          fetchALog(id, token!),
          fetchProfile(token!),
        ]);
        setLog(data);
        onTitleLoaded?.(data.essay_details.title);
        setLikesCount(data.likes.length);
        setLiked(data.is_liked);
        setWatchlistId(profile.watchList.public_id);
        setInWatchlist(
          profile.watchList.essays.some((e) => e.public_id === data.essay_details.public_id)
        );
      } catch (e) {
        console.log("Error: ", e);
      } finally {
        setLoading(false);
      }
    }
    loadLog()
  }, [id]);

  const handleLike = async () => {
    if (!log) return;
    const result = await likeLog(log.public_id, authPost);
    setLikesCount(result.data.likes_count);
    setLiked(result.data.liked ?? ((prev) => !prev));
  }

  async function handleSubmitComment() {
    setError("")
    if (!comment) {
      setError("Comment is empty");
      return;
    }
    if (!log) {
      setError("Unable to submit comment");
      return;
    }
    try {
      setCommentLoading(true);
      await commentOnLog(log, authPost, { log_id: log.public_id, text: comment, user: user?.username ?? "" });
      const token = await getToken();
      const data = await fetchALog(id, token!);
      setLog(data);
      setComment("")
    } catch (err) {
      setError("Failed to create comment");
      console.error(err)
    } finally {
      setCommentLoading(false);
    }
  }

  async function handleToggleWatchlist() {
    if (!watchlistId || !log || watchlistBusy) return;
    setWatchlistBusy(true);
    try {
      if (inWatchlist) {
        await removeFromWatchlist(log.essay_details.public_id, watchlistId, authDelete);
        setInWatchlist(false);
      } else {
        await addToWatchlist(log.essay_details.public_id, watchlistId, authPost);
        setInWatchlist(true);
      }
    } catch (err) {
      console.error("Failed to update watchlist:", err);
    } finally {
      setWatchlistBusy(false);
    }
  }

  if (loading) return <ActivityIndicator size="large" color={theme.accent} style={styles.loading} />;
  if (!log) return <Text style={{ color: theme.text }}>Log not found</Text>;

  const isMine = log.is_mine;
  const video = log.essay_details;
  const views = formatViews(video.views);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.page}>
            <View style={styles.logHeader}>
              <TouchableOpacity onPress={() => router.push(`/otherProfile/${log.owner_id}`)}>
                {log.owner_image ? (
                  <Image source={{ uri: log.owner_image }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, { backgroundColor: theme.surface }]} />
                )}
              </TouchableOpacity>
              <View style={styles.logHeaderText}>
                <Text style={[styles.byline, { color: theme.text, fontFamily: Fonts?.sansSemiBold }]}>
                  {isMine ? 'You' : log.owner} <Text style={[styles.who, { color: theme.muted, fontFamily: Fonts?.sans }]}>logged this</Text>
                </Text>
                <Text style={[styles.logDate, { color: theme.muted, fontFamily: Fonts?.sans }]}>
                  Watched on {dayjs(log.date).format('D MMMM YYYY')}
                </Text>
              </View>
              <RatingDots value={log.rating} max={5} size={15} />
            </View>

            <View style={styles.reviewBlock}>
              {log.review_text ? (
                <Text style={[styles.reviewText, { color: theme.text, fontFamily: Fonts?.sans }]}>
                  {log.review_text}
                </Text>
              ) : null}
              {log.rewatch ? (
                <View style={styles.tagRow}>
                  <View style={[styles.tag, { borderColor: theme.border }]}>
                    <MaterialCommunityIcons name="repeat" size={12} color={theme.accent2} />
                    <Text style={[styles.tagText, { color: theme.accent2, fontFamily: Fonts?.sansSemiBold }]}>
                      Rewatch
                    </Text>
                  </View>
                </View>
              ) : null}
            </View>

            <View style={[styles.interactRow, { borderColor: theme.border }]}>
              <TouchableOpacity onPress={handleLike} style={styles.interactBtn}>
                <MaterialCommunityIcons name={liked ? "heart" : "heart-outline"} size={17} color={liked ? theme.accent : theme.muted} />
                <Text style={[styles.interactText, { color: liked ? theme.accent : theme.muted, fontFamily: Fonts?.sansSemiBold }]}>
                  {likesCount} {likesCount === 1 ? 'like' : 'likes'}
                </Text>
              </TouchableOpacity>
              <View style={styles.interactBtn}>
                <MaterialCommunityIcons name="comment-outline" size={17} color={theme.muted} />
                <Text style={[styles.interactText, { color: theme.muted, fontFamily: Fonts?.sansSemiBold }]}>
                  {log.comments.length} {log.comments.length === 1 ? 'comment' : 'comments'}
                </Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.muted, fontFamily: Fonts?.sans }]}>Video details</Text>
              <TouchableOpacity
                style={[styles.videoCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => Linking.openURL(video.youtube_url)}
              >
                <View style={styles.videoThumb}>
                  {video.thumbnail ? (
                    <Image source={{ uri: video.thumbnail }} style={styles.videoThumbImage} resizeMode="cover" />
                  ) : null}
                  {video.duration ? (
                    <View style={styles.durationBadge}>
                      <Text style={styles.durationText}>{video.duration}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.videoMeta}>
                  <Text
                    style={[styles.videoTitle, { color: theme.text, fontFamily: Fonts?.displayMedium }]}
                    numberOfLines={2}
                  >
                    {video.title}
                  </Text>
                  <Text style={[styles.videoChannel, { color: theme.text, fontFamily: Fonts?.sansSemiBold }]}>
                    {video.channel_name}
                  </Text>
                  {views ? (
                    <Text style={[styles.videoSub, { color: theme.muted, fontFamily: Fonts?.sans }]}>{views}</Text>
                  ) : null}
                  <Text style={[styles.videoOpen, { color: theme.accent, fontFamily: Fonts?.sansSemiBold }]}>
                    Open essay ›
                  </Text>
                </View>
              </TouchableOpacity>

              <View style={styles.videoActions}>
                <TouchableOpacity
                  style={[styles.chipBtn, { borderColor: theme.border, opacity: watchlistBusy ? 0.6 : 1 }]}
                  onPress={handleToggleWatchlist}
                  disabled={watchlistBusy}
                >
                  <Text style={[styles.chipBtnText, { color: theme.text, fontFamily: Fonts?.sansSemiBold }]}>
                    {inWatchlist ? "Watchlisted" : "+ Watchlist"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.chipBtn, { borderColor: theme.border }]}
                  onPress={() => router.push(logRoute(video.public_id))}
                >
                  <Text style={[styles.chipBtnText, { color: theme.text, fontFamily: Fonts?.sansSemiBold }]}>
                    Log another watch
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.muted, fontFamily: Fonts?.sans }]}>Comments</Text>
              {log.comments.length === 0 ? (
                <Text style={[styles.emptyComments, { color: theme.muted, fontFamily: Fonts?.sans }]}>
                  No comments yet. Be the first to comment!
                </Text>
              ) : (
                log.comments.map((c) => (
                  <View key={c.id} style={[styles.commentRow, { borderColor: theme.border }]}>
                    <View style={[styles.commentAvatar, { backgroundColor: theme.surface }]} />
                    <View style={styles.commentBody}>
                      <Text style={[styles.commentUser, { color: theme.text, fontFamily: Fonts?.sansSemiBold }]}>
                        {c.user}
                      </Text>
                      <Text style={[styles.commentText, { color: theme.text, fontFamily: Fonts?.sans }]}>
                        {c.text}
                      </Text>
                    </View>
                  </View>
                ))
              )}

              <View style={[styles.commentComposer, { borderColor: theme.border }]}>
                <TextInput
                  value={comment}
                  onChangeText={setComment}
                  placeholder="Add a comment…"
                  placeholderTextColor={theme.muted}
                  style={[styles.commentInput, { color: theme.text, fontFamily: Fonts?.sans }]}
                />
                <TouchableOpacity
                  onPress={handleSubmitComment}
                  disabled={commentLoading}
                  style={[styles.sendBtn, { backgroundColor: theme.accent, opacity: commentLoading ? 0.6 : 1 }]}
                >
                  <MaterialCommunityIcons name="send" size={13} color="#fff" />
                </TouchableOpacity>
              </View>
              {error ? (
                <Text style={[styles.errorText, { color: theme.accent, fontFamily: Fonts?.sans }]}>{error}</Text>
              ) : null}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
    ...Platform.select({
      web: {
        alignItems: 'center',
      },
    }),
  },
  page: {
    width: '100%',
    ...Platform.select({
      web: {
        maxWidth: 480,
      },
    }),
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 4,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  logHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  byline: {
    fontSize: 13.5,
  },
  who: {
    fontSize: 13.5,
  },
  logDate: {
    fontSize: 12,
    marginTop: 2,
  },
  reviewBlock: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  reviewText: {
    fontSize: 15,
    lineHeight: 23,
  },
  tagRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tagText: {
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  interactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    marginTop: 12,
  },
  interactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  interactText: {
    fontSize: 13,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  videoCard: {
    borderWidth: 1,
    borderRadius: 6,
    overflow: 'hidden',
  },
  videoThumb: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  videoThumbImage: {
    width: '100%',
    height: '100%',
  },
  durationBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    backgroundColor: 'rgba(20,21,26,0.72)',
    borderRadius: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  durationText: {
    color: '#F1F1EE',
    fontSize: 10,
    fontVariant: ['tabular-nums'],
  },
  videoMeta: {
    padding: 12,
  },
  videoTitle: {
    fontSize: 14.5,
    lineHeight: 18,
    marginBottom: 6,
  },
  videoChannel: {
    fontSize: 12,
  },
  videoSub: {
    fontSize: 11.5,
    marginTop: 2,
  },
  videoOpen: {
    fontSize: 11.5,
    marginTop: 8,
  },
  videoActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  chipBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 3,
    borderWidth: 1,
  },
  chipBtnText: {
    fontSize: 12,
  },
  emptyComments: {
    fontSize: 12.5,
  },
  commentRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  commentAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  commentBody: {
    flex: 1,
    minWidth: 0,
  },
  commentUser: {
    fontSize: 12.5,
  },
  commentText: {
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: 3,
  },
  commentComposer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 6,
    paddingLeft: 14,
  },
  commentInput: {
    flex: 1,
    fontSize: 13,
  },
  sendBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 12,
    marginTop: 8,
  },
});
