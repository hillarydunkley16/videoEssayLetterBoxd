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
import { ThemedView } from "@/components/themed-view";
import { Colors, Fonts } from "@/constants/theme";
import { FollowListUser, fetchFollowers, fetchFollowing, fetchProfile, followUser, removeFollower } from "@/src/api/users";
import { useAuthPost } from "@/src/api/authPost";
import { useAuthDelete } from "@/src/api/authDelete";
import UserRow from "./UserRow";

export type FollowListTab = "followers" | "following";

const EMPTY_TEXT: Record<FollowListTab, string> = {
  followers: "No followers yet.",
  following: "Not following anyone yet.",
};

export default function FollowListScreen({ userId, tab: initialTab = "followers" }: { userId: number; tab?: FollowListTab }) {
  const theme = Colors[(useColorScheme() ?? "light") as "light" | "dark"];
  const { getToken } = useAuth();
  const authPost = useAuthPost();
  const authDelete = useAuthDelete();

  const [tab, setTab] = useState<FollowListTab>(initialTab);
  const [rows, setRows] = useState<FollowListUser[]>([]);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<number>();
  const [busyIds, setBusyIds] = useState<number[]>([]);
  const nextPage = useRef(1);
  const fetching = useRef(false);
  // Bumped whenever the list is reset, so a response for a previous tab is dropped.
  const generation = useRef(0);

  const loadPage = useCallback(async () => {
    if (fetching.current) return;
    fetching.current = true;
    const mine = generation.current;
    try {
      const token = await getToken();
      if (!token) return;
      const fetchPage = tab === "followers" ? fetchFollowers : fetchFollowing;
      console.log("fetchPage called")
      const data = await fetchPage(userId, nextPage.current, token);
      console.log("data from fetchPage: ", data)
      if (mine !== generation.current) return;
      nextPage.current += 1;
      setRows((prev) => [...prev, ...data.results]);
      setHasNext(data.next !== null);
    } catch (err) {
      console.error(`Failed to load ${tab}:`, err);
    } finally {
      if (mine === generation.current) {
        fetching.current = false;
        setLoading(false);
      }
    }
    // getToken's identity changes on every Clerk render; excluding it keeps
    // callers from re-fetching in a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, tab]);

  // (Re)start from page 1 whenever the list being shown changes.
  useEffect(() => {
    generation.current += 1;
    fetching.current = false;
    nextPage.current = 1;
    setRows([]);
    setHasNext(false);
    setLoading(true);
    loadPage();
  }, [loadPage]);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        if (token) setMe((await fetchProfile(token)).user.id);
      } catch (err) {
        console.error("Failed to load own profile:", err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  async function remove(id: number) {
    if (busyIds.includes(id)) return;
    setBusyIds((prev) => [...prev, id]);
    try {
      await removeFollower(userId, id, authDelete);
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error("Failed to remove follower:", err);
    } finally {
      setBusyIds((prev) => prev.filter((b) => b !== id));
    }
  }

  function openProfile(id: number) {
    router.push(id === me ? "/profile" : `/otherProfile/${id}`);
  }

  const canRemove = tab === "followers" && me === userId;

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.tabs, { borderColor: theme.border }]}>
        {(["followers", "following"] as const).map((t) => (
          <TouchableOpacity key={t} testID={`tab-${t}`} style={styles.tab} onPress={() => setTab(t)}>
            <Text
              style={{
                color: tab === t ? theme.text : theme.muted,
                fontFamily: tab === t ? Fonts?.displayMedium : Fonts?.sans,
              }}
            >
              {t === "followers" ? "Followers" : "Following"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {loading ? (
        <ActivityIndicator style={styles.loading} />
      ) : (
      <FlatList
        testID="follow-list"
        data={rows}
        keyExtractor={(item) => String(item.id)}
        onEndReached={() => hasNext && loadPage()}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: theme.muted, fontFamily: Fonts?.sans }]}>{EMPTY_TEXT[tab]}</Text>
        }
        renderItem={({ item }) => (
          <UserRow
            user={item}
            showFollow={item.id !== me}
            busy={busyIds.includes(item.id)}
            onOpen={openProfile}
            onToggleFollow={toggle}
            onRemove={canRemove ? remove : undefined}
          />
        )}
      />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },
  loading: { marginTop: 32 },
  tabs: { flexDirection: "row", borderBottomWidth: 1 },
  tab: { marginRight: 22, paddingVertical: 12 },
  empty: { textAlign: "center", marginTop: 32, fontSize: 15 },
});
