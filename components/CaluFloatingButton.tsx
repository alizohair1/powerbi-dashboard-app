"use client";

import { useState } from "react";
import Image from "next/image";
import CaluChatPanel from "./CaluChatPanel";

export default function CaluFloatingButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close Calu" : "Open Calu"}
        className="clay-btn fixed bottom-6 right-6 z-40 flex h-16 w-16 items-center justify-center bg-white hover:bg-claySurface transition-colors overflow-hidden"
        style={{ borderRadius: "999px" }}
      >
        {open ? (
          <span className="text-2xl text-ink">×</span>
        ) : (
          <Image
            src="/calu.png"
            alt="Calu"
            width={64}
            height={64}
            className="h-full w-full object-cover p-1.5"
          />
        )}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-40 h-[28rem] w-[22rem] max-w-[calc(100vw-3rem)]">
          <CaluChatPanel compact />
        </div>
      )}
    </>
  );
}
