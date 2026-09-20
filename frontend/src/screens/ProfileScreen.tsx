import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useAuth, useClerk, useUser } from "@clerk/clerk-expo";
import { ThemedView } from "@/components/themed-view";
import { Colors, Fonts } from "@/constants/theme";
import { RatingDots } from "@/components/ui/RatingDots";
import { fetchProfile, updateProfileImageAPI } from "@/src/api/users";
import { fetchUsersCollections } from "@/src/api/collection";
import { deleteLog } from "@/src/api/logs";
import { useAuthUpdate } from "@/src/api/authUpdate";
import { useAuthDelete } from "@/src/api/authDelete";
import { Log } from "@/src/types/log";
import { Profile } from "@/src/types/profile";
import { Collection, PaginatedCollections } from "@/src/types/collection";
import { VideoEssay } from "@/src/types/videoEssay";

type Tab = "logs" | "watchlist";

function formatShortDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function ProfileScreen() {
  const theme = Colors[useColorScheme() ?? "light"];
  const { user } = useUser();
  const { signOut } = useClerk();
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const authUpdate = useAuthUpdate();
  const authDelete = useAuthDelete();

  const [profile, setProfile] = useState<Profile>();
  const [lists, setLists] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("logs");

  const loadProfile = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const [profileData, collectionsPage] = await Promise.all([
        fetchProfile(token!),
        fetchUsersCollections(token!) as Promise<PaginatedCollections>,
      ]);
      setProfile(profileData);
      // The watchlist is auto-provisioned and returned inline on the profile
      // as `watchList` — exclude it here so "Lists" only shows lists the
      // user actually created.
      setLists(collectionsPage.results.filter((c) => c.public_id !== profileData.watchList.public_id));
    } catch (error) {
      console.error("Failed to load profile:", error);
    } finally {
      setLoading(false);
    }
    // getToken's identity changes on every Clerk render; excluding it keeps
    // this callback (and the mount effect below) stable across re-renders
    // instead of re-fetching in an infinite loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    loadProfile();
  }, [isLoaded, isSignedIn, loadProfile]);

  async function handleChangePhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (result.canceled) return;

    const uri = result.assets[0].uri;
    const response = await fetch(uri);
    const blob = await response.blob();
    await user?.setProfileImage({ file: blob });
    await user?.reload();
    await updateProfileImageAPI(user?.imageUrl ?? "", authUpdate);
  }

  async function handleDeleteLog(publicId: string) {
    try {
      const token = await getToken();
      await deleteLog(publicId, token!, authDelete);
      setProfile((current) =>
        current ? { ...current, user_logs: current.user_logs.filter((l) => l.public_id !== publicId) } : current
      );
    } catch (error) {
      console.error("Failed to delete log:", error);
    }
  }

  async function handleSignOut() {
    try {
      await signOut();
      router.replace("/");
    } catch (error) {
      console.error("Failed to sign out:", error);
    }
  }

  if (loading || !profile) {
    return <ActivityIndicator size="large" color={theme.accent} style={styles.loading} />;
  }

  const userLogs = profile.user_logs;
  const numLogs = userLogs.length;
  const numEssays = new Set(userLogs.map((l) => l.essay)).size;
  const watchlistEssays = profile.watchList.essays;

  const header = (
    <View>
      <View style={styles.topbar}>
        <Text style={[styles.pageLabel, { color: theme.muted, fontFamily: Fonts?.sans }]}>Profile</Text>
        <TouchableOpacity onPress={handleSignOut} accessibilityLabel="Sign out">
          <Text style={[styles.signOut, { color: theme.muted, fontFamily: Fonts?.sansMedium }]}>Sign out</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.identityRow, { paddingBottom: 22, borderColor: theme.border }]}>
        <View style={styles.idRow}>
          <TouchableOpacity onPress={handleChangePhoto} accessibilityLabel="Change profile photo">
            {user?.imageUrl ? (
              <Image source={{ uri: user.imageUrl }} style={[styles.avatar, { borderColor: theme.background }]} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: theme.accent }]}>
                <Text style={styles.avatarInitial}>{(user?.username ?? "?").charAt(0).toUpperCase()}</Text>
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.idText}>
            <Text style={[styles.displayName, { color: theme.text, fontFamily: Fonts?.displayMedium }]}>
              {user?.fullName || user?.username || "You"}
            </Text>
            <Text style={[styles.handle, { color: theme.muted, fontFamily: Fonts?.sans }]}>
              @{user?.username ?? "unknown"}
            </Text>
          </View>
        </View>

        <View style={[styles.statsRow, { borderColor: theme.border }]}>
          <Stat n={numLogs} label="Logs" theme={theme} />
          <Stat n={numEssays} label="Essays" theme={theme} />
          <Stat
            n={profile.followers_count}
            label="Followers"
            theme={theme}
            onPress={() => router.push({ pathname: "/followList", params: { userId: String(profile.user.id), tab: "followers" } })}
          />
          <Stat
            n={profile.following_count}
            label="Following"
            theme={theme}
            isLast
            onPress={() => router.push({ pathname: "/followList", params: { userId: String(profile.user.id), tab: "following" } })}
          />
        </View>
      </View>

      <View style={[styles.tabs, { borderColor: theme.border }]}>
        <TabButton label="Logs" count={numLogs} active={tab === "logs"} onPress={() => setTab("logs")} theme={theme} />
        <TabButton
          label="Watchlist"
          count={watchlistEssays.length}
          active={tab === "watchlist"}
          onPress={() => setTab("watchlist")}
          theme={theme}
        />
        <TabButton label="Lists" count={lists.length} active={false} onPress={() => router.push("/(tabs)/lists")} theme={theme} />
      </View>
    </View>
  );

  if (tab === "watchlist") {
    return (
      <ThemedView style={styles.container}>
        <FlatList
          key="watchlist"
          data={watchlistEssays}
          keyExtractor={(item) => item.public_id}
          ListHeaderComponent={header}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<EmptyState theme={theme} text="Nothing on your watchlist yet." />}
          renderItem={({ item }) => <EssayRow essay={item} theme={theme} />}
        />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <FlatList
        key="logs"
        data={userLogs}
        keyExtractor={(item) => item.public_id}
        ListHeaderComponent={header}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<EmptyState theme={theme} text="You haven't logged anything yet." />}
        renderItem={({ item }) => <LogRow log={item} theme={theme} onDelete={handleDeleteLog} />}
      />
    </ThemedView>
  );
}

