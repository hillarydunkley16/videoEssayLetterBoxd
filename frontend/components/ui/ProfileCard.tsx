import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View, useColorScheme } from "react-native";
import { router } from "expo-router";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { Colors, Fonts } from "@/constants/theme";
import { fetchProfile } from "@/src/api/users";
import { Profile } from "@/src/types/profile";

// Signed-in user's summary card for the home sidebar (wide layouts).
export function ProfileCard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const theme = Colors[(useColorScheme() ?? "light") as "light" | "dark"];

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    (async () => {
      try {
        const token = await getToken();
        if (token) setProfile(await fetchProfile(token));
      } catch (error) {
        console.error("Failed to load profile card:", error);
      }
    })();
    // getToken's identity changes on every Clerk render; excluding it avoids a fetch loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn]);

  if (!profile) return null;

  // The Django username is the Clerk id, so name and photo come from Clerk (same as ProfileScreen).
  const username = user?.fullName || user?.username || "You";
  const count = profile.user_logs.length;
  const imageUrl = user?.imageUrl;

  return (
    <View testID="profile-card" style={[styles.card, { borderColor: theme.border }]}>
      <View style={styles.row}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: theme.accent2 }]}>
            <Text style={styles.avatarInitial}>{username.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.flex}>
          <Text style={[styles.name, { color: theme.text, fontFamily: Fonts?.displayMedium }]}>
            {username}
          </Text>
          <Text style={[styles.sub, { color: theme.muted, fontFamily: Fonts?.sans }]}>
            {count} {count === 1 ? "essay" : "essays"} logged · {profile.followers_count}{" "}
            {profile.followers_count === 1 ? "follower" : "followers"}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        testID="profile-card-cta"
        style={[styles.cta, { backgroundColor: theme.accent }]}
        onPress={() => router.push("/search")}
      >
        <Text style={[styles.ctaText, { fontFamily: Fonts?.sansSemiBold }]}>
          {count === 0 ? "Log your first essay" : "Log an essay"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 2, padding: 18 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  flex: { flex: 1 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: "#fff", fontSize: 18, fontWeight: "600" },
  name: { fontSize: 17 },
  sub: { fontSize: 12.5, marginTop: 2 },
  cta: { marginTop: 16, paddingVertical: 10, borderRadius: 2, alignItems: "center" },
  ctaText: { color: "#F6EFE9", fontSize: 13.5 },
});
