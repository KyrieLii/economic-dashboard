import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { flushSync } from "react-dom";

export type BoardDrag = { kind: "card" | "group"; id: string };
// Pointer-based sorting keeps the complete visual with the pointer on mouse and touch.
export function useBoardDrag(
  onMove: (drag: BoardDrag, x: number, y: number) => void,
  onCancel: () => void,
) {
  const [active, setActive] = useState<BoardDrag | null>(null);
  const cleanup = useRef<(() => void) | null>(null);
  const moveRef = useRef(onMove);
  moveRef.current = onMove;
  useEffect(() => () => cleanup.current?.(), []);
  function start(event: ReactPointerEvent, drag: BoardDrag) {
    if (event.button !== 0 || cleanup.current) return;
    const handle = event.currentTarget as HTMLElement;
    const source = handle.closest<HTMLElement>(
      drag.kind === "card" ? "[data-card]" : "[data-group]",
    )!;
    const origin = { x: event.clientX, y: event.clientY };
    let x = origin.x,
      y = origin.y,
      lastX = x,
      lastY = y;
    let clone: HTMLElement | null = null;
    let frame = 0;
    let offsetX = 0,
      offsetY = 0;
    const rollback = onCancel;
    const preventClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const clean = () => {
      cancelAnimationFrame(frame);
      clone?.remove();
      document.body.classList.remove("board-dragging");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", key);
      window.removeEventListener("blur", cancel);
      cleanup.current = null;
      setActive(null);
      if (clone) {
        window.addEventListener("click", preventClick, {
          capture: true,
          once: true,
        });
        setTimeout(
          () => window.removeEventListener("click", preventClick, true),
          0,
        );
      }
    };
    const reorder = () => {
      const selector =
        drag.kind === "card"
          ? ".market-groups [data-card]"
          : ".market-groups [data-group]";
      const nodes = [...document.querySelectorAll<HTMLElement>(selector)];
      for (const node of nodes) node.getAnimations().forEach((a) => a.cancel());
      const before = new Map(
        nodes.map((node) => [node, node.getBoundingClientRect()]),
      );
      flushSync(() => moveRef.current(drag, x, y));
      if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
        for (const node of nodes) {
          const old = before.get(node)!;
          const next = node.getBoundingClientRect();
          const dx = old.left - next.left,
            dy = old.top - next.top;
          if ((dx || dy) && node.isConnected)
            node.animate(
              [
                { transform: `translate(${dx}px, ${dy}px)` },
                { transform: "translate(0, 0)" },
              ],
              { duration: 160, easing: "cubic-bezier(.16,1,.3,1)" },
            );
        }
      }
    };
    const tick = () => {
      if (!clone) return;
      clone.style.transform = `translate(${x - offsetX}px, ${y - offsetY}px)`;
      const edge = 64;
      const delta =
        y < edge
          ? -Math.ceil((edge - y) / 5)
          : y > innerHeight - edge
            ? Math.ceil((y - innerHeight + edge) / 5)
            : 0;
      if (delta) {
        window.scrollBy(0, delta);
        reorder();
      }
      frame = requestAnimationFrame(tick);
    };
    const move = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (!clone && Math.hypot(x - origin.x, y - origin.y) < 6) return;
      e.preventDefault();
      if (!clone) {
        const rect = source.getBoundingClientRect();
        offsetX = origin.x - rect.left;
        offsetY = origin.y - rect.top;
        clone = source.cloneNode(true) as HTMLElement;
        clone.classList.add("board-drag-overlay");
        clone.setAttribute("aria-hidden", "true");
        clone.inert = true;
        clone.removeAttribute("id");
        clone
          .querySelectorAll("[id]")
          .forEach((node) => node.removeAttribute("id"));
        Object.assign(clone.style, {
          width: `${rect.width}px`,
          height: `${rect.height}px`,
        });
        document.querySelector(".card-dashboard")!.appendChild(clone);
        document.body.classList.add("board-dragging");
        flushSync(() => setActive(drag));
        tick();
      }
      if (Math.hypot(x - lastX, y - lastY) >= 8) {
        reorder();
        lastX = x;
        lastY = y;
      }
    };
    const finish = () => clean();
    const cancel = () => {
      if (clone) rollback();
      clean();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cancel();
      }
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", key);
    window.addEventListener("blur", cancel);
    cleanup.current = clean;
  }
  return { active, start };
}
