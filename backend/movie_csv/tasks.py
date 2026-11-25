import logging

import requests
from celery import shared_task

logger = logging.getLogger(__name__)


class SearchProviderError(Exception):
    """Raised when SerpAPI can't be reached or returns an error. Distinct from
    a timeout so the task's retry policy can treat them differently."""


@shared_task(bind=True, max_retries=2, default_retry_delay=2)
def run_youtube_search(self, params):
    """Calls SerpAPI's YouTube search and returns the parsed JSON response.

    Runs eagerly (synchronously, no worker) when CELERY_TASK_ALWAYS_EAGER is
    on, i.e. whenever REDIS_URL isn't configured — see config/settings.py.
    Retries transient failures only with a real broker: `self.retry()` in
    eager mode doesn't resubmit (there's no worker to resubmit to), it just
    raises `Retry` immediately, so retrying there would only add noise.
    """
    try:
        response = requests.get("https://serpapi.com/search", params=params, timeout=10)
    except (requests.exceptions.Timeout, requests.exceptions.ConnectionError) as exc:
        if not self.request.is_eager and self.request.retries < self.max_retries:
            raise self.retry(exc=exc)
        raise
    except requests.exceptions.RequestException:
        logger.warning("SerpAPI unreachable")
        raise SearchProviderError("search provider unreachable")

    if response.status_code >= 400:
        logger.warning("SerpAPI returned %s: %s", response.status_code, response.text[:300])
        raise SearchProviderError(f"search provider error ({response.status_code})")

    return response.json()
