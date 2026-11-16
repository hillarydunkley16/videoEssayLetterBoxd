import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, TextStyle, View } from "react-native";
import { useSignUp } from "@clerk/clerk-expo";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { getClerkErrorMessage } from "@/src/helpers/clerkErrors";
import { passwordMeetsRules } from "@/src/helpers/passwordRules";
import { useUsernameAvailability } from "@/src/hooks/useUsernameAvailability";

import PasswordRules from "./PasswordRules";

type Theme = (typeof Colors)["light"];

function Field({
  label,
  theme,
  ...input
}: { label: string; theme: Theme } & React.ComponentProps<typeof TextInput>) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.muted, fontFamily: Fonts?.sans }]}>{label}</Text>
      <TextInput
        {...input}
        accessibilityLabel={label}
        placeholderTextColor={theme.muted}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          styles.input,
          { color: theme.text, backgroundColor: theme.surface, borderColor: focused ? theme.accent : theme.border, fontFamily: Fonts?.sans },
          focused && styles.inputFocused,
        ]}
      />
    </View>
  );
}

// The email half of account creation, inside the landing page's account sheet: details, then the
// emailed code. The Clerk calls are the same as app/(auth)/sign-up.tsx, so the two stay in step.
// `summary` is the waiting log, shown under each heading so the visitor sees what is being saved.
export default function EmailSignUpSteps({
  summary,
  onBack,
  onComplete,
}: {
  summary: React.ReactNode;
  onBack: () => void;
  onComplete: () => void;
}) {
  const theme = Colors[useColorScheme()];
  const { isLoaded, signUp, setActive } = useSignUp();

  const [step, setStep] = useState<"details" | "verify">("details");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const { checking, available, suggestions } = useUsernameAvailability(username);

  // Blocked on empty, still checking or known taken. Never on "unknown": Clerk checks on submit.
  const detailsDisabled = busy || !emailAddress || !passwordMeetsRules(password) || !username || checking || available === false;

  const submitDetails = async () => {
    if (!isLoaded || busy) return;
    setBusy(true);
    setError("");
    try {
      await signUp.create({ emailAddress, password, firstName, lastName, username });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setStep("verify");
    } catch (err) {
      setError(getClerkErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async () => {
    if (!isLoaded || busy) return;
    setBusy(true);
    setError("");
    try {
      const attempt = await signUp.attemptEmailAddressVerification({ code });
      if (attempt.status !== "complete") {
        setError("Verification incomplete. Please try again.");
        return;
      }
      await setActive({
        session: attempt.createdSessionId,
        navigate: async ({ session }) => {
          // A pending session task needs Clerk's own screen; stay put rather than hide it.
          if (session?.currentTask) console.log(session.currentTask);
        },
      });
      onComplete();
    } catch (err) {
      setError(getClerkErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const resendCode = async () => {
    if (!isLoaded) return;
    setError("");
    try {
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
    } catch (err) {
      setError(getClerkErrorMessage(err));
    }
  };

  const backAction = step === "verify" ? () => { setError(""); setStep("details"); } : onBack;

  return (
    <View style={styles.root}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={backAction} style={styles.back}>
        <Text style={[styles.small, { color: theme.muted, fontFamily: Fonts?.sans }]}>Back</Text>
      </Pressable>

      <Text style={[styles.title, { color: theme.text, fontFamily: Fonts?.displayMedium }]}>
        {step === "details" ? "Create your account" : "Check your email"}
      </Text>
      {summary}

      {error ? (
        <View style={[styles.error, { borderColor: theme.error }]} accessibilityRole="alert">
          <Text style={[styles.small, { color: theme.error, fontFamily: Fonts?.sans }]}>{error}</Text>
        </View>
      ) : null}

      {step === "details" ? (
        <>
          <View style={styles.two}>
            <View style={styles.half}>
              <Field theme={theme} label="First name" value={firstName} onChangeText={setFirstName} autoComplete="given-name" />
            </View>
            <View style={styles.half}>
              <Field theme={theme} label="Last name" value={lastName} onChangeText={setLastName} autoComplete="family-name" />
            </View>
          </View>
          <Field theme={theme} label="Username" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} />
          {checking ? (
            <Text style={[styles.hint, { color: theme.muted, fontFamily: Fonts?.sans }]}>Checking</Text>
          ) : available === true ? (
            <Text style={[styles.hint, { color: theme.accent2, fontFamily: Fonts?.sans }]}>Available</Text>
          ) : available === false ? (
            <View style={styles.suggestions}>
              <Text style={[styles.hint, { color: theme.error, fontFamily: Fonts?.sans }]}>That username is taken. Try</Text>
              {suggestions.map((suggestion) => (
                <Pressable key={suggestion} accessibilityRole="button" onPress={() => setUsername(suggestion)}>
                  <Text style={[styles.hint, { color: theme.accent, fontFamily: Fonts?.sansSemiBold }]}>{suggestion}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <Field theme={theme} label="Email address" value={emailAddress} onChangeText={setEmailAddress} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
          <Field theme={theme} label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
          <PasswordRules password={password} />
          {/* Clerk mounts its CAPTCHA here on web; custom flows must provide it. */}
          <View nativeID="clerk-captcha" />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continue"
            accessibilityState={{ disabled: detailsDisabled }}
            disabled={detailsDisabled}
            onPress={submitDetails}
            style={[styles.primary, { backgroundColor: theme.accent }, detailsDisabled && styles.disabled]}
          >
            <Text style={[styles.primaryText, { fontFamily: Fonts?.sansSemiBold }]}>Continue</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={[styles.small, { color: theme.muted, fontFamily: Fonts?.sans }]}>
            We sent a verification code to {emailAddress}.
          </Text>
          <Field
            theme={theme}
            label="Verification code"
            value={code}
            onChangeText={(text) => {
              setCode(text);
              setError("");
            }}
            keyboardType="number-pad"
            autoComplete="one-time-code"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Verify and save my log"
            accessibilityState={{ disabled: busy || !code }}
            disabled={busy || !code}
            onPress={submitCode}
            style={[styles.primary, { backgroundColor: theme.accent }, (busy || !code) && styles.disabled]}
          >
            <Text style={[styles.primaryText, { fontFamily: Fonts?.sansSemiBold }]}>Verify and save my log</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Send a new code" onPress={resendCode} style={styles.back}>
            <Text style={[styles.small, { color: theme.accent, fontFamily: Fonts?.sansSemiBold }]}>Send a new code</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  back: { paddingVertical: 4, alignSelf: "flex-start" },
  title: { fontSize: 22, lineHeight: 28 },
  small: { fontSize: 14, lineHeight: 20 },
  two: { flexDirection: "row", gap: 8 },
  half: { flex: 1, minWidth: 0 },
  field: { gap: 4 },
  label: { fontSize: 12, lineHeight: 16 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, outlineStyle: "none" } as unknown as TextStyle,
  inputFocused: { borderWidth: 2, paddingHorizontal: 11 },
  hint: { fontSize: 12, lineHeight: 16 },
  suggestions: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  error: { borderWidth: 1, borderRadius: 12, padding: 12 },
  primary: { borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  primaryText: { color: "#fff", fontSize: 16 },
  disabled: { opacity: 0.4 },
});
