import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View, useColorScheme } from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { ThemedText } from "@/components/themed-text";
import { Colors, Fonts } from "@/constants/theme";
import { fetchProfile } from "@/src/api/users";

// Soft, dismissible nudge for a signed-in user with no display_username — they stay invisible
// to People search until they set one (SPEC-username-onboarding.md decision 4). Self-contained:
// it fetches its own profile so the screens that mount it (home feed, profile tab) need no
// extra data-fetching wiring. Dismiss is local state only — it reappears next app open, since
// the point is closing the invisibility gap, not permanently hiding the nudge.
export default function UsernameGateBanner() {
  const theme = Colors[(useColorScheme() ?? "light") as "light" | "dark"];
  const { getToken } = useAuth();
  const [needsUsername, setNeedsUsername] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const profile = await fetchProfile(token);
        if (cancelled) return;
        setNeedsUsername(!profile.has_username);
      } catch (err) {
        // Fail closed: don't show a broken nudge if the profile fetch errors.
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // getToken's identity changes on every Clerk render; excluding it keeps this from
    // re-fetching in a loop (same reasoning as PeopleResults.tsx).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!loaded || !needsUsername || dismissed) return null;

  return (
    <View
      testID="username-gate-banner"
      style={[styles.banner, { backgroundColor: theme.surface, borderColor: theme.border }]}
    >
      <ThemedText style={[styles.text, { fontFamily: Fonts?.sans }]}>
        Choose a username so people can find and follow you.
      </ThemedText>
      <Pressable onPress={() => setDismissed(true)} hitSlop={8}>
        <ThemedText type="link" style={styles.dismiss}>Dismiss</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  text: {
    flex: 1,
    fontSize: 14,
    marginRight: 12,
  },
  dismiss: {
    fontSize: 13,
  },
});
