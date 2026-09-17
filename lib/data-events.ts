// Keep the independently loaded timeline current after a library edit.
export const DATA_CHANGED = "birdseye:library-changed";
export function notifyDataChanged() {
  window.dispatchEvent(new Event(DATA_CHANGED));
}
