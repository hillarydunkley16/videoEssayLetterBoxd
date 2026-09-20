import logging

from django.db import migrations

logger = logging.getLogger(__name__)


def copy_follows(apps, schema_editor):
    """Seed Follow from the legacy Profile.following M2M.

    FollowUser wrote both sides (my Profile.following, their Profile.followers), so
    `following` is the source of truth. A pair present only in `followers` is drift:
    it is reported and not copied, so nothing is invented from half a relationship.
    """
    Profile = apps.get_model('users', 'Profile')
    Follow = apps.get_model('users', 'Follow')

    followed_by = set()  # (follower_id, followee_id) pairs seen on the `following` side
    for profile in Profile.objects.exclude(user__isnull=True):
        for followee_id in profile.following.values_list('id', flat=True):
            if followee_id == profile.user_id:
                continue  # legacy self-follow; the new model forbids it
            Follow.objects.get_or_create(follower_id=profile.user_id, followee_id=followee_id)
            followed_by.add((profile.user_id, followee_id))

    for profile in Profile.objects.exclude(user__isnull=True).select_related('user'):
        for follower in profile.followers.all():
            if follower.id == profile.user_id or (follower.id, profile.user_id) in followed_by:
                continue
            logger.warning(
                "Follow drift: %s is in %s's followers but does not list them as following; not copied",
                follower.username, profile.user.username,
            )


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0009_create_follow'),
    ]

    operations = [
        migrations.RunPython(copy_follows, migrations.RunPython.noop),
    ]
