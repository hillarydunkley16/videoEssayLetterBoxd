from django.contrib.auth.models import User
from django.test import TestCase

from movie_csv.serializers import ProfileSerializer


class ProfileUserShapeTests(TestCase):
    def test_user_is_an_object_with_id_username_and_image(self):
        user = User.objects.create_user("user_2abcClerkId")
        user.profile.imageUrl = "https://example.com/a.png"
        user.profile.display_username = "someone"
        user.profile.save()
        data = ProfileSerializer(user.profile).data
        self.assertEqual(
            data["user"],
            {"id": user.id, "username": "someone", "imageUrl": "https://example.com/a.png"},
        )

    def test_user_without_display_username_shows_anonymous_not_the_clerk_id(self):
        user = User.objects.create_user("user_2abcClerkId")
        data = ProfileSerializer(user.profile).data
        self.assertEqual(data["user"]["username"], "Anonymous")

    def test_has_username_true_when_display_username_is_set(self):
        user = User.objects.create_user("user_2abcClerkId")
        user.profile.display_username = "someone"
        user.profile.save()
        data = ProfileSerializer(user.profile).data
        self.assertTrue(data["has_username"])

    def test_has_username_false_when_display_username_is_null(self):
        user = User.objects.create_user("user_2abcClerkId")
        data = ProfileSerializer(user.profile).data
        self.assertFalse(data["has_username"])

    def test_has_username_false_when_display_username_is_blank(self):
        user = User.objects.create_user("user_2abcClerkId")
        user.profile.display_username = ""
        user.profile.save()
        data = ProfileSerializer(user.profile).data
        self.assertFalse(data["has_username"])
