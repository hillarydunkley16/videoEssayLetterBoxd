import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { TappableRatingDots } from "@/components/ui/RatingDots";
import { MAX_REVIEW_LENGTH } from "@/src/lib/reviewLimit";
import BottomSheet from "./BottomSheet";

// Where a signed-out visitor rates the essay they picked. A rating is required, the review
// is optional. State resets every time the sheet is reopened.
export default function RatingSheet({
  visible,
  title,
  channel,
  initialRating = 0,
  initialReview = "",
  onSubmit,
  onCancel,
}: {
  visible: boolean;
  title: string;
  channel?: string;
  // What the sheet opens with. Defaults to blank; the landing page passes the visitor's
  // earlier answer when they come Back from the account sheet.
  initialRating?: number;
  initialReview?: string;
  onSubmit: (rating: number, reviewText: string) => void;
  onCancel: () => void;
}) {
  const theme = Colors[useColorScheme()];
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const [showReview, setShowReview] = useState(false);
  // A ref, not state: a second tap can land before a state update re-renders.
  const submitted = useRef(false);

  useEffect(() => {
    if (!visible) return;
    setRating(initialRating);
    setReview(initialReview);
    setShowReview(initialReview !== "");
    submitted.current = false;
    // Only reset when the sheet opens; the initial values are read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const canSubmit = rating > 0;
  const submit = () => {
    if (!canSubmit || submitted.current) return;
    submitted.current = true;
    onSubmit(rating, review.trim());
  };

  return (
    <BottomSheet visible={visible} onClose={onCancel}>
      <Text style={[styles.title, { color: theme.text, fontFamily: Fonts?.displayMedium }]}>{title}</Text>
      {channel ? (
        <Text style={[styles.channel, { color: theme.muted, fontFamily: Fonts?.sans }]}>{channel}</Text>
      ) : null}

      <View style={styles.stars}>
        <TappableRatingDots value={rating} onChange={setRating} dotSize={36} />
      </View>

      {showReview ? (
        <TextInput
          style={[
            styles.review,
            { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface, fontFamily: Fonts?.sans },
          ]}
          value={review}
          onChangeText={setReview}
          placeholder="Write the review you would send a friend"
          placeholderTextColor={theme.muted}
          multiline
          maxLength={MAX_REVIEW_LENGTH}
        />
      ) : (
        <Pressable accessibilityRole="button" accessibilityLabel="Add a review" onPress={() => setShowReview(true)}>
          <Text style={[styles.link, { color: theme.accent, fontFamily: Fonts?.sansSemiBold }]}>Add a review</Text>
        </Pressable>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Log it"
        accessibilityState={{ disabled: !canSubmit }}
        disabled={!canSubmit}
        onPress={submit}
        style={[styles.primary, { backgroundColor: theme.accent, opacity: canSubmit ? 1 : 0.4 }]}
      >
        <Text style={[styles.primaryText, { fontFamily: Fonts?.sansSemiBold }]}>Log it</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Cancel" onPress={onCancel} style={styles.secondary}>
        <Text style={[styles.secondaryText, { color: theme.muted, fontFamily: Fonts?.sans }]}>Cancel</Text>
      </Pressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, lineHeight: 28 },
  channel: { fontSize: 14, marginTop: 4 },
  stars: { marginVertical: 16 },
  review: { minHeight: 88, borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 16, textAlignVertical: "top" },
  link: { fontSize: 14, paddingVertical: 8, textAlign: "center" },
  primary: { marginTop: 16, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  primaryText: { color: "#fff", fontSize: 16 },
  secondary: { paddingVertical: 12, alignItems: "center" },
  secondaryText: { fontSize: 14 },
});
