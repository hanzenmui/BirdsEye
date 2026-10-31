"use client";
import { useRef, useState } from "react";

// All user dismissal paths share this guard. Successful saves still call the
// original onClose directly, so confirmed work never needs to be discarded.
export function useDraftClose(dirty: boolean, saving: boolean, onClose: () => void) {
  const [confirming, setConfirming] = useState(false);
  const previousFocus = useRef<HTMLElement | null>(null);

  const requestClose = () => {
    if (saving) return;
    if (!dirty) { onClose(); return; }
    if (!confirming) previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setConfirming(true);
  };
  const keepEditing = () => {
    setConfirming(false);
    previousFocus.current?.focus();
  };
  const discard = () => { if (!saving) onClose(); };

  return { confirming, requestClose, keepEditing, discard };
}
