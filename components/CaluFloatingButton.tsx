"use client";

import { useState } from "react";
import CaluChatPanel from "./CaluChatPanel";

export default function CaluFloatingButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close Calu" : "Open Calu"}
        className="clay-btn fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center bg-accent text-2xl text-white hover:bg-accentDeep transition-colors"
        style={{ borderRadius: "999px" }}
      >
        {open ? "×" : "🧪"}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-40 h-[28rem] w-[22rem] max-w-[calc(100vw-3rem)]">
          <CaluChatPanel compact />
        </div>
      )}
    </>
  );
}
