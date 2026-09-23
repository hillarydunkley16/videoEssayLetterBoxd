const FIELD_LABELS: Record<string, string> = {
  review_text: 'Review',
  rating: 'Rating',
  date: 'Date',
  rewatch: 'Rewatch',
};

// DRF answers a rejected write with 400 and {field: ["message", ...]}. Returns the
// first such message as "Label: message", or null when the error isn't one.
export function validationMessage(err: unknown): string | null {
  const response = (err as { response?: { status?: number; data?: unknown } } | null)?.response;
  if (response?.status !== 400) return null;
  const data = response.data;
  if (!data || typeof data !== 'object') return null;
  for (const [field, messages] of Object.entries(data as Record<string, unknown>)) {
    if (Array.isArray(messages) && typeof messages[0] === 'string') {
      return `${FIELD_LABELS[field] ?? field}: ${messages[0]}`;
    }
  }
  return null;
}
