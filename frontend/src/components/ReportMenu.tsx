import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { OverflowMenu, OverflowMenuItem } from "@/components/ui/OverflowMenu";
import { ReportTargetType } from "@/src/api/safety";
import ReportSheet from "./ReportSheet";

// iOS can't present a Modal while another is still dismissing, so the sheet waits for the
// menu's close animation. Web and Android open it straight away.
const OPEN_DELAY_MS = Platform.OS === "ios" ? 300 : 0;

// A "..." menu with Report (and any extra items, e.g. Block user) that opens the report sheet.
// Render it only for other people's content: it has no notion of ownership itself.
export default function ReportMenu({
  targetType,
  targetId,
  extraItems = [],
  accessibilityLabel = "More options",
}: {
  targetType: ReportTargetType;
  targetId: string | number;
  extraItems?: OverflowMenuItem[];
  accessibilityLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const items: OverflowMenuItem[] = [
    { label: "Report", onPress: () => { timer.current = setTimeout(() => setOpen(true), OPEN_DELAY_MS); } },
    ...extraItems,
  ];

  return (
    <>
      <OverflowMenu items={items} accessibilityLabel={accessibilityLabel} />
      <ReportSheet visible={open} targetType={targetType} targetId={targetId} onClose={() => setOpen(false)} />
    </>
  );
}
