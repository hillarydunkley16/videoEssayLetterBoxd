import { useEffect, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors, Fonts } from "@/constants/theme";
import { RatingDots } from "@/components/ui/RatingDots";
import { fetchPopularVideoEssaysPublic } from "@/src/api/videos";
import { VideoEssay } from "@/src/types/videoEssay";

const FEATURES: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  label: string;
}[] = [
  { icon: "eye-outline", label: "Log & rate what you watch" },
  { icon: "playlist-star", label: "Build lists & watchlists" },
  { icon: "account-group-outline", label: "Follow people with taste" },
];

// Home screen shown to signed-out visitors (SignedOut branch of
// app/(home)/index.tsx). Ports the mockups/homeSignedOut.html design —
// the topbar/brand + "Log in" link there is already covered by WebNav/
// MobileNav, so this starts at the hero.
export default function SignedOutHomeScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const theme = Colors[colorScheme];
  const [popular, setPopular] = useState<VideoEssay[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchPopularVideoEssaysPublic()
      .then((page) => {
        if (!cancelled) setPopular(page.results.slice(0, 3));
      })
      .catch((error) => {
        console.error("Failed to load popular essays for the signed-out home screen:", error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={styles.scroll}
    >
      <View style={styles.hero}>
        <Text style={[styles.eyebrow, { color: theme.accent2, fontFamily: Fonts?.sansSemiBold }]}>
          Bootleg Letterboxd for video essays
        </Text>
        <Text style={[styles.headline, { color: theme.text, fontFamily: Fonts?.display }]}>
          Track every video essay that{" "}
          <Text style={{ fontStyle: "italic", color: theme.accent, fontFamily: Fonts?.display }}>
            rewired
          </Text>{" "}
          how you watch.
        </Text>
        <Text style={[styles.subhead, { color: theme.muted, fontFamily: Fonts?.sans }]}>
          Log the essays you finish, rate them, write the review you&apos;d actually send a
          friend, and build watchlists out of whatever&apos;s melting your brain on YouTube tonight.
        </Text>

        <View style={styles.actionsRow}>
          <Pressable
            style={[styles.btn, styles.btnPrimary, { backgroundColor: theme.accent, borderColor: theme.accent }]}
            onPress={() => router.push("/sign-up")}
          >
            <Text style={[styles.btnText, { color: "#fff", fontFamily: Fonts?.sansSemiBold }]}>
              Create account
            </Text>
          </Pressable>
          <Pressable
            style={[styles.btn, { borderColor: theme.border }]}
            onPress={() => router.push("/sign-in")}
          >
            <Text style={[styles.btnText, { color: theme.text, fontFamily: Fonts?.sansSemiBold }]}>
              Log in
            </Text>
          </Pressable>
        </View>

        <Text style={[styles.fine, { color: theme.muted, fontFamily: Fonts?.sans }]}>
          Beta is invite-only right now. <Text style={{ color: theme.text, fontWeight: "600" }}>Request access</Text>
        </Text>
      </View>

      {popular.length > 0 ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.muted, fontFamily: Fonts?.sansSemiBold }]}>
            Popular this week
          </Text>

          <View style={styles.teaserWrap}>
            {popular.map((essay) => (
              <View key={essay.public_id} style={[styles.logRow, { borderColor: theme.border }]}>
                <View style={[styles.logThumb, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                  {essay.thumbnail ? (
                    <Image source={{ uri: essay.thumbnail }} style={styles.logThumbImage} />
                  ) : null}
                </View>
                <View style={styles.logBody}>
                  <View style={styles.logTop}>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[styles.logTitle, { color: theme.text, fontFamily: Fonts?.sansSemiBold }]}
                        numberOfLines={2}
                      >
                        {essay.title}
                      </Text>
                      <Text style={[styles.logChannel, { color: theme.muted, fontFamily: Fonts?.sans }]}>
                        {essay.channel_name}
                      </Text>
                    </View>
                    <RatingDots value={4} size={10} />
                  </View>
                  {typeof essay.log_count === "number" ? (
                    <Text style={[styles.logWatcher, { color: theme.muted, fontFamily: Fonts?.sans }]}>
                      Logged by {essay.log_count} {essay.log_count === 1 ? "person" : "people"} this week
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}

            <LinearGradient
              pointerEvents="none"
              colors={[`${theme.background}00`, theme.background]}
              style={styles.teaserFade}
            />
            <View style={styles.teaserCtaWrap}>
              <Text style={[styles.teaserCta, { color: theme.accent, fontFamily: Fonts?.sansSemiBold }]}>
                Create an account to see the full feed
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      <View style={styles.features}>
        {FEATURES.map((feature) => (
          <View key={feature.label} style={[styles.feature, { borderColor: theme.border }]}>
            <MaterialCommunityIcons name={feature.icon} size={24} color={theme.accent2} />
            <Text style={[styles.featureLabel, { color: theme.text, fontFamily: Fonts?.sansSemiBold }]}>
              {feature.label}
            </Text>
          </View>
        ))}
      </View>

      <View style={[styles.closing, { backgroundColor: colorScheme === "dark" ? theme.surface : Colors.light.text }]}>
        <Text style={[styles.closingTitle, { fontFamily: Fonts?.display }]}>
          Your next favorite essay is one log away.
        </Text>
        <Text style={styles.closingSub}>Free during the beta — no credit card, just an account.</Text>
        <Pressable
          style={[styles.btn, styles.btnPrimary, styles.closingBtn, { backgroundColor: theme.accent, borderColor: theme.accent }]}
          onPress={() => router.push("/sign-up")}
        >
          <Text style={[styles.btnText, { color: "#fff", fontFamily: Fonts?.sansSemiBold }]}>Create account</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: 40,
  },
  hero: {
    padding: 20,
    borderBottomWidth: 1,
    borderColor: "transparent",
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  headline: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "500",
    marginBottom: 12,
  },
  subhead: {
    fontSize: 14.5,
    lineHeight: 21,
    marginBottom: 20,
    maxWidth: 480,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  btn: {
    flex: 1,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 3,
    borderWidth: 1,
    alignItems: "center",
  },
  btnPrimary: {},
  btnText: {
    fontSize: 13.5,
  },
  fine: {
    fontSize: 11.5,
    marginTop: 14,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 22,
  },
  sectionTitle: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  logRow: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  logThumb: {
    width: 88,
    aspectRatio: 16 / 9,
    borderRadius: 3,
    borderWidth: 1,
    overflow: "hidden",
  },
  logThumbImage: {
    width: "100%",
    height: "100%",
  },
  logBody: {
    flex: 1,
    minWidth: 0,
  },
  logTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  logTitle: {
    fontSize: 14,
    lineHeight: 18,
  },
  logChannel: {
    fontSize: 11.5,
    marginTop: 2,
  },
  logWatcher: {
    fontSize: 11,
    marginTop: 6,
  },
  teaserWrap: {
    position: "relative",
  },
  teaserFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 56,
  },
  teaserCtaWrap: {
    alignItems: "center",
    paddingTop: 6,
  },
  teaserCta: {
    fontSize: 12.5,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  features: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  feature: {
    flex: 1,
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 4,
    padding: 14,
  },
  featureLabel: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 16,
  },
  closing: {
    margin: 20,
    marginTop: 26,
    padding: 22,
    borderRadius: 6,
    alignItems: "center",
  },
  closingTitle: {
    fontSize: 19,
    color: "#F1F1EE",
    textAlign: "center",
    marginBottom: 6,
  },
  closingSub: {
    fontSize: 12.5,
    color: "rgba(241,241,238,0.72)",
    textAlign: "center",
    marginBottom: 16,
  },
  closingBtn: {
    flex: undefined,
    minWidth: 200,
  },
});
