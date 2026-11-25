import { Image, StyleSheet, Text, TouchableOpacity, View, useColorScheme } from "react-native";
import { Colors, Fonts } from "@/constants/theme";
import { FollowListUser } from "@/src/api/users";

type UserRowProps = {
  user: FollowListUser;
  // False on the signed-in user's own row: you can't follow yourself.
  showFollow: boolean;
  // Disables the buttons while a request for this row is in flight; the parent owns the state.
  busy: boolean;
  onOpen: (id: number) => void;
  onToggleFollow: (id: number) => void;
  // Shows a Remove button when given (someone removing a follower from their own list).
  onRemove?: (id: number) => void;
};

// One person in a list: avatar and name open their profile, with a follow toggle and an
// optional Remove. Shared by the followers/following lists and People search.
export default function UserRow({ user, showFollow, busy, onOpen, onToggleFollow, onRemove }: UserRowProps) {
  const theme = Colors[(useColorScheme() ?? "light") as "light" | "dark"];
  return (
    <View style={[styles.row, { borderColor: theme.border }]}>
      <TouchableOpacity style={styles.person} onPress={() => onOpen(user.id)}>
        {user.imageUrl ? (
          <Image source={{ uri: user.imageUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: theme.border }]} />
        )}
        <Text style={[styles.username, { color: theme.text, fontFamily: Fonts?.sans }]}>{user.username}</Text>
      </TouchableOpacity>
      {onRemove && (
        <TouchableOpacity
          testID={`remove-follower-${user.id}`}
          style={[styles.button, styles.removeButton, { borderColor: theme.border }]}
          onPress={() => onRemove(user.id)}
          disabled={busy}
        >
          <Text style={{ color: theme.muted, fontFamily: Fonts?.sans }}>Remove</Text>
        </TouchableOpacity>
      )}
      {showFollow && (
        <TouchableOpacity
          testID={`follow-toggle-${user.id}`}
          style={[styles.button, { borderColor: theme.border }]}
          onPress={() => onToggleFollow(user.id)}
          disabled={busy}
        >
          <Text style={{ color: theme.text, fontFamily: Fonts?.sans }}>
            {user.is_following ? "Following" : "Follow"}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  person: { flexDirection: "row", alignItems: "center", flex: 1 },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  username: { fontSize: 15 },
  removeButton: { marginRight: 8 },
  button: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6 },
});
