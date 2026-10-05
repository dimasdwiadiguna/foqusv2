"use client";

/**
 * The shared celebration helper (§5.19): confetti for an action done, a won day, and the full-screen
 * moments (goal achieved, streak milestones). With reduce-motion on, a short fade instead. Never
 * blocks input: the canvas ignores pointers.
 */
const COLORS = ["#FFB020", "#3DDC97", "#5B8DEF", "#B07CFF", "#FF7AA2", "#4DD0E1"];

export type CelebrationKind = "action" | "day" | "moment";

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export async function celebrate(kind: CelebrationKind, origin?: Element | null): Promise<void> {
  if (typeof window === "undefined") return;
  if (prefersReducedMotion()) {
    fade(kind === "action" ? 0.18 : 0.35);
    return;
  }
  const { default: confetti } = await import("canvas-confetti");
  const base = { colors: COLORS, disableForReducedMotion: true, zIndex: 60 };
  if (kind === "action") {
    const r = origin?.getBoundingClientRect();
    const x = r ? (r.left + Math.min(r.width, 80) / 2) / window.innerWidth : 0.5;
    const y = r ? (r.top + r.height / 2) / window.innerHeight : 0.6;
    await confetti({ ...base, particleCount: 50, spread: 65, startVelocity: 28, ticks: 120, scalar: 0.8, origin: { x, y } });
    return;
  }
  if (kind === "day") {
    // Day won: a shower from the top of the screen.
    await confetti({ ...base, particleCount: 90, spread: 120, startVelocity: 35, gravity: 0.9, ticks: 160, origin: { x: 0.5, y: 0.1 } });
    return;
  }
  // A full-screen moment: a burst from both sides, about 1.2 s.
  const end = Date.now() + 1200;
  const frame = () => {
    confetti({ ...base, particleCount: 6, angle: 60, spread: 70, origin: { x: 0, y: 0.7 } });
    confetti({ ...base, particleCount: 6, angle: 120, spread: 70, origin: { x: 1, y: 0.7 } });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  confetti({ ...base, particleCount: 120, spread: 100, origin: { x: 0.5, y: 0.45 } });
  frame();
}

/** Reduce-motion fallback: a brief accent glow that fades out. Uses the Web Animations API. */
function fade(strength: number) {
  const el = document.createElement("div");
  el.setAttribute("aria-hidden", "true");
  el.style.cssText = `position:fixed;inset:0;z-index:60;pointer-events:none;background:radial-gradient(circle at 50% 55%, rgba(255,176,32,${strength}), transparent 70%);opacity:0`;
  document.body.appendChild(el);
  const anim = el.animate([{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 0 }], { duration: 700, easing: "ease-out" });
  anim.onfinish = () => el.remove();
}
