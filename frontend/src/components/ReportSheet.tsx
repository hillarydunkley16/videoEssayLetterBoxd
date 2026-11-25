import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuthPost } from "@/src/api/authPost";
import {
  REPORT_DETAILS_MAX_LENGTH,
  REPORT_REASONS,
  ReportReason,
  ReportTargetType,
  reportContent,
  reportErrorMessage,
} from "@/src/api/safety";
import BottomSheet from "./BottomSheet";

const NOUN: Record<ReportTargetType, string> = {
  log: "this log",
  comment: "this comment",
  user: "this user",
  list: "this list",
};

// Where a signed-in user reports a log, comment, user or list. A reason is required, details
// are optional. State resets every time the sheet opens.
export default function ReportSheet({
  visible,
  targetType,
  targetId,
  onClose,
}: {
  visible: boolean;
  targetType: ReportTargetType;
  // public_id for a log or list, the numeric id for a comment or user.
  targetId: string | number;
  onClose: () => void;
}) {
  const theme = Colors[useColorScheme()];
  const authPost = useAuthPost();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  // A ref, not state: a second tap can land before a state update re-renders.
  const sending = useRef(false);

  useEffect(() => {
    if (!visible) return;
    setReason(null);
    setDetails("");
    setBusy(false);
    setSent(false);
    setError("");
    sending.current = false;
  }, [visible]);

  async function submit() {
    if (!reason || sending.current) return;
    sending.current = true;
    setBusy(true);
    setError("");
    try {
      await reportContent({ targetType, targetId, reason, details: details.trim() }, authPost);
      setSent(true);
    } catch (err) {
      console.error("Failed to send report:", err);
      setError(reportErrorMessage(err));
      sending.current = false;
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <BottomSheet visible={visible} onClose={onClose}>
        <Text style={[styles.title, { color: theme.text, fontFamily: Fonts?.displayMedium }]}>
          Thanks for letting us know.
        </Text>
        <Text style={[styles.note, { color: theme.muted, fontFamily: Fonts?.sans }]}>
          We review every report within 24 hours.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Done"
          onPress={onClose}
          style={[styles.primary, { backgroundColor: theme.accent }]}
        >
          <Text style={[styles.primaryText, { fontFamily: Fonts?.sansSemiBold }]}>Done</Text>
        </Pressable>
      </BottomSheet>
    );
  }

  const canSend = reason !== null && !busy;
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={[styles.title, { color: theme.text, fontFamily: Fonts?.displayMedium }]}>
        Report {NOUN[targetType]}
      </Text>
      <Text style={[styles.note, { color: theme.muted, fontFamily: Fonts?.sans }]}>Why are you reporting this?</Text>

      <View accessibilityRole="radiogroup" style={styles.reasons}>
        {REPORT_REASONS.map((r) => {
          const selected = reason === r.value;
          return (
            <Pressable
              key={r.value}
              accessibilityRole="radio"
              accessibilityLabel={r.label}
              accessibilityState={{ selected }}
              onPress={() => setReason(r.value)}
              style={[styles.reason, { borderColor: selected ? theme.accent : theme.border }]}
            >
              <View style={[styles.radio, { borderColor: selected ? theme.accent : theme.muted }]}>
                {selected ? <View style={[styles.radioDot, { backgroundColor: theme.accent }]} /> : null}
              </View>
              <Text style={[styles.reasonText, { color: theme.text, fontFamily: Fonts?.sans }]}>{r.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <TextInput
        style={[
          styles.details,
          { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface, fontFamily: Fonts?.sans },
        ]}
        value={details}
        onChangeText={setDetails}
        placeholder="Add details (optional)"
        placeholderTextColor={theme.muted}
        multiline
        maxLength={REPORT_DETAILS_MAX_LENGTH}
      />

      {error ? (
        <Text accessibilityRole="alert" style={[styles.error, { color: theme.error, fontFamily: Fonts?.sans }]}>
          {error}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Send report"
        accessibilityState={{ disabled: !canSend }}
        disabled={!canSend}
        onPress={submit}
        style={[styles.primary, { backgroundColor: theme.accent, opacity: canSend ? 1 : 0.4 }]}
      >
        <Text style={[styles.primaryText, { fontFamily: Fonts?.sansSemiBold }]}>{busy ? "Sending…" : "Send report"}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Cancel" onPress={onClose} style={styles.secondary}>
        <Text style={[styles.secondaryText, { color: theme.muted, fontFamily: Fonts?.sans }]}>Cancel</Text>
      </Pressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, lineHeight: 28 },
  note: { fontSize: 14, marginTop: 4, marginBottom: 12 },
  reasons: { gap: 8 },
  reason: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 12, padding: 12, gap: 12 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 8, height: 8, borderRadius: 4 },
  reasonText: { fontSize: 15 },
  details: {
    minHeight: 72,
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    textAlignVertical: "top",
  },
  error: { fontSize: 13, marginTop: 8 },
  primary: { marginTop: 16, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  primaryText: { color: "#fff", fontSize: 16 },
  secondary: { paddingVertical: 12, alignItems: "center" },
  secondaryText: { fontSize: 14 },
});
