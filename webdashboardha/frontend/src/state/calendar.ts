export interface CalendarConfig {
    provider: "google" | "caldav";
    enabled: boolean;
    calendarId?: string;
    label?: string;
    apiKey?: string;
    url?: string;
    username?: string;
    password?: string;
}

export function normalizeGoogleCalendarConfig(input: Partial<CalendarConfig> = {}): CalendarConfig {
    const calendarId = (input.calendarId ?? "primary").trim();
    const label = (input.label ?? "Google Kalender").trim();
    return {
        provider: "google",
        enabled: true,
        calendarId: calendarId || "primary",
        label: label || "Google Kalender",
        apiKey: input.apiKey?.trim() || "",
    };
}

export function buildGoogleCalendarUrl(calendarId: string, apiKey: string): string {
    const encodedCalendar = encodeURIComponent(calendarId || "primary");
    const encodedKey = encodeURIComponent(apiKey || "");
    return `https://www.googleapis.com/calendar/v3/calendars/${encodedCalendar}/events?key=${encodedKey}`;
}

export function getStoredCalendarConfig(): CalendarConfig | null {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem("webdashboardha.calendar");
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        return normalizeGoogleCalendarConfig(parsed);
    } catch {
        return null;
    }
}

export function saveCalendarConfig(config: CalendarConfig): CalendarConfig {
    const normalized = normalizeGoogleCalendarConfig(config);
    if (typeof window !== "undefined") {
        window.localStorage.setItem("webdashboardha.calendar", JSON.stringify(normalized));
    }
    return normalized;
}
