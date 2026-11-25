import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors, Fonts } from "@/constants/theme";
import { Collection } from "@/src/types/collection";
import { VideoEssay } from "@/src/types/videoEssay";

// Shared by ListsScreen (the dedicated "Your Lists" page) and ProfileScreen's
// own "Lists" tab count/entry point, so the card + empty-state design only
// lives in one place.

export function NewListButton({ theme, style }: { theme: (typeof Colors)["light"]; style?: object }) {
  return (
    <TouchableOpacity
      style={[styles.newListBtn, { backgroundColor: theme.accent }, style]}
      onPress={() => router.push("/newList")}
    >
      <MaterialCommunityIcons name="plus" size={14} color="#fff" />
      <Text style={[styles.newListText, { color: "#fff", fontFamily: Fonts?.sansSemiBold }]}>New list</Text>
    </TouchableOpacity>
  );
}

function ListCoverCollage({ essays, theme }: { essays: VideoEssay[]; theme: (typeof Colors)["light"] }) {
  const shown = essays.slice(0, 4);
  const remaining = essays.length - shown.length;

  return (
    <View style={styles.coverGrid}>
      {Array.from({ length: 4 }, (_, i) => shown[i]).map((essay, i) => (
        <View key={i} style={[styles.coverCell, { backgroundColor: theme.surface }]}>
          {essay?.thumbnail ? <Image source={{ uri: essay.thumbnail }} style={styles.coverImage} resizeMode="cover" /> : null}
          {i === 3 && remaining > 0 ? (
            <View style={styles.coverMoreOverlay}>
              <Text style={styles.coverMoreText}>+{remaining}</Text>
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

export function ListCard({
  list,
  theme,
  width,
  showOwner,
}: {
  list: Collection;
  theme: (typeof Colors)["light"];
  width?: number;
  // Search results show whose list it is; "Your Lists" doesn't need to.
  showOwner?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.listCard, { borderColor: theme.border, backgroundColor: theme.surface }, width ? { width } : styles.listCardFluid]}
      onPress={() => router.push(`/collectionDetail?publicId=${list.public_id}`)}
    >
      <ListCoverCollage essays={list.essays} theme={theme} />
      <View style={styles.listCardBody}>
        <Text
          style={[styles.listCardName, { color: theme.text, fontFamily: Fonts?.displayMedium }]}
          numberOfLines={2}
        >
          {list.name}
        </Text>
        <Text style={[styles.listCardMeta, { color: theme.muted, fontFamily: Fonts?.sans }]}>
          {list.essays.length} {list.essays.length === 1 ? "essay" : "essays"}
        </Text>
        {showOwner ? (
          <Text style={[styles.listCardMeta, { color: theme.muted, fontFamily: Fonts?.sans }]} numberOfLines={1}>
            by {list.owner}
          </Text>
        ) : null}
        {list.description ? (
          <Text style={[styles.listCardDesc, { color: theme.text, fontFamily: Fonts?.sans }]} numberOfLines={2}>
            {list.description}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export function ListsEmptyState({ theme }: { theme: (typeof Colors)["light"] }) {
  return (
    <View style={styles.listsEmpty}>
      <View style={[styles.listsEmptyMark, { borderColor: theme.border, backgroundColor: theme.surface }]}>
        <MaterialCommunityIcons name="view-grid-outline" size={20} color={theme.muted} />
      </View>
      <Text style={[styles.listsEmptyTitle, { color: theme.muted, fontFamily: Fonts?.display }]}>
        No lists yet&hellip;
      </Text>
      <Text style={[styles.listsEmptySub, { color: theme.muted, fontFamily: Fonts?.sans }]}>
        Group essays into a list from any video&apos;s page — start with something you&apos;ve already logged.
      </Text>
      <NewListButton theme={theme} style={styles.listsEmptyCta} />
    </View>
  );
}

export const listsGridStyles = StyleSheet.create({
  row: {
    paddingHorizontal: 20,
    gap: 12,
  },
});

const styles = StyleSheet.create({
  newListBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginHorizontal: 20,
    marginBottom: 16,
    paddingVertical: 10,
    borderRadius: 3,
  },
  newListText: {
    fontSize: 13,
  },
  listCardFluid: {
    flex: 1,
    maxWidth: "48%",
  },
  listCard: {
    marginBottom: 14,
    borderWidth: 1,
    borderRadius: 5,
    overflow: "hidden",
  },
  coverGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    aspectRatio: 4 / 3,
  },
  coverCell: {
    width: "50%",
    height: "50%",
    position: "relative",
    overflow: "hidden",
  },
  coverImage: {
    width: "100%",
    height: "100%",
  },
  coverMoreOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  coverMoreText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: Fonts?.displayMedium,
  },
  listCardBody: {
    padding: 12,
    gap: 4,
  },
  listCardName: {
    fontSize: 14,
    lineHeight: 18,
  },
  listCardMeta: {
    fontSize: 11,
  },
  listCardDesc: {
    fontSize: 11.5,
    lineHeight: 16,
    opacity: 0.82,
  },
  listsEmpty: {
    alignItems: "center",
    paddingHorizontal: 32,
    paddingTop: 44,
    paddingBottom: 24,
    gap: 12,
  },
  listsEmptyMark: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  listsEmptyTitle: {
    fontSize: 19,
  },
  listsEmptySub: {
    fontSize: 12.5,
    lineHeight: 19,
    textAlign: "center",
    maxWidth: 260,
  },
  listsEmptyCta: {
    marginHorizontal: 0,
    marginTop: 4,
    marginBottom: 0,
    paddingHorizontal: 18,
  },
});
