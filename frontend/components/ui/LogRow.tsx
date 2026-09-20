import { Image, StyleSheet, Text, TouchableOpacity, View, useColorScheme } from "react-native";
import { router } from "expo-router";
import { Colors, Fonts } from "@/constants/theme";
import { RatingDots } from "@/components/ui/RatingDots";
import { Log } from "@/src/types/log";

// One log in a home feed: essay thumbnail, who watched it, review and rating.
export function LogRow({ item }: { item: Log }) {
  const theme = Colors[(useColorScheme() ?? "light") as "light" | "dark"];
  return (
    <View style={[styles.row, { borderColor: theme.border }]}>
      <TouchableOpacity onPress={() => router.push(`/videoInfo?essayId=${item.essay_details.public_id}`)}>
        <View style={[styles.thumbWrap, { borderColor: theme.border, backgroundColor: theme.surface }]}>
          {item.essay_details.thumbnail ? (
            <Image source={{ uri: item.essay_details.thumbnail }} style={styles.thumbnail} />
          ) : (
            <View style={[styles.thumbnail, { backgroundColor: theme.surface }]} />
          )}
          {item.essay_details.duration ? (
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>{item.essay_details.duration}</Text>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.body} onPress={() => router.push(`/singleLog?logId=${item.public_id}`)}>
        <Text style={[styles.who, { color: theme.text, fontFamily: Fonts?.sansSemiBold }]}>
          {item.owner}{" "}
          <Text style={[styles.on, { color: theme.muted, fontFamily: Fonts?.sans }]}>
            watched {item.essay_details.title}
          </Text>
        </Text>
        {item.review_text ? (
          <Text style={[styles.review, { color: theme.text, fontFamily: Fonts?.sans }]} numberOfLines={2}>
            {item.review_text}
          </Text>
        ) : null}
        <RatingDots value={item.rating} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  thumbWrap: {
    width: 120,
    aspectRatio: 16 / 9,
    borderRadius: 2,
    overflow: "hidden",
    borderWidth: 1,
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  durationBadge: {
    position: "absolute",
    right: 4,
    bottom: 4,
    backgroundColor: "rgba(20,21,26,0.78)",
    borderRadius: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  durationText: {
    color: "#F1F1EE",
    fontSize: 11,
    fontVariant: ["tabular-nums"],
  },
  body: {
    flex: 1,
    justifyContent: "center",
    gap: 4,
  },
  who: {
    fontSize: 14,
  },
  on: {
    fontWeight: "400",
  },
  review: {
    fontSize: 13,
    lineHeight: 18,
  },
});
