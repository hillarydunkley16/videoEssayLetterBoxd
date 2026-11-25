import { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View, useColorScheme } from "react-native";
import { router } from "expo-router";
import { useUser } from "@clerk/clerk-expo";
import { Colors, Fonts } from "@/constants/theme";
import { deleteAccountData } from "@/src/api/account";
import { useAuthDelete } from "@/src/api/authDelete";

export default function DeleteAccountSection() {
  const theme = Colors[useColorScheme() === "dark" ? "dark" : "light"];
  const { user } = useUser();
  const authDelete = useAuthDelete();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const expected = user?.username ?? "DELETE";
  const confirmed = typed === expected;

  async function confirmDelete() {
    if (!confirmed || deleting) return;
    setError(null);
    setDeleting(true);
    // Backend data first: if it fails nothing is deleted. If Clerk then fails, retrying is safe.
    try {
      await deleteAccountData(authDelete);
    } catch (e) {
      console.error("Failed to delete account data:", e);
      setError("Couldn't delete your account. Nothing was changed. Please try again.");
      setDeleting(false);
      return;
    }
    try {
      await user!.delete();
      router.replace("/");
    } catch (e) {
      console.error("Failed to delete Clerk user:", e);
      setError("Your data was removed but your sign-in couldn't be deleted. Please try again.");
      setDeleting(false);
    }
  }

  return (
    <View style={[styles.wrap, { borderColor: theme.border }]}>
      {!open ? (
        <TouchableOpacity onPress={() => setOpen(true)} accessibilityLabel="Delete account">
          <Text style={[styles.title, { color: theme.accent, fontFamily: Fonts?.sansMedium }]}>Delete account</Text>
        </TouchableOpacity>
      ) : (
        <>
          <Text style={[styles.title, { color: theme.text, fontFamily: Fonts?.sansMedium }]}>Delete account</Text>
          <Text style={[styles.msg, { color: theme.muted, fontFamily: Fonts?.sans }]}>
            {`This permanently deletes your logs, lists and profile. Type "${expected}" to confirm.`}
          </Text>
          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.border, fontFamily: Fonts?.sans }]}
            accessibilityLabel="Confirm deletion"
            autoCapitalize="none"
            autoCorrect={false}
            value={typed}
            onChangeText={setTyped}
          />
          {error && <Text style={[styles.msg, { color: theme.accent, fontFamily: Fonts?.sans }]}>{error}</Text>}
          <TouchableOpacity onPress={confirmDelete} disabled={!confirmed || deleting} accessibilityLabel="Permanently delete account">
            <Text style={[styles.title, { color: confirmed ? theme.accent : theme.muted, fontFamily: Fonts?.sansMedium }]}>
              {deleting ? "Deleting…" : "Permanently delete account"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setOpen(false); setTyped(""); setError(null); }} accessibilityLabel="Cancel">
            <Text style={[styles.msg, { color: theme.muted, fontFamily: Fonts?.sansMedium }]}>Cancel</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, gap: 10 },
  title: { fontSize: 15 },
  input: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  msg: { fontSize: 13 },
});
