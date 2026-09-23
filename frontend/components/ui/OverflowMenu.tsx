import { useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View, useColorScheme, useWindowDimensions } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors, Fonts } from "@/constants/theme";

export type OverflowMenuItem = {
  label: string;
  onPress: () => void;
  destructive?: boolean;
};

// Three-dots button + popover, rendered in a transparent Modal so it behaves the
// same on web, iOS and Android (no platform-specific action sheets). The popover
// is anchored under the button via measureInWindow.
export function OverflowMenu({ items, accessibilityLabel = "More options" }: {
  items: OverflowMenuItem[];
  accessibilityLabel?: string;
}) {
  const theme = Colors[(useColorScheme() ?? "light") as "light" | "dark"];
  const { width: windowWidth } = useWindowDimensions();
  const buttonRef = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState({ top: 56, right: 16 });

  function openMenu() {
    buttonRef.current?.measureInWindow?.((x, y, w, h) => {
      setAnchor({ top: y + h + 4, right: Math.max(8, windowWidth - (x + w)) });
    });
    setOpen(true);
  }

  return (
    <>
      <TouchableOpacity
        ref={buttonRef}
        onPress={openMenu}
        accessibilityLabel={accessibilityLabel}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <MaterialCommunityIcons name="dots-horizontal" size={22} color={theme.muted} />
      </TouchableOpacity>
      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} accessibilityLabel="Close menu" />
        <View
          style={[styles.menu, anchor, { backgroundColor: theme.background, borderColor: theme.border }]}
        >
          {items.map((item) => (
            <TouchableOpacity
              key={item.label}
              style={styles.item}
              onPress={() => {
                setOpen(false);
                item.onPress();
              }}
            >
              <Text
                style={[
                  styles.itemText,
                  { color: item.destructive ? theme.accent : theme.text, fontFamily: Fonts?.sansSemiBold },
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  menu: {
    position: "absolute",
    minWidth: 140,
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 4,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  item: {
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  itemText: {
    fontSize: 14,
  },
});
