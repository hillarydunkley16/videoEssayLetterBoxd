import { StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { PASSWORD_RULES } from "@/src/helpers/passwordRules";

// What the password still needs, shown under the password field. A rule turns teal once met.
export default function PasswordRules({ password }: { password: string }) {
  const theme = Colors[useColorScheme()];
  return (
    <View style={styles.list}>
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password);
        const color = met ? theme.accent2 : theme.muted;
        return (
          <View key={rule.label} style={styles.row} accessible accessibilityLabel={`${rule.label}: ${met ? "met" : "not met"}`}>
            <MaterialCommunityIcons name={met ? "check-circle-outline" : "circle-outline"} size={16} color={color} />
            <Text style={[styles.text, { color, fontFamily: Fonts?.sans }]}>{rule.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  text: { fontSize: 12, lineHeight: 16 },
});
