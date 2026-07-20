import pytest

from app.calendar import build_google_events_url, normalize_calendar_config


def test_normalize_calendar_config_defaults_to_google() -> None:
    config = normalize_calendar_config({"calendarId": "primary", "label": "Familie"})
    assert config["provider"] == "google"
    assert config["enabled"] is True
    assert config["calendarId"] == "primary"


def test_build_google_events_url_contains_apikey() -> None:
    url = build_google_events_url("primary", "abc123")
    assert "https://www.googleapis.com/calendar/v3/calendars/primary/events" in url
    assert "key=abc123" in url
