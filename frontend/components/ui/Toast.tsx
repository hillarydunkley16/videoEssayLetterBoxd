import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View, useColorScheme } from "react-native";
import { Colors, Fonts } from "@/constants/theme";
import { subscribeToast } from "@/src/helpers/toast";

const VISIBLE_MS = 2500;

export function Toast() {
  const theme = Colors[(useColorScheme() ?? "light") as "light" | "dark"];
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const unsubscribe = subscribeToast((next) => {
      setMessage(next);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setMessage(null), VISIBLE_MS);
    });
    return () => {
      unsubscribe();
      clearTimeout(timer.current);
    };
  }, []);

  if (!message) return null;

  return (
    <View style={styles.wrap} pointerEvents="none">
      <View
        style={[styles.toast, { backgroundColor: theme.text }]}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
      >
        <Text style={[styles.text, { color: theme.background, fontFamily: Fonts?.sansSemiBold }]}>
          {message}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 24,
    alignItems: "center",
  },
  toast: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
  },
  text: {
    fontSize: 13.5,
  },
});
