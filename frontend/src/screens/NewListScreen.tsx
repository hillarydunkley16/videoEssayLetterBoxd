import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { Colors, Fonts } from "@/constants/theme";
import { createCollection } from "@/src/api/collection";
import { useAuthPost } from "@/src/api/authPost";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function NewListScreen() {
  const theme = Colors[useColorScheme()];
  const authPost = useAuthPost();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleBack() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  }

  async function handleCreate() {
    const trimmedName = name.trim();
    if (!trimmedName || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const collection = await createCollection(
        { name: trimmedName, description: description.trim() },
        authPost
      );
      router.replace(`/collectionDetail?publicId=${collection.public_id}`);
    } catch (err) {
      console.error("Failed to create list:", err);
      setError("Couldn't create that list. Try again.");
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.topnav, { borderColor: theme.border }]}>
        <TouchableOpacity onPress={handleBack} accessibilityLabel="Back" style={styles.backBtn}>
          <Text style={[styles.backIcon, { color: theme.text }]}>{"‹"}</Text>
        </TouchableOpacity>
        <Text style={[styles.topnavTitle, { color: theme.text, fontFamily: Fonts?.displayMedium }]}>
          New list
        </Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.page}>
        <Text style={[styles.label, { color: theme.muted, fontFamily: Fonts?.sans }]}>Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Video essays about editing"
          placeholderTextColor={theme.muted}
          style={[
            styles.input,
            { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface, fontFamily: Fonts?.sans },
          ]}
          maxLength={255}
          autoFocus
        />

        <Text style={[styles.label, { color: theme.muted, fontFamily: Fonts?.sans, marginTop: 18 }]}>
          Description <Text style={{ color: theme.muted }}>(optional)</Text>
        </Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="What ties this list together?"
          placeholderTextColor={theme.muted}
          style={[
            styles.input,
            styles.textarea,
            { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface, fontFamily: Fonts?.sans },
          ]}
          multiline
          numberOfLines={4}
          maxLength={500}
          textAlignVertical="top"
        />

        {error ? (
          <Text style={[styles.error, { color: theme.accent, fontFamily: Fonts?.sans }]}>{error}</Text>
        ) : null}

        <TouchableOpacity
          style={[
            styles.createBtn,
            { backgroundColor: theme.accent, opacity: !name.trim() || submitting ? 0.6 : 1 },
          ]}
          onPress={handleCreate}
          disabled={!name.trim() || submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={[styles.createBtnText, { fontFamily: Fonts?.sansSemiBold }]}>Create list</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topnav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: {
    fontSize: 26,
    lineHeight: 26,
  },
  topnavTitle: {
    fontSize: 16,
  },
  page: {
    padding: 20,
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
  },
  label: {
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  textarea: {
    minHeight: 96,
    paddingTop: 12,
  },
  error: {
    fontSize: 12.5,
    marginTop: 14,
  },
  createBtn: {
    marginTop: 24,
    borderRadius: 3,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  createBtnText: {
    color: "#fff",
    fontSize: 14,
  },
});
