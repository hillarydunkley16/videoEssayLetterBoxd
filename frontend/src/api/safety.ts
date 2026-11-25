// Report and block calls (SPEC-report-block.md). Mutations take the authPost / authDelete
// hook results like users.ts does; the list takes a token because it goes through authFetch.
import { authFetch } from "./client";
import { PaginatedResponse } from "../types/api";
import { useAuthPost } from "./authPost";
import { useAuthDelete } from "./authDelete";

export type ReportTargetType = "log" | "comment" | "user" | "list";
export type ReportReason = "spam" | "harassment" | "hate" | "sexual" | "violence" | "other";

// Mirrors Report.REASONS on the backend.
export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
    { value: "spam", label: "Spam" },
    { value: "harassment", label: "Harassment or bullying" },
    { value: "hate", label: "Hate speech" },
    { value: "sexual", label: "Sexual content" },
    { value: "violence", label: "Violence or threats" },
    { value: "other", label: "Something else" },
];

export const REPORT_DETAILS_MAX_LENGTH = 500;

export type ReportInput = {
    targetType: ReportTargetType;
    // public_id for a log or list, the numeric id for a comment or user.
    targetId: string | number;
    reason: ReportReason;
    details?: string;
};

export type ReportResult = { id: number; status: "open" | "resolved" };

export async function reportContent(input: ReportInput, authPost: ReturnType<typeof useAuthPost>): Promise<ReportResult> {
    const response = await authPost("/api/reports/", {
        target_type: input.targetType,
        target_id: String(input.targetId),
        reason: input.reason,
        details: input.details ?? "",
    });
    return response.data;
}

// What to tell the reporter when a report fails. The axios error carries the HTTP status.
export function reportErrorMessage(err: unknown): string {
    const status = (err as { response?: { status?: number } } | undefined)?.response?.status;
    if (status === 429) return "You've sent a lot of reports today. Please try again tomorrow.";
    if (status === 404) return "This is no longer available to report.";
    return "Couldn't send your report. Please try again.";
}

// Idempotent. Also removes any follows between the two users, in both directions.
export async function blockUser(userId: number, authPost: ReturnType<typeof useAuthPost>): Promise<void> {
    await authPost(`/api/users/${userId}/block/`);
}

// Idempotent. Does not restore the follows that blocking removed.
export async function unblockUser(userId: number, authDelete: ReturnType<typeof useAuthDelete>): Promise<void> {
    await authDelete(`/api/users/${userId}/block/`);
}

export type BlockedUser = {
    id: number;
    username: string;
    imageUrl: string | null;
};

export async function fetchBlockedUsers(page: number, token: string): Promise<PaginatedResponse<BlockedUser>> {
    return authFetch(`/users/blocked/?page=${page}`, {}, token);
}
