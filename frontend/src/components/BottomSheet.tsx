import { Modal, Pressable, StyleSheet, View } from "react-native";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

// A plain Modal panel pinned to the bottom (max 480 wide, so it stays phone-width on web).
// Used instead of @gorhom/bottom-sheet because the landing page is not inside a modal route,
// and Modal behaves the same on web, iOS and Android. Tapping the scrim, the Android back
// button or Escape on web all call onClose.
export default function BottomSheet({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const theme = Colors[useColorScheme()];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          style={[styles.scrim, { backgroundColor: "rgba(0,0,0,0.5)" }]}
          onPress={onClose}
          accessibilityLabel="Close"
        />
        <View
          accessibilityViewIsModal
          style={[styles.panel, { backgroundColor: theme.background, borderColor: theme.border }]}
        >
          <View style={[styles.grab, { backgroundColor: theme.border }]} />
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end", alignItems: "center" },
  scrim: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  panel: {
    width: "100%",
    maxWidth: 480,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  grab: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginBottom: 16 },
});
