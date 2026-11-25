import { useAuthDelete } from "./authDelete";

// Deletes the caller's backend data (Django user + everything that cascades from it).
// The Clerk user is deleted separately by the caller, after this succeeds.
export async function deleteAccountData(authFetch: ReturnType<typeof useAuthDelete>) {
  return authFetch("/api/account/");
}
