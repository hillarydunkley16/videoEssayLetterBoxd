import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View, useColorScheme } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { Colors, Fonts } from "@/constants/theme";
import { fetchPopularVideoEssays } from "@/src/api/videos";
import { FollowListUser, fetchSuggestedUsers, followUser } from "@/src/api/users";
import { useAuthPost } from "@/src/api/authPost";
import { VideoEssay } from "@/src/types/videoEssay";

function useTheme() {
  return Colors[(useColorScheme() ?? "light") as "light" | "dark"];
}

function Card({ title, children, testID }: { title: string; children: React.ReactNode; testID: string }) {
  const theme = useTheme();
  return (
    <View testID={testID} style={[styles.card, { borderColor: theme.border }]}>
      <Text style={[styles.cardTitle, { color: theme.text, fontFamily: Fonts?.sansSemiBold }]}>{title}</Text>
      {children}
    </View>
  );
}

// Top 3 most-logged essays of the trailing 7 days.
export function PopularThisWeekCard() {
  const [essays, setEssays] = useState<VideoEssay[]>([]);
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const theme = useTheme();

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    (async () => {
      try {
        const token = await getToken();
        if (token) setEssays((await fetchPopularVideoEssays(token)).results.slice(0, 3));
      } catch (error) {
        console.error("Failed to load popular essays:", error);
      }
    })();
    // getToken's identity changes on every Clerk render; excluding it avoids a fetch loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn]);

  if (essays.length === 0) return null;

  return (
    <Card title="Popular this week" testID="popular-card">
      {essays.map((essay, i) => (
        <TouchableOpacity
          key={essay.public_id}
          style={[styles.rankRow, i > 0 && { borderTopWidth: 1, borderTopColor: theme.border }]}
          onPress={() => router.push(`/videoInfo?essayId=${essay.public_id}`)}
        >
          <Text style={[styles.rankNum, { color: theme.accent, fontFamily: Fonts?.display }]}>
            {String(i + 1).padStart(2, "0")}
          </Text>
          <View style={styles.flex}>
            <Text style={[styles.rankTitle, { color: theme.text, fontFamily: Fonts?.sansMedium }]} numberOfLines={2}>
              {essay.title}
            </Text>
            {essay.log_count != null && (
              <Text style={[styles.meta, { color: theme.muted, fontFamily: Fonts?.sans }]}>
                {essay.log_count} {essay.log_count === 1 ? "log" : "logs"} this week
              </Text>
            )}
          </View>
        </TouchableOpacity>
      ))}
    </Card>
  );
}

export function PeopleToFollowCard() {
  const [people, setPeople] = useState<FollowListUser[]>([]);
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const authPost = useAuthPost();
  const theme = useTheme();

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    (async () => {
      try {
        const token = await getToken();
        if (token) setPeople(await fetchSuggestedUsers(token));
      } catch (error) {
        console.error("Failed to load suggested users:", error);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn]);

  async function toggleFollow(id: number) {
    try {
      const result = await followUser(id, authPost);
      setPeople((rows) => rows.map((p) => (p.id === id ? { ...p, is_following: result.following } : p)));
    } catch (error) {
      console.error("Failed to toggle follow:", error);
    }
  }

  if (people.length === 0) return null;

  return (
    <Card title="People to follow" testID="people-card">
      {people.map((person, i) => (
        <View
          key={person.id}
          style={[styles.followRow, i > 0 && { borderTopWidth: 1, borderTopColor: theme.border }]}
        >
          <TouchableOpacity style={styles.person} onPress={() => router.push(`/otherProfile/${person.id}`)}>
            {person.imageUrl ? (
              <Image source={{ uri: person.imageUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: theme.accent2 }]}>
                <Text style={styles.avatarInitial}>{person.username.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <Text style={[styles.name, { color: theme.text, fontFamily: Fonts?.sansSemiBold }]} numberOfLines={1}>
              {person.username}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID={`follow-${person.id}`}
            style={[styles.followBtn, { borderColor: theme.accent2 }]}
            onPress={() => toggleFollow(person.id)}
          >
            <Text style={[styles.followText, { color: theme.accent2, fontFamily: Fonts?.sansSemiBold }]}>
              {person.is_following ? "Following" : "Follow"}
            </Text>
          </TouchableOpacity>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 2, padding: 18, marginTop: 22 },
  cardTitle: { fontSize: 15, marginBottom: 6 },
  flex: { flex: 1 },
  rankRow: { flexDirection: "row", alignItems: "baseline", gap: 10, paddingVertical: 11 },
  rankNum: { fontSize: 14, width: 20 },
  rankTitle: { fontSize: 13.5, lineHeight: 18 },
  meta: { fontSize: 12, marginTop: 2 },
  followRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
  person: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { width: 34, height: 34, borderRadius: 17 },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: "#fff", fontSize: 14, fontWeight: "600" },
  name: { fontSize: 13.5, flex: 1 },
  followBtn: { borderWidth: 1, borderRadius: 2, paddingHorizontal: 11, paddingVertical: 5 },
  followText: { fontSize: 12.5 },
});
