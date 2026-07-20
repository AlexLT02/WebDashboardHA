from pathlib import Path
import sys

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.calendar import (
    build_google_events_url,
    build_google_oauth_completion_page,
    normalize_calendar_config,
)


def test_normalize_calendar_config_defaults_to_google() -> None:
    config = normalize_calendar_config({"calendarId": "primary", "label": "Familie"})
    assert config["provider"] == "google"
    assert config["enabled"] is True
    assert config["calendarId"] == "primary"


def test_build_google_events_url_contains_apikey() -> None:
    url = build_google_events_url("primary", "abc123")
    assert "https://www.googleapis.com/calendar/v3/calendars/primary/events" in url
    assert "access_token=abc123" in url


def test_build_google_oauth_completion_page_posts_result_to_opener() -> None:
    html = build_google_oauth_completion_page(
        access_token="abc123",
        refresh_token="def456",
        calendars=[{"id": "primary", "summary": "Primär"}],
    )
    assert "google-calendar-auth" in html
    assert "window.opener" in html
    assert "abc123" in html
