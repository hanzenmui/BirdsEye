"use client";

import { useEffect, useState } from "react";
import { TimelineVertical } from "./TimelineVertical";
import { TimelineHorizontal } from "./TimelineHorizontal";

interface Props {
  onSelectPerson: (id: string) => void;
  active?: boolean;
}

type Orientation = "vertical" | "horizontal";

const STORAGE_KEY = "birdseye-timeline-orientation";

export function Timeline({ onSelectPerson, active }: Props) {
  const [orientation, setOrientation] = useState<Orientation>("vertical");

  // Read the saved preference after mount rather than in useState's
  // initializer — localStorage isn't available during SSR, and guessing
  // wrong here would flash the other layout in right after hydration.
  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "vertical" || saved === "horizontal") setOrientation(saved);
  }, []);

  const choose = (next: Orientation) => {
    setOrientation(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  };

  return (
    <div className="tlv-orient-wrap">
      <div className="tlv-orient-toggle" role="group" aria-label="Timeline layout">
        <button
          type="button"
          className={orientation === "vertical" ? "active" : ""}
          onClick={() => choose("vertical")}
        >
          Vertical story
        </button>
        <button
          type="button"
          className={orientation === "horizontal" ? "active" : ""}
          onClick={() => choose("horizontal")}
        >
          Horizontal chart
        </button>
      </div>
      {orientation === "vertical" ? (
        <TimelineVertical onSelectPerson={onSelectPerson} active={active} />
      ) : (
        <TimelineHorizontal onSelectPerson={onSelectPerson} />
      )}
    </div>
  );
}
