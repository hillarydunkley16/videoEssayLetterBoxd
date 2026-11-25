// What a new password must contain. Clerk enforces its own rules too (length, breached
// passwords), set in its dashboard; these two are checked on the form first so the visitor
// sees what is missing before pressing Continue.
export const PASSWORD_RULES = [
  { label: 'Includes a number', test: (password: string) => /[0-9]/.test(password) },
  // Anything that is not a letter (any alphabet), a digit or whitespace.
  { label: 'Includes a special character', test: (password: string) => /[^\p{L}\p{N}\s]/u.test(password) },
];

export const passwordMeetsRules = (password: string) => PASSWORD_RULES.every((rule) => rule.test(password));
