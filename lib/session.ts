"use client";
// The flow's state lives in the browser's sessionStorage (cleared when the tab closes).
// No database, and the resume itself is never kept anywhere.
import { useSyncExternalStore } from "react";
import type { Match, Preferences, Profile } from "@/lib/schemas";

type FlowState = {
  prefs?: Preferences;
  profile?: Profile;
  matches?: Match[];
  mock?: boolean;
};

const KEY = "ktpursuit:flow";

export function loadFlow(): FlowState {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function saveFlow(patch: FlowState) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...loadFlow(), ...patch }));
  } catch {
    /* storage unavailable (private mode); flow still works within the page */
  }
}

const noop = () => () => {};
/** false during server render / first paint, true once we're in the browser. */
export function useMounted() {
  return useSyncExternalStore(noop, () => true, () => false);
}
