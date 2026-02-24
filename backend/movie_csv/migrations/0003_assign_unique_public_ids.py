import uuid
from django.db import migrations

def assign_uuids(apps, schema_editor):
    Log = apps.get_model("movie_csv", "Log")
    for log in Log.objects.all():
        log.public_id = uuid.uuid4()
        log.save(update_fields=["public_id"])

class Migration(migrations.Migration):

    dependencies = [
        ("movie_csv", "0002_alter_videoessay_options_log_public_id_alter_log_id"),  # your previous migration
    ]
    
    operations = [
        migrations.RunPython(assign_uuids, migrations.RunPython.noop),
    ]