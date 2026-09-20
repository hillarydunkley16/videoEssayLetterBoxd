// Clerk throws a ClerkAPIResponseError shaped like:
// { clerkError: true, errors: [{ code, message, longMessage, meta }] }
// `message` is a short label ("expired", "incorrect"); `longMessage` is the
// user-facing sentence. We map known codes to our own copy where Clerk's
// default wording doesn't fit, and fall back to `longMessage` otherwise.
type ClerkAPIErrorLike = {
  code?: string
  message?: string
  longMessage?: string
}

const FRIENDLY_MESSAGES: Record<string, string> = {
  verification_expired: 'That verification code has expired. Go back and request a new one.',
  form_code_incorrect: "That code doesn't match. Double-check it and try again.",
  form_password_incorrect: "That password isn't correct. Try again.",
  form_identifier_not_found: "We couldn't find an account with that email.",
}

export function getClerkErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const clerkErr = err as { errors?: ClerkAPIErrorLike[]; message?: string }
  const first = clerkErr?.errors?.[0]
  if (first) {
    return (first.code && FRIENDLY_MESSAGES[first.code]) || first.longMessage || first.message || fallback
  }
  return clerkErr?.message || fallback
}
