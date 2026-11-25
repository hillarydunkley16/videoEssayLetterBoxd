import { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View, useColorScheme } from "react-native";
import { useUser } from "@clerk/clerk-expo";
import { Colors, Fonts } from "@/constants/theme";

function clerkMessage(e: unknown) {
  const first = (e as { errors?: { longMessage?: string; message?: string }[] })?.errors?.[0];
  return first?.longMessage ?? first?.message ?? "Couldn't change your password. Please try again.";
}

// Hidden for accounts without a password (e.g. social sign-in only).
export default function ChangePasswordForm() {
  const theme = Colors[useColorScheme() === "dark" ? "dark" : "light"];
  const { user } = useUser();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!user?.passwordEnabled) return null;

  async function submit() {
    setDone(false);
    if (!currentPassword || !newPassword || !confirm) return setError("Fill in all fields.");
    if (newPassword !== confirm) return setError("New passwords don't match.");
    setError(null);
    setSaving(true);
    try {
      await user!.updatePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
      setDone(true);
    } catch (e) {
      setError(clerkMessage(e));
    } finally {
      setSaving(false);
    }
  }

  const input = [styles.input, { color: theme.text, borderColor: theme.border, fontFamily: Fonts?.sans }];

  return (
    <View style={[styles.wrap, { borderColor: theme.border }]}>
      <Text style={[styles.title, { color: theme.text, fontFamily: Fonts?.sansMedium }]}>Change password</Text>
      <TextInput style={input} secureTextEntry placeholder="Current password" placeholderTextColor={theme.muted}
        accessibilityLabel="Current password" value={currentPassword} onChangeText={setCurrentPassword} />
      <TextInput style={input} secureTextEntry placeholder="New password" placeholderTextColor={theme.muted}
        accessibilityLabel="New password" value={newPassword} onChangeText={setNewPassword} />
      <TextInput style={input} secureTextEntry placeholder="Confirm new password" placeholderTextColor={theme.muted}
        accessibilityLabel="Confirm new password" value={confirm} onChangeText={setConfirm} />
      {error && <Text style={[styles.msg, { color: theme.accent, fontFamily: Fonts?.sans }]}>{error}</Text>}
      {done && <Text style={[styles.msg, { color: theme.muted, fontFamily: Fonts?.sans }]}>Password updated.</Text>}
      <TouchableOpacity onPress={submit} disabled={saving} accessibilityLabel="Update password">
        <Text style={[styles.button, { color: theme.accent, fontFamily: Fonts?.sansMedium }]}>
          {saving ? "Updating…" : "Update password"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, gap: 10 },
  title: { fontSize: 15 },
  input: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  msg: { fontSize: 13 },
  button: { fontSize: 14 },
});
