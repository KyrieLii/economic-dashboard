import { t } from "./i18n";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";

/** Source notes remain available to mouse, keyboard and touch without taking up a row. */
export function InfoTip({ label, text }: { label: string; text: string }) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const cancelClose = () => {
    if (timer.current) clearTimeout(timer.current);
  };
  const show = () => {
    cancelClose();
    setOpen(true);
  };
  const hide = () => {
    cancelClose();
    timer.current = setTimeout(() => {
      if (document.activeElement !== trigger.current) setOpen(false);
    }, 120);
  };
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  useLayoutEffect(() => {
    if (!open || !trigger.current || !bubble.current) return;
    const anchor = trigger.current.getBoundingClientRect();
    const box = bubble.current.getBoundingClientRect();
    setPosition({
      left: Math.max(
        12,
        Math.min(anchor.right - box.width, window.innerWidth - box.width - 12),
      ),
      top:
        anchor.bottom + box.height + 8 < window.innerHeight
          ? anchor.bottom + 8
          : Math.max(12, anchor.top - box.height - 8),
    });
  }, [open, text]);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    };
    const outside = (event: PointerEvent) => {
      if (
        !trigger.current?.contains(event.target as Node) &&
        !bubble.current?.contains(event.target as Node)
      )
        close();
    };
    document.addEventListener("keydown", escape);
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("keydown", escape);
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="icon-button info-trigger"
        aria-label={t(label)}
        aria-describedby={open ? id : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={(event) => {
          event.stopPropagation();
          show();
        }}
      >
        <Info size={14} aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <div
            ref={bubble}
            id={id}
            role="tooltip"
            className="info-tooltip"
            style={position}
            onMouseEnter={show}
            onMouseLeave={hide}
          >
            {t(text)}
          </div>,
          trigger.current?.closest("dialog") || document.body,
        )}
    </>
  );
}
