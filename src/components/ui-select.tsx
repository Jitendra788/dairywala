"use client";

import {
  Children,
  isValidElement,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

const fieldClass =
  "w-full min-w-0 rounded-xl border border-line bg-[#fbf7ef] px-3 py-2.5 text-base outline-none transition-shadow focus:border-primary focus:bg-white focus:shadow-[0_0_0_3px_rgba(24,122,72,0.12)] md:py-2 md:text-sm";

type Option = { value: string; label: string; disabled?: boolean };

function readOptions(children: ReactNode): Option[] {
  const out: Option[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child) || child.type !== "option") return;
    const props = child.props as { value?: string | number; children?: ReactNode; disabled?: boolean };
    out.push({
      value: props.value == null ? "" : String(props.value),
      label:
        typeof props.children === "string" || typeof props.children === "number"
          ? String(props.children)
          : String(props.value ?? ""),
      disabled: Boolean(props.disabled),
    });
  });
  return out;
}

export function Select({
  value,
  onChange,
  children,
  className = fieldClass,
  disabled,
}: {
  value: string | number;
  onChange: (e: { target: { value: string } }) => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const options = readOptions(children);
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ top: 0, left: 0, width: 0, maxH: 240 });

  function place() {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gap = 4;
    const spaceBelow = window.innerHeight - r.bottom - 12;
    const spaceAbove = r.top - 12;
    const openUp = spaceBelow < 168 && spaceAbove > spaceBelow;
    const maxH = Math.min(280, Math.max(132, openUp ? spaceAbove : spaceBelow));
    setBox({
      top: openUp ? Math.max(8, r.top - maxH - gap) : r.bottom + gap,
      left: Math.min(r.left, window.innerWidth - r.width - 8),
      width: r.width,
      maxH,
    });
  }

  useLayoutEffect(() => {
    if (!open) return;
    place();
    const onWin = () => place();
    window.addEventListener("resize", onWin);
    window.addEventListener("scroll", onWin, true);
    return () => {
      window.removeEventListener("resize", onWin);
      window.removeEventListener("scroll", onWin, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = options.find((o) => o.value === String(value));

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        className={`${className} flex items-center justify-between gap-2 text-left`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="min-w-0 truncate">{current?.label || "Select"}</span>
        <ChevronDown size={16} className={`shrink-0 text-muted transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open
        ? createPortal(
            <div
              ref={menuRef}
              role="listbox"
              className="fixed z-[80] overflow-auto rounded-xl border border-line bg-card py-1 shadow-[0_16px_40px_rgba(18,40,30,0.18)]"
              style={{ top: box.top, left: box.left, width: Math.max(box.width, 160), maxHeight: box.maxH }}
            >
              {options.map((opt) => (
                <button
                  key={opt.value || "empty"}
                  type="button"
                  role="option"
                  disabled={opt.disabled}
                  aria-selected={opt.value === String(value)}
                  className={`flex w-full px-3 py-2.5 text-left text-sm hover:bg-[#f7f1e6] disabled:opacity-50 ${
                    opt.value === String(value) ? "bg-emerald-50 font-medium text-primary" : ""
                  }`}
                  onClick={() => {
                    onChange({ target: { value: opt.value } });
                    setOpen(false);
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
