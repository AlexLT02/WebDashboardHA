import { describe, expect, it } from "vitest";
import { normalizeGoogleCalendarConfig } from "./calendar";

describe("calendar config helpers", () => {
    it("normalisiert eine Google-Kalenderkonfiguration", () => {
        const config = normalizeGoogleCalendarConfig({
            calendarId: "primary",
            label: "Familie",
            accessToken: "abc123",
        });

        expect(config.provider).toBe("google");
        expect(config.calendarId).toBe("primary");
        expect(config.label).toBe("Familie");
        expect(config.enabled).toBe(true);
        expect(config.accessToken).toBe("abc123");
    });
});