function Stat({
  n,
  label,
  theme,
  isLast,
  onPress,
}: {
  n: number;
  label: string;
  theme: (typeof Colors)["light"];
  isLast?: boolean;
  onPress?: () => void;
}) {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      style={[styles.stat, !isLast && { borderColor: theme.border, borderRightWidth: StyleSheet.hairlineWidth }]}
      {...(onPress ? { onPress } : {})}
    >
      <Text style={[styles.statN, { color: theme.text, fontFamily: Fonts?.displayMedium }]}>{n}</Text>
      <Text style={[styles.statLabel, { color: theme.muted, fontFamily: Fonts?.sans }]}>{label}</Text>
    </Wrapper>
  );
}

function TabButton({
  label,
  count,
  active,
  onPress,
  theme,
}: {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
  theme: (typeof Colors)["light"];
}) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.tab}>
      <Text
        style={[
          styles.tabLabel,
          { color: active ? theme.text : theme.muted, fontFamily: Fonts?.sansSemiBold },
        ]}
      >
        {label} <Text style={{ color: theme.muted, fontFamily: Fonts?.sans }}>{count}</Text>
      </Text>
      {active ? <View style={[styles.tabIndicator, { backgroundColor: theme.accent }]} /> : null}
    </TouchableOpacity>
  );
}

function EmptyState({ theme, text }: { theme: (typeof Colors)["light"]; text: string }) {
  return <Text style={[styles.empty, { color: theme.muted, fontFamily: Fonts?.sans }]}>{text}</Text>;
}

