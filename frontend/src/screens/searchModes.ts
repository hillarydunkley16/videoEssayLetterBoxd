// The search screen's modes, selected by the `type` route param. Shared by SearchScreen (which
// view to show) and SearchField (which placeholder to show) so the two can't drift apart.
export const SEARCH_MODES = ["essays", "people", "lists"] as const;
export type SearchType = (typeof SEARCH_MODES)[number];

export const SEARCH_LABEL: Record<SearchType, string> = {
  essays: "Essays",
  people: "People",
  lists: "Lists",
};

export const SEARCH_PLACEHOLDER: Record<SearchType, string> = {
  essays: "Search a video essay…",
  people: "Search people…",
  lists: "Search lists…",
};

// Anything that isn't a known mode (stale, hand-edited, or a repeated param arriving as an
// array) is essays, so a bad param can never blank the screen.
export function parseSearchType(raw: unknown): SearchType {
  return typeof raw === "string" && (SEARCH_MODES as readonly string[]).includes(raw)
    ? (raw as SearchType)
    : "essays";
}

// `mode=log` is the mobile Log tab: it is always the essay search, whatever `type` says.
export function resolveSearchType({ type, mode }: { type?: unknown; mode?: unknown }): SearchType {
  return mode === "log" ? "essays" : parseSearchType(type);
}
