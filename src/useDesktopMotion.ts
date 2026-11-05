import { useEffect, useRef } from "react";

const easing = "cubic-bezier(.16,1,.3,1)";
export function useDesktopMotion() {
  const elements = useRef(new Map<string, HTMLElement>());
  const animations = useRef(new Map<string, Animation>());
  const exiting = useRef(new Set<string>());
  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const cancel = (id: string) => {
    animations.current.get(id)?.cancel();
    animations.current.delete(id);
    exiting.current.delete(id);
  };
  const reveal = (id: string) => {
    const element = elements.current.get(id);
    if (!element || reduced()) return;
    cancel(id);
    const animation = element.animate([
      { opacity: 0, transform: "translateY(16px) scale(.96)" },
      { opacity: 1, transform: "translateY(0) scale(1)" },
    ], { duration: 280, easing });
    animations.current.set(id, animation);
    animation.finished.then(() => { if (animations.current.get(id) === animation) animations.current.delete(id); }).catch(() => {});
  };
  const register = (id: string, element: HTMLElement | null) => {
    // React callback refs detach on rerenders. Keep identity until a replacement arrives.
    if (!element || elements.current.get(id) === element) return;
    elements.current.set(id, element);
    reveal(id);
  };
  const dismiss = async (id: string, kind: "close" | "minimize") => {
    if (exiting.current.has(id)) return false;
    cancel(id);
    exiting.current.add(id);
    const element = elements.current.get(id);
    if (element && !reduced()) {
      const animation = element.animate([
        { opacity: 1, transform: "translateY(0) scale(1)" },
        { opacity: 0, transform: kind === "minimize" ? "translateY(65px) scale(.85)" : "translateY(8px) scale(.96)" },
      ], { duration: kind === "minimize" ? 180 : 140, easing: "cubic-bezier(.4,0,1,1)", fill: "forwards" });
      animations.current.set(id, animation);
      try { await animation.finished; } catch { return false; }
      if (animations.current.get(id) !== animation) return false;
      animations.current.delete(id);
      // Hide is committed before the next paint; don't retain a filled animation on restored apps.
      animation.cancel();
    }
    exiting.current.delete(id);
    if (kind === "close") elements.current.delete(id);
    return true;
  };
  useEffect(() => {
    const running = animations.current;
    const nodes = elements.current;
    return () => { running.forEach(animation => animation.cancel()); running.clear(); nodes.clear(); };
  }, []);
  return { register, reveal, dismiss, cancel };
}
