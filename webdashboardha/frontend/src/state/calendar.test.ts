import { describe, expect, it } from "vitest";
import { buildGoogleCalendarUrl, normalizeGoogleCalendarConfig } from "./calendar";

describe("calendar config helpers", () => {
    it("normalisiert eine Google-Kalenderkonfiguration", () => {
        const config = normalizeGoogleCalendarConfig({
            calendarId: "primary",
            label: "Familie",
            apiKey: "abc123",
        });

        expect(config.provider).toBe("google");
        expect(config.calendarId).toBe("primary");
        expect(config.label).toBe("Familie");
        expect(config.enabled).toBe(true);
    });

    it("baut eine Google Calendar API URL mit API-Key", () => {
        const url = buildGoogleCalendarUrl("primary", "abc123");
        expect(url).toContain("https://www.googleapis.com/calendar/v3/calendars/primary/events");
        expect(url).toContain("key=abc123");
    });
});
