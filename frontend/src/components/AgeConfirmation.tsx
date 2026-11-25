import { Pressable, StyleSheet, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { clearAgeConfirmation, saveAgeConfirmation } from "@/src/lib/ageConfirmation";

export const AGE_CONFIRMATION_LABEL = "I confirm I am 16 or older";

// The tick a visitor must make before creating an account, by Google or by email. It starts
// unchecked on purpose: a box that is already ticked is not a confirmation.
export default function AgeConfirmation({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const theme = Colors[useColorScheme()];
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={AGE_CONFIRMATION_LABEL}
      accessibilityState={{ checked }}
      onPress={() => {
        // Held in storage too: the Google redirect reloads the page, and the server is told
        // only once the visitor is signed in (useAgeConfirmationSync).
        void (checked ? clearAgeConfirmation() : saveAgeConfirmation());
        onChange(!checked);
      }}
      style={styles.row}
    >
      <MaterialCommunityIcons
        name={checked ? "checkbox-marked" : "checkbox-blank-outline"}
        size={24}
        color={checked ? theme.accent : theme.muted}
      />
      <Text style={[styles.label, { color: theme.text, fontFamily: Fonts?.sans }]}>{AGE_CONFIRMATION_LABEL}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  label: { flex: 1, fontSize: 14, lineHeight: 20 },
});
