import { apiUrl } from "./basePath";

export interface CalendarConfig {
    provider: "google" | "caldav";
    enabled: boolean;
    calendarId?: string;
    label?: string;
    accessToken?: string;
    refreshToken?: string;
    apiKey?: string;
    url?: string;
    username?: string;
    password?: string;
}

export interface GoogleCalendarEntry {
    id: string;
    summary: string;
    primary?: boolean;
}

export function normalizeGoogleCalendarConfig(input: Partial<CalendarConfig> = {}): CalendarConfig {
    const calendarId = (input.calendarId ?? "primary").trim();
    const label = (input.label ?? "Google Kalender").trim();
    return {
        provider: "google",
        enabled: true,
        calendarId: calendarId || "primary",
        label: label || "Google Kalender",
        accessToken: input.accessToken?.trim() || "",
        refreshToken: input.refreshToken?.trim() || "",
    };
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

export async function startGoogleCalendarAuth(): Promise<string> {
    const res = await fetch(apiUrl("/api/calendar/oauth/start"));
    if (!res.ok) throw new Error("Google-Login konnte nicht gestartet werden");
    const payload = await res.json();
    return payload.authUrl as string;
}

export async function finishGoogleCalendarAuth(code: string): Promise<{ accessToken: string; refreshToken: string; calendars: GoogleCalendarEntry[] }> {
    const res = await fetch(apiUrl(`/api/calendar/oauth/callback?code=${encodeURIComponent(code)}`));
    if (!res.ok) throw new Error("Google-Login konnte nicht abgeschlossen werden");
    const payload = await res.json();
    return {
        accessToken: payload.accessToken as string,
        refreshToken: payload.refreshToken as string,
        calendars: (payload.calendars as GoogleCalendarEntry[]) ?? [],
    };
}
