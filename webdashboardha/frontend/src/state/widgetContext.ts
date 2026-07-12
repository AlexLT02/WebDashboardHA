import { createContext, useContext } from "react";

/** Aktualisiert options eines Widgets (Icon, Alias, …). */
export type UpdateWidgetOptions = (widgetId: string, patch: Record<string, unknown>) => void;

export const WidgetUpdateContext = createContext<UpdateWidgetOptions>(() => {});

export function useUpdateWidget(): UpdateWidgetOptions {
  return useContext(WidgetUpdateContext);
}
