from django.db import DatabaseError, connection
from django.http import JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_http_methods


@never_cache
@require_http_methods(["GET", "HEAD"])
def health(request):
    """Liveness + database check for uptime monitors and Render's health check.

    Runs a trivial query so the response reflects real database reachability,
    and so a periodic ping counts as activity for a free-tier Supabase project.
    Deliberately reveals nothing beyond ok/unavailable.
    """
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except DatabaseError:
        return JsonResponse({"status": "unavailable"}, status=503)
    return JsonResponse({"status": "ok"})
