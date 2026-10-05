"use client";

import { useActiveSession } from "@/data";
import { FocusRunning } from "@/components/focus/FocusRunning";
import { FocusStart } from "@/components/focus/FocusStart";

/** Focus (§6.7): the running session, or a way to start one. Full screen, no navigation. */
export default function FocusPage() {
  const session = useActiveSession();
  return (
    <div className="fixed inset-0 z-10 flex flex-col bg-black text-text">
      <div className="mx-auto flex h-full w-full max-w-[480px] flex-col">
        {session === undefined ? null : session ? <FocusRunning key={session.id} session={session} /> : <FocusStart />}
      </div>
    </div>
  );
}
