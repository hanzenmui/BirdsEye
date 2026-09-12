"use client";

import { useSyncExternalStore } from "react";
import { TimelineVertical } from "./TimelineVertical";
import { TimelineHorizontal } from "./TimelineHorizontal";
import { TIMELINE_ACTS, getAct, type TimelineActId } from "@/lib/timeline-acts";

interface Props {
  onSelectPerson: (id: string) => void;
  active?: boolean;
}

type Orientation = "vertical" | "horizontal";

const STORAGE_KEY = "birdseye-timeline-orientation";
const CHANGE_EVENT = "birdseye-timeline-orientation-change";
const ACT_STORAGE_KEY = "birdseye-timeline-act";
const ACT_CHANGE_EVENT = "birdseye-timeline-act-change";

function readOrientation(): Orientation {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  return saved === "horizontal" ? "horizontal" : "vertical";
}

function subscribeToOrientation(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function readActId(): TimelineActId {
  const saved = window.localStorage.getItem(ACT_STORAGE_KEY);
  return TIMELINE_ACTS.some(a => a.id === saved) ? (saved as TimelineActId) : "everything";
}

function subscribeToAct(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(ACT_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(ACT_CHANGE_EVENT, onChange);
  };
}

export function Timeline({ onSelectPerson, active }: Props) {
  const orientation = useSyncExternalStore(subscribeToOrientation, readOrientation, () => "vertical");
  const actId = useSyncExternalStore(subscribeToAct, readActId, (): TimelineActId => "everything");
  const act = getAct(actId);

  const choose = (next: Orientation) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };

  const chooseAct = (next: TimelineActId) => {
    window.localStorage.setItem(ACT_STORAGE_KEY, next);
    window.dispatchEvent(new Event(ACT_CHANGE_EVENT));
  };

  return (
    <div className="tlv-orient-wrap">
      <div className="tlv-toolbar-row">
        <div className="tlv-orient-toggle" role="group" aria-label="Timeline layout">
          <button
            type="button"
            className={orientation === "vertical" ? "active" : ""}
            aria-pressed={orientation === "vertical"}
            aria-label="Vertical story"
            onClick={() => choose("vertical")}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 3v18M8.5 6.5 12 3l3.5 3.5M8.5 17.5 12 21l3.5-3.5" /></svg>
            <span><strong>Vertical story</strong><small>Read from top to bottom</small></span>
          </button>
          <button
            type="button"
            className={orientation === "horizontal" ? "active" : ""}
            aria-pressed={orientation === "horizontal"}
            aria-label="Horizontal chart"
            onClick={() => choose("horizontal")}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 12h18M6.5 8.5 3 12l3.5 3.5M17.5 8.5 21 12l-3.5 3.5" /></svg>
            <span><strong>Horizontal chart</strong><small>Compare who overlapped</small></span>
          </button>
        </div>

        <div className="tlv-act-toggle" role="group" aria-label="Which stretch of the story to show">
          {TIMELINE_ACTS.map(a => (
            <button
              key={a.id}
              type="button"
              className={actId === a.id ? "active" : ""}
              aria-pressed={actId === a.id}
              onClick={() => chooseAct(a.id)}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {orientation === "vertical" ? (
        <TimelineVertical onSelectPerson={onSelectPerson} active={active} act={act} />
      ) : (
        <TimelineHorizontal onSelectPerson={onSelectPerson} act={act} />
      )}
    </div>
  );
}
