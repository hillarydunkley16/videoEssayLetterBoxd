from django.contrib.auth.models import User
from django.test import TestCase

from movie_csv.serializers import ProfileSerializer


class ProfileUserShapeTests(TestCase):
    def test_user_is_an_object_with_id_username_and_image(self):
        user = User.objects.create_user("someone")
        user.profile.imageUrl = "https://example.com/a.png"
        user.profile.save()
        data = ProfileSerializer(user.profile).data
        self.assertEqual(
            data["user"],
            {"id": user.id, "username": "someone", "imageUrl": "https://example.com/a.png"},
        )
