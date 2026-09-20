from django.db import migrations


def restore_m2ms_from_follows(apps, schema_editor):
    """Reverse of the drop: refill both sides of the legacy M2Ms from Follow rows.

    Listed before the RemoveFields, so on reverse it runs after they have re-added the
    fields. Going forward it does nothing; Follow already holds every relationship.
    """
    Profile = apps.get_model('users', 'Profile')
    Follow = apps.get_model('users', 'Follow')
    for follow in Follow.objects.all():
        Profile.objects.get_or_create(user_id=follow.follower_id)[0].following.add(follow.followee_id)
        Profile.objects.get_or_create(user_id=follow.followee_id)[0].followers.add(follow.follower_id)


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0010_copy_follows'),
    ]

    operations = [
        migrations.RunPython(migrations.RunPython.noop, restore_m2ms_from_follows),
        migrations.RemoveField(
            model_name='profile',
            name='followers',
        ),
        migrations.RemoveField(
            model_name='profile',
            name='following',
        ),
    ]
