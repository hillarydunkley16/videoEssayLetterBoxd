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
import { useAuth } from "@clerk/clerk-expo";
import { ThemedView } from "@/components/themed-view";
import { Colors, Fonts } from "@/constants/theme";
import { BlockedUser, fetchBlockedUsers, unblockUser } from "@/src/api/safety";
import { useAuthDelete } from "@/src/api/authDelete";
import { notifyBlockChanged } from "@/src/helpers/blockEvents";
import { showToast } from "@/src/helpers/toast";

// Settings > Blocked users: the people you blocked, each with an Unblock. Unblocking brings their
// content back but does not restore follows. Rows aren't links: a blocked profile is unavailable.
export default function BlockedUsersScreen() {
  const theme = Colors[(useColorScheme() ?? "light") as "light" | "dark"];
  const { getToken } = useAuth();
  const authDelete = useAuthDelete();

  const [rows, setRows] = useState<BlockedUser[]>([]);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [actionError, setActionError] = useState("");
  const [busyIds, setBusyIds] = useState<number[]>([]);
  const nextPage = useRef(1);
  const fetching = useRef(false);
  // Refs, not state: a second tap can land before a state update re-renders.
  const unblocking = useRef(new Set<number>());

  const loadPage = useCallback(async () => {
    if (fetching.current) return;
    fetching.current = true;
    try {
      const token = await getToken();
      if (!token) return;
      const data = await fetchBlockedUsers(nextPage.current, token);
      nextPage.current += 1;
      setRows((prev) => [...prev, ...data.results]);
      setHasNext(data.next !== null);
    } catch (err) {
      console.error("Failed to load blocked users:", err);
      setFailed(true);
    } finally {
      fetching.current = false;
      setLoading(false);
    }
    // getToken's identity changes on every Clerk render; excluding it keeps this from
    // re-fetching in a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  async function unblock(user: BlockedUser) {
    if (unblocking.current.has(user.id)) return;
    unblocking.current.add(user.id);
    setBusyIds((prev) => [...prev, user.id]);
    setActionError("");
    try {
      await unblockUser(user.id, authDelete);
      setRows((prev) => prev.filter((r) => r.id !== user.id));
      notifyBlockChanged();
      showToast(`Unblocked ${user.username}`);
    } catch (err) {
      console.error("Failed to unblock user:", err);
      setActionError(`Couldn't unblock ${user.username}. Please try again.`);
    } finally {
      unblocking.current.delete(user.id);
      setBusyIds((prev) => prev.filter((id) => id !== user.id));
    }
  }

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={theme.accent} style={styles.loading} />
      </ThemedView>
    );
  }

  const status = failed
    ? "Couldn't load your blocked users."
    : rows.length === 0
      ? "You haven't blocked anyone."
      : null;

  return (
    <ThemedView style={styles.container}>
      {actionError ? (
        <Text accessibilityRole="alert" style={[styles.error, { color: theme.error, fontFamily: Fonts?.sans }]}>
          {actionError}
        </Text>
      ) : null}
      <FlatList
        testID="blocked-users-list"
        data={rows}
        keyExtractor={(item) => String(item.id)}
        onEndReached={() => {
          if (hasNext) loadPage();
        }}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          status ? <Text style={[styles.status, { color: theme.muted, fontFamily: Fonts?.sans }]}>{status}</Text> : null
        }
        renderItem={({ item }) => (
          <View style={[styles.row, { borderColor: theme.border }]}>
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: theme.border }]} />
            )}
            <Text style={[styles.username, { color: theme.text, fontFamily: Fonts?.sans }]} numberOfLines={1}>
              {item.username}
            </Text>
            <TouchableOpacity
              accessibilityLabel={`Unblock ${item.username}`}
              style={[styles.button, { borderColor: theme.border, opacity: busyIds.includes(item.id) ? 0.6 : 1 }]}
              onPress={() => unblock(item)}
              disabled={busyIds.includes(item.id)}
            >
              <Text style={{ color: theme.text, fontFamily: Fonts?.sansSemiBold }}>Unblock</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { marginTop: 32 },
  status: { fontSize: 15, textAlign: "center", marginTop: 32, paddingHorizontal: 20 },
  error: { fontSize: 13, paddingHorizontal: 20, paddingTop: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  username: { flex: 1, fontSize: 15 },
  button: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
});
