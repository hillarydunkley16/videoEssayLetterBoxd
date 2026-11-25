# movie_csv/admin.py (or your app name)
from django.contrib import admin, messages
from django.utils import timezone

from .models import VideoEssay, Log, Comment, Collection, Report

admin.site.register(VideoEssay)
admin.site.register(Log)
admin.site.register(Comment)
admin.site.register(Collection)


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    """The moderation queue. Open reports sort first ("open" < "resolved"), newest first.
    Removing a user is not an action here: it needs the Django user and the Clerk user deleted
    (see the moderation runbook in DEPLOY.md)."""
    list_display = ("id", "status", "reason", "target_type", "reporter", "created_at", "short_snapshot")
    list_filter = ("status", "reason", "target_type")
    search_fields = ("snapshot", "details")
    ordering = ("status", "-created_at")
    readonly_fields = ("created_at", "snapshot")
    actions = ["mark_resolved", "delete_reported_content"]

    @admin.display(description="Reported")
    def short_snapshot(self, obj):
        return obj.snapshot[:80]

    @admin.action(description="Mark selected reports resolved")
    def mark_resolved(self, request, queryset):
        updated = queryset.filter(status=Report.OPEN).update(status=Report.RESOLVED, resolved_at=timezone.now())
        self.message_user(request, f"{updated} report(s) marked resolved.")

    @admin.action(description="Delete the reported log, comment or list, and mark resolved")
    def delete_reported_content(self, request, queryset):
        removed = 0
        for report in queryset.select_related("log", "comment", "collection"):
            content = report.log or report.comment or report.collection
            if content is None:
                continue  # a user report, or the content is already gone
            content.delete()  # SET_NULLs this report's FK; the snapshot stays
            Report.objects.filter(pk=report.pk).update(
                status=Report.RESOLVED,
                resolved_at=timezone.now(),
                resolution_note="Content deleted from admin",
            )
            removed += 1
        skipped = queryset.count() - removed
        self.message_user(request, f"Deleted content for {removed} report(s).")
        if skipped:
            self.message_user(
                request,
                f"{skipped} report(s) skipped: a user report, or the content was already gone.",
                level=messages.WARNING,
            )
