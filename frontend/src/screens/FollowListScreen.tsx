import { useCallback, useEffect, useRef, useState } from "react";
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
import { router } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { ThemedView } from "@/components/themed-view";
import { Colors, Fonts } from "@/constants/theme";
import { FollowListUser, fetchFollowers, fetchProfile, followUser } from "@/src/api/users";
import { useAuthPost } from "@/src/api/authPost";

export default function FollowListScreen({ userId }: { userId: number }) {
  const theme = Colors[(useColorScheme() ?? "light") as "light" | "dark"];
  const { getToken } = useAuth();
  const authPost = useAuthPost();

  const [rows, setRows] = useState<FollowListUser[]>([]);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<number>();
  const [busyIds, setBusyIds] = useState<number[]>([]);
  const nextPage = useRef(1);
  const fetching = useRef(false);

  const loadPage = useCallback(async () => {
    if (fetching.current) return;
    fetching.current = true;
    try {
      const token = await getToken();
      if (!token) return;
      const data = await fetchFollowers(userId, nextPage.current, token);
      nextPage.current += 1;
      setRows((prev) => [...prev, ...data.results]);
      setHasNext(data.next !== null);
    } catch (err) {
      console.error("Failed to load followers:", err);
    } finally {
      fetching.current = false;
      setLoading(false);
    }
    // getToken's identity changes on every Clerk render; excluding it keeps
    // callers from re-fetching in a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    loadPage();
    (async () => {
      try {
        const token = await getToken();
        if (token) setMe((await fetchProfile(token)).user.id);
      } catch (err) {
        console.error("Failed to load own profile:", err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadPage]);

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

  function openProfile(id: number) {
    router.push(id === me ? "/profile" : `/otherProfile/${id}`);
  }

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <FlatList
        testID="follow-list"
        data={rows}
        keyExtractor={(item) => String(item.id)}
        onEndReached={() => hasNext && loadPage()}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: theme.muted, fontFamily: Fonts?.sans }]}>No followers yet.</Text>
        }
        renderItem={({ item }) => (
          <View style={[styles.row, { borderColor: theme.border }]}>
            <TouchableOpacity style={styles.person} onPress={() => openProfile(item.id)}>
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: theme.border }]} />
              )}
              <Text style={[styles.username, { color: theme.text, fontFamily: Fonts?.sans }]}>{item.username}</Text>
            </TouchableOpacity>
            {item.id !== me && (
              <TouchableOpacity
                testID={`follow-toggle-${item.id}`}
                style={[styles.button, { borderColor: theme.border }]}
                onPress={() => toggle(item.id)}
                disabled={busyIds.includes(item.id)}
              >
                <Text style={{ color: theme.text, fontFamily: Fonts?.sans }}>
                  {item.is_following ? "Following" : "Follow"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  person: { flexDirection: "row", alignItems: "center", flex: 1 },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  username: { fontSize: 15 },
  button: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6 },
  empty: { textAlign: "center", marginTop: 32, fontSize: 15 },
});
