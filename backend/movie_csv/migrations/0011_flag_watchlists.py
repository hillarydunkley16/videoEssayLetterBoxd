"""Flag each owner's watchlist (`is_watchlist=True`).

Until now the watchlist was found by its name, "<username>'s Watchlist" (username being the
Clerk id), and the backend never set `is_watchlist`. Non-destructive: nothing is renamed or
deleted. If an owner somehow has several such rows, only the lowest id is flagged and the rest
are left alone, so the one-watchlist-per-owner constraint in 0012 can always be applied.
"""
from django.db import migrations


def _legacy_name(owner):
    return f"{owner.username}'s Watchlist"


def flag_watchlists(apps, schema_editor):
    Collection = apps.get_model("movie_csv", "Collection")
    owners_with_watchlist = set(
        Collection.objects.filter(is_watchlist=True).values_list("owner_id", flat=True)
    )
    candidates = (
        Collection.objects.filter(name__endswith="'s Watchlist", is_watchlist=False)
        .select_related("owner")
        .order_by("id")
    )
    for collection in candidates:
        if collection.owner_id in owners_with_watchlist:
            continue
        if collection.name != _legacy_name(collection.owner):
            continue
        Collection.objects.filter(pk=collection.pk).update(is_watchlist=True)
        owners_with_watchlist.add(collection.owner_id)


def unflag_watchlists(apps, schema_editor):
    """Reverse: unflag rows still carrying the legacy name (the only ones this migration flags)."""
    Collection = apps.get_model("movie_csv", "Collection")
    flagged = Collection.objects.filter(is_watchlist=True, name__endswith="'s Watchlist").select_related("owner")
    for collection in flagged:
        if collection.name == _legacy_name(collection.owner):
            Collection.objects.filter(pk=collection.pk).update(is_watchlist=False)


class Migration(migrations.Migration):

    dependencies = [
        ("movie_csv", "0010_collection_description"),
    ]

    operations = [
        migrations.RunPython(flag_watchlists, unflag_watchlists),
    ]
