import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

// Aperture-ring dot rating (matches the design-system mockup's `.rating`
// treatment) rather than stars — out of 5, filled dots first.
export function RatingDots({ value, max = 5, size = 15 }: { value: number; max?: number; size?: number }) {
  const theme = Colors[useColorScheme()];
  const filled = "★".repeat(Math.max(0, Math.min(max, value)));
  const empty = "★".repeat(Math.max(0, max - value));

  return (
    <Text style={[styles.text, { fontSize: size }]}>
      <Text style={{ color: theme.accent }}>{filled}</Text>
      <Text style={{ color: theme.border }}>{empty}</Text>
    </Text>
  );
}

// Tappable star rating used in the log forms (logVideoModal, quickLog).
// Matches the read-only RatingDots' star treatment above. Each star sets
// the rating to its 1-based position; dotSize keeps the prop name from the
// old dot-based version so callers don't need to change, but now sizes the
// star glyph (and its tap target) instead of a circle's diameter.
export function TappableRatingDots({
  value,
  onChange,
  max = 5,
  dotSize = 34,
}: {
  value: number;
  onChange: (value: number) => void;
  max?: number;
  dotSize?: number;
}) {
  const theme = Colors[useColorScheme()];

  return (
    <View style={styles.row}>
      {Array.from({ length: max }, (_, index) => {
        const position = index + 1;
        const filled = position <= value;
        return (
          <TouchableOpacity
            key={position}
            onPress={() => onChange(position)}
            accessibilityRole="button"
            accessibilityLabel={`Rate ${position} out of ${max}`}
            style={[styles.star, { width: dotSize, height: dotSize }]}
          >
            <Text style={{ fontSize: dotSize , color: filled ? theme.accent : theme.border }}>★</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  text: {
    letterSpacing: 2,
  },
  row: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
  },
  star: {
    alignItems: "center",
    justifyContent: "center",
  },
});
