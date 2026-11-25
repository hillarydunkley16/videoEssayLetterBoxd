from django.db import models
from django.contrib.auth.models import User


class Follow(models.Model):
    follower = models.ForeignKey(User, related_name='following_set', on_delete=models.CASCADE)
    followee = models.ForeignKey(User, related_name='follower_set', on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['follower', 'followee'], name='unique_follow'),
            models.CheckConstraint(condition=~models.Q(follower=models.F('followee')), name='no_self_follow'),
        ]

    def __str__(self):
        return f'{self.follower_id} follows {self.followee_id}'


class Block(models.Model):
    """`blocker` has blocked `blocked`. The effect is mutual (see blocked_user_ids): neither
    user sees the other's content. Both FKs cascade, so deleting either account removes the row."""
    blocker = models.ForeignKey(User, related_name='blocks_made', on_delete=models.CASCADE)
    blocked = models.ForeignKey(User, related_name='blocks_received', on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['blocker', 'blocked'], name='unique_block'),
            models.CheckConstraint(condition=~models.Q(blocker=models.F('blocked')), name='no_self_block'),
        ]

    def __str__(self):
        return f'{self.blocker_id} blocks {self.blocked_id}'


def blocked_user_ids(viewer):
    """Ids of every user with a block against `viewer` in either direction. The one place the
    block rule lives; empty (and no query) for an anonymous or missing viewer."""
    if viewer is None or not viewer.is_authenticated:
        return set()
    ids = set()
    for blocker_id, blocked_id in Block.objects.filter(
        models.Q(blocker=viewer) | models.Q(blocked=viewer)
    ).values_list('blocker_id', 'blocked_id'):
        ids.add(blocked_id if blocker_id == viewer.id else blocker_id)
    return ids


def exclude_blocked(queryset, viewer, field):
    """`queryset` without rows whose user (the `field` FK, e.g. "owner" or "id") has a block
    against `viewer` in either direction. Subqueries, so it stays one query. Unchanged for an
    anonymous or missing viewer."""
    if viewer is None or not viewer.is_authenticated:
        return queryset
    return queryset.exclude(
        **{f'{field}__in': Block.objects.filter(blocker=viewer).values('blocked_id')}
    ).exclude(
        **{f'{field}__in': Block.objects.filter(blocked=viewer).values('blocker_id')}
    )


class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, null = True, blank = True) 
    imageUrl = models.URLField(blank = True, null = True)
    # watchlist = models.OneToOneField('WatchList', on_delete=models.CASCADE, null=True, blank=True)
    # Delete profile when user is deleted
    # photo = models.ImageField(upload_to='profile_pics/', null=True, blank=True, default='profile_pics/default.jpg')
    # The Clerk username, copied from the session token's `username` claim (see
    # ClerkAuthentication). Deliberately not unique: Clerk enforces uniqueness, and a DB
    # constraint could turn a cross-instance collision into a login-blocking IntegrityError.
    display_username = models.CharField(max_length=150, blank=True, null=True, default=None)
    # When the server first heard "I confirm I am 16 or older" from this user (see
    # AgeConfirmation). Server time, set once, never taken from the client. Null means no
    # confirmation was received, for example an account made before the checkbox existed.
    age_confirmed_at = models.DateTimeField(blank=True, null=True, default=None)
    def __str__(self):
        return f'{self.user.username} Profile' #show how we want it to be displayed
     # Override the save method of the model
    def save(self, *args, **kwargs):
        super(Profile, self).save(*args, **kwargs)
    # class Meta:
    #     constraints = [
    #         models.UniqueConstraint(
    #             fields=["display_username"]
    #             condition=models.Q(display_username__isnull=False),
    #             name="unique_display_username_when_set"
    #         )
    #     ]

# class WatchList(models.Model): 
#     user = models.OneToOneField(User, on_delete=models.CASCADE, null = True, blank = True) 
#     essays = models.ManyToManyField(VideoEssay, blank=True)
#     name = models.CharField(max_length=100, default="My Watchlist")
#     def __str__(self):
#         return f"{self.user.username}'s Watchlist"