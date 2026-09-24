import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

// Track/knob toggle matching the design-system mockup's `.toggle` — used
// for the secondary log actions (rewatch, watchlist).
export function Toggle({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  const theme = Colors[useColorScheme()];
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: value ? 1 : 0, duration: 120, useNativeDriver: false }).start();
  }, [value, anim]);

  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      style={[
        styles.track,
        { borderColor: theme.accent2, backgroundColor: value ? theme.accent2 : "transparent" },
      ]}
    >
      <Animated.View
        style={[
          styles.knob,
          {
            backgroundColor: theme.background,
            left: anim.interpolate({ inputRange: [0, 1], outputRange: [2, 18] }),
          },
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 38,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    justifyContent: "center",
  },
  knob: {
    position: "absolute",
    top: 2,
    width: 15,
    height: 15,
    borderRadius: 8,
  },
});
