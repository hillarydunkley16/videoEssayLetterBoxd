import requests

OEMBED_URL = "https://www.youtube.com/oembed"


class OEmbedLookupError(Exception):
    """A youtube_id could not be resolved via oEmbed (invalid, deleted, or unreachable)."""


def fetch_oembed_metadata(youtube_id, timeout=5):
    video_url = f"https://www.youtube.com/watch?v={youtube_id}"
    try:
        response = requests.get(
            OEMBED_URL,
            params={"url": video_url, "format": "json"},
            timeout=timeout,
        )
    except requests.exceptions.RequestException as exc:
        raise OEmbedLookupError(f"oEmbed request failed for {youtube_id}") from exc

    if response.status_code != 200:
        raise OEmbedLookupError(f"oEmbed returned {response.status_code} for {youtube_id}")

    data = response.json()
    return {
        "title": data.get("title"),
        "channel_name": data.get("author_name"),
        "thumbnail": data.get("thumbnail_url"),
    }
