import { StyleSheet, Text, TouchableOpacity, View, useColorScheme } from "react-native";
import { router } from "expo-router";
import { useClerk } from "@clerk/clerk-expo";
import { ThemedView } from "@/components/themed-view";
import { Colors, Fonts } from "@/constants/theme";
import ChangePasswordForm from "./ChangePasswordForm";
import DeleteAccountSection from "./DeleteAccountSection";
import { useChangeProfilePhoto } from "@/src/hooks/useChangeProfilePhoto";

export default function SettingsScreen() {
  const theme = Colors[useColorScheme() === "dark" ? "dark" : "light"];
  const { signOut } = useClerk();
  const { changePhoto, error: photoError } = useChangeProfilePhoto();

  async function handleSignOut() {
    try {
      await signOut();
      router.replace("/");
    } catch (error) {
      console.error("Failed to sign out:", error);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Back">
          <Text style={[styles.back, { color: theme.muted, fontFamily: Fonts?.sansMedium }]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.pageLabel, { color: theme.muted, fontFamily: Fonts?.sans }]}>Settings</Text>
      </View>

      <View style={[styles.row, { borderColor: theme.border }]}>
        <TouchableOpacity onPress={changePhoto} accessibilityLabel="Change profile photo">
          <Text style={[styles.rowText, { color: theme.text, fontFamily: Fonts?.sansMedium }]}>Change profile photo</Text>
        </TouchableOpacity>
        {photoError && <Text style={[styles.error, { color: theme.accent, fontFamily: Fonts?.sans }]}>{photoError}</Text>}
      </View>

      <ChangePasswordForm />

      <View style={[styles.row, { borderColor: theme.border }]}>
        <TouchableOpacity onPress={handleSignOut} accessibilityLabel="Sign out">
          <Text style={[styles.rowText, { color: theme.text, fontFamily: Fonts?.sansMedium }]}>Sign out</Text>
        </TouchableOpacity>
      </View>

      <DeleteAccountSection />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  back: { fontSize: 13 },
  pageLabel: { fontSize: 11, letterSpacing: 1, textTransform: "uppercase" },
  row: { paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderBottomWidth: 1 },
  rowText: { fontSize: 15 },
  error: { fontSize: 13, marginTop: 8 },
});