function LogRow({
  log,
  theme,
  onDelete,
}: {
  log: Log;
  theme: (typeof Colors)["light"];
  onDelete: (publicId: string) => void;
}) {
  return (
    <View style={[styles.row, { borderColor: theme.border }]}>
      <TouchableOpacity onPress={() => router.push(`/videoInfo?essayId=${log.essay_details.public_id}`)}>
        <View style={[styles.thumbWrap, { borderColor: theme.border, backgroundColor: theme.surface }]}>
          {log.essay_details.thumbnail ? (
            <Image source={{ uri: log.essay_details.thumbnail }} style={styles.thumbnail} />
          ) : (
            <View style={[styles.thumbnail, { backgroundColor: theme.surface }]} />
          )}
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.body} onPress={() => router.push(`/singleLog?logId=${log.public_id}`)}>
        <View style={styles.rowTop}>
          <Text
            style={[styles.rowTitle, { color: theme.text, fontFamily: Fonts?.sansSemiBold }]}
            numberOfLines={1}
          >
            {log.essay_details.title}
          </Text>
          <RatingDots value={log.rating} size={11} />
        </View>
        <Text style={[styles.rowChannel, { color: theme.muted, fontFamily: Fonts?.sans }]}>
          {log.essay_details.channel_name}
        </Text>
        {log.review_text ? (
          <Text style={[styles.rowReview, { color: theme.text, fontFamily: Fonts?.sans }]} numberOfLines={2}>
            {log.review_text}
          </Text>
        ) : null}
        <View style={styles.rowMeta}>
          <Text style={[styles.rowDate, { color: theme.muted, fontFamily: Fonts?.sans }]}>
            {formatShortDate(log.date)}
          </Text>
          {log.rewatch ? (
            <Text style={[styles.pill, { color: theme.accent2, backgroundColor: `${theme.accent2}22` }]}>
              Rewatch
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => onDelete(log.public_id)}
        style={styles.deleteButton}
        accessibilityLabel="Delete log"
      >
        <Text style={{ color: theme.muted, fontSize: 16 }}>{"×"}</Text>
      </TouchableOpacity>
    </View>
  );
}

function EssayRow({ essay, theme }: { essay: VideoEssay; theme: (typeof Colors)["light"] }) {
  return (
    <TouchableOpacity
      style={[styles.row, { borderColor: theme.border }]}
      onPress={() => router.push(`/videoInfo?essayId=${essay.public_id}`)}
    >
      <View style={[styles.thumbWrap, { borderColor: theme.border, backgroundColor: theme.surface }]}>
        {essay.thumbnail ? (
          <Image source={{ uri: essay.thumbnail }} style={styles.thumbnail} />
        ) : (
          <View style={[styles.thumbnail, { backgroundColor: theme.surface }]} />
        )}
      </View>
      <View style={styles.body}>
        <Text style={[styles.rowTitle, { color: theme.text, fontFamily: Fonts?.sansSemiBold }]} numberOfLines={2}>
          {essay.title}
        </Text>
        <Text style={[styles.rowChannel, { color: theme.muted, fontFamily: Fonts?.sans }]}>
          {essay.channel_name}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
  },
  container: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 32,
  },
  topbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  pageLabel: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  signOut: {
    fontSize: 13,
  },
  identityRow: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderBottomWidth: 1,
  },
  idRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 16,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 3,
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    color: "#fff",
    fontSize: 28,
    fontFamily: Fonts?.display,
  },
  idText: {
    flex: 1,
    minWidth: 0,
    paddingBottom: 4,
  },
  displayName: {
    fontSize: 22,
    lineHeight: 26,
  },
  handle: {
    fontSize: 13,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: "row",
    marginTop: 18,
    borderTopWidth: 1,
    paddingTop: 14,
  },
  stat: {
    flex: 1,
    alignItems: "center",
  },
  statN: {
    fontSize: 18,
  },
  statLabel: {
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginTop: 2,
  },
  tabs: {
    flexDirection: "row",
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  tab: {
    marginRight: 22,
    paddingVertical: 12,
  },
  tabLabel: {
    fontSize: 13,
  },
  tabIndicator: {
    height: 2,
    marginTop: 10,
    borderRadius: 1,
  },
  empty: {
    textAlign: "center",
    marginTop: 32,
    paddingHorizontal: 20,
  },
  row: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  thumbWrap: {
    width: 92,
    aspectRatio: 16 / 9,
    borderRadius: 2,
    overflow: "hidden",
    borderWidth: 1,
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  body: {
    flex: 1,
    justifyContent: "center",
    gap: 3,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  rowTitle: {
    fontSize: 14,
    flexShrink: 1,
  },
  rowChannel: {
    fontSize: 12,
  },
  rowReview: {
    fontSize: 12.5,
    lineHeight: 17,
    opacity: 0.9,
  },
  rowMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  rowDate: {
    fontSize: 11,
  },
  pill: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: "600",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
  },
  deleteButton: {
    paddingHorizontal: 4,
    justifyContent: "center",
  },
});
