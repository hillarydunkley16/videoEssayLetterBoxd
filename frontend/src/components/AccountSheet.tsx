import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { RatingDots } from "@/components/ui/RatingDots";
import BottomSheet from "./BottomSheet";
import AgeConfirmation from "./AgeConfirmation";
import EmailSignUpSteps from "./EmailSignUpSteps";
import GoogleButton from "./GoogleButton";

// Asks a visitor to make an account once they have rated an essay. It shows the log that is
// waiting. Google and Log in hand off to the existing Clerk flows; email sign-up happens inside
// this sheet (EmailSignUpSteps) so the visitor never leaves the landing page. The pending log is already saved by the caller, so leaving the page is safe.
export default function AccountSheet({
  visible,
  title,
  thumbnail,
  rating,
  onBack,
  onDismiss,
}: {
  visible: boolean;
  title: string;
  thumbnail?: string;
  rating: number;
  onBack: () => void;
  onDismiss: () => void;
}) {
  const theme = Colors[useColorScheme()];
  const [step, setStep] = useState<"choose" | "email">("choose");
  const [ageConfirmed, setAgeConfirmed] = useState(false);

  // A reopened sheet starts from the choices again.
  useEffect(() => {
    if (!visible) {
      setStep("choose");
      setAgeConfirmed(false);
    }
  }, [visible]);

  // Close first so the modal is not left open over the auth screen.
  const goToSignIn = () => {
    onDismiss();
    router.push("/(auth)/sign-in");
  };

  const summary = (
    <View style={[styles.pending, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {thumbnail ? <Image source={{ uri: thumbnail }} style={styles.thumb} accessibilityIgnoresInvertColors /> : null}
      <View style={styles.pendingText}>
        <Text style={[styles.pendingTitle, { color: theme.text, fontFamily: Fonts?.displayMedium }]} numberOfLines={2}>
          {title}
        </Text>
        <View accessible accessibilityLabel={`Rated ${rating} out of 5`}>
          <RatingDots value={rating} size={14} />
        </View>
      </View>
    </View>
  );

  if (step === "email") {
    return (
      <BottomSheet visible={visible} onClose={onDismiss}>
        <EmailSignUpSteps summary={summary} onBack={() => setStep("choose")} onComplete={onDismiss} />
      </BottomSheet>
    );
  }

  return (
    <BottomSheet visible={visible} onClose={onDismiss}>
      <Text style={[styles.title, { color: theme.text, fontFamily: Fonts?.displayMedium }]}>
        Create an account to save it
      </Text>

      {summary}

      <AgeConfirmation checked={ageConfirmed} onChange={setAgeConfirmed} />

      <GoogleButton disabled={!ageConfirmed} />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Create account with email"
        accessibilityState={{ disabled: !ageConfirmed }}
        disabled={!ageConfirmed}
        onPress={() => setStep("email")}
        style={[styles.primary, { backgroundColor: theme.accent }, !ageConfirmed && styles.disabled]}
      >
        <Text style={[styles.primaryText, { fontFamily: Fonts?.sansSemiBold }]}>Create account with email</Text>
      </Pressable>

      <View style={styles.alt}>
        <Text style={[styles.altText, { color: theme.muted, fontFamily: Fonts?.sans }]}>Already have an account?</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Log in" onPress={goToSignIn}>
          <Text style={[styles.altText, { color: theme.accent, fontFamily: Fonts?.sansSemiBold }]}>Log in</Text>
        </Pressable>
      </View>

      <Pressable accessibilityRole="button" accessibilityLabel="Back to rating" onPress={onBack} style={styles.back}>
        <Text style={[styles.altText, { color: theme.muted, fontFamily: Fonts?.sans }]}>Back to rating</Text>
      </Pressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, lineHeight: 28 },
  pending: { flexDirection: "row", gap: 12, alignItems: "center", borderWidth: 1, borderRadius: 12, padding: 12, marginVertical: 16 },
  thumb: { width: 72, aspectRatio: 16 / 9, borderRadius: 8 },
  pendingText: { flex: 1, minWidth: 0, gap: 4 },
  pendingTitle: { fontSize: 16, lineHeight: 20 },
  primary: { marginTop: 12, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  primaryText: { color: "#fff", fontSize: 16 },
  alt: { flexDirection: "row", justifyContent: "center", gap: 4, marginTop: 16 },
  altText: { fontSize: 14 },
  disabled: { opacity: 0.4 },
  back: { paddingVertical: 12, alignItems: "center" },
});
