"use client";

// Cross-section navigation that doesn't fit ordinary React prop-drilling:
// Explorer keeps every section mounted and toggles visibility with a CSS
// class rather than unmounting, so "jump to X in a different section" needs
// two separate things — a real state change in Explorer (which section is
// active) plus a way to tell an already-mounted, deeply-nested component
// what to focus once it becomes visible. This second part reuses the
// localStorage + custom DOM event pattern Timeline.tsx already established
// for its own orientation/act toggles (see ORIENTATION_STORAGE_KEY etc.,
// re-exported from here so there's one source of truth for those strings).
export const ORIENTATION_STORAGE_KEY = "birdseye-timeline-orientation";
export const ORIENTATION_CHANGE_EVENT = "birdseye-timeline-orientation-change";
export const ACT_STORAGE_KEY = "birdseye-timeline-act";
export const ACT_CHANGE_EVENT = "birdseye-timeline-act-change";

const EVENT_FOCUS_KEY = "birdseye-nav-focus-event";
const EVENT_FOCUS_CHANGE = "birdseye-nav-focus-event-change";
const TRADITION_FOCUS_KEY = "birdseye-nav-focus-tradition";
const TRADITION_FOCUS_CHANGE = "birdseye-nav-focus-tradition-change";

export interface FocusRequest { id: string; nonce: number }

function request(key: string, changeEvent: string, id: string) {
  const payload: FocusRequest = { id, nonce: Date.now() };
  window.localStorage.setItem(key, JSON.stringify(payload));
  window.dispatchEvent(new Event(changeEvent));
}

function read(key: string): FocusRequest | null {
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// Ask the timeline to scroll to and highlight a specific historical event —
// used when a tradition split's causing event is clicked from the
// Traditions tree. Forces the vertical story (the only orientation with a
// scroll-to mechanism) and the After New Testament act (every tradition
// split event lives there), then fires the focus request itself.
export function requestEventFocus(eventId: string) {
  window.localStorage.setItem(ORIENTATION_STORAGE_KEY, "vertical");
  window.dispatchEvent(new Event(ORIENTATION_CHANGE_EVENT));
  window.localStorage.setItem(ACT_STORAGE_KEY, "after-nt");
  window.dispatchEvent(new Event(ACT_CHANGE_EVENT));
  request(EVENT_FOCUS_KEY, EVENT_FOCUS_CHANGE, eventId);
}
export function subscribeEventFocus(onChange: () => void) {
  window.addEventListener(EVENT_FOCUS_CHANGE, onChange);
  return () => window.removeEventListener(EVENT_FOCUS_CHANGE, onChange);
}
export function readEventFocus(): FocusRequest | null { return read(EVENT_FOCUS_KEY); }

// Ask the Traditions tree to open on and highlight a specific tradition —
// used when a person's profile names the tradition they founded.
export function requestTraditionFocus(traditionId: string) {
  request(TRADITION_FOCUS_KEY, TRADITION_FOCUS_CHANGE, traditionId);
}
export function subscribeTraditionFocus(onChange: () => void) {
  window.addEventListener(TRADITION_FOCUS_CHANGE, onChange);
  return () => window.removeEventListener(TRADITION_FOCUS_CHANGE, onChange);
}
export function readTraditionFocus(): FocusRequest | null { return read(TRADITION_FOCUS_KEY); }
