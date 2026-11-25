const FIELD_LABELS: Record<string, string> = {
  review_text: 'Review',
  rating: 'Rating',
  date: 'Date',
  rewatch: 'Rewatch',
};

// DRF answers a rejected write with 400 and {field: ["message", ...]}. Returns the
// first message per field, or null when the error isn't such a payload.
export function validationErrors(err: unknown): Record<string, string> | null {
  const response = (err as { response?: { status?: number; data?: unknown } } | null)?.response;
  if (response?.status !== 400) return null;
  const data = response.data;
  if (!data || typeof data !== 'object') return null;
  const errors: Record<string, string> = {};
  for (const [field, messages] of Object.entries(data as Record<string, unknown>)) {
    if (Array.isArray(messages) && typeof messages[0] === 'string') errors[field] = messages[0];
  }
  return Object.keys(errors).length > 0 ? errors : null;
}

// The first such error as "Label: message", ignoring fields shown elsewhere in the
// UI (`skip`). Null when there's nothing left to report.
export function validationMessage(err: unknown, skip: string[] = []): string | null {
  const errors = validationErrors(err);
  if (!errors) return null;
  const field = Object.keys(errors).find((f) => !skip.includes(f));
  return field ? `${FIELD_LABELS[field] ?? field}: ${errors[field]}` : null;
}
