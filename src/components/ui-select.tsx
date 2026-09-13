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
import { popRoot } from "@/lib/pop-root";

const fieldClass =
  "w-full min-w-0 rounded-xl border border-line bg-[#fbf7ef] px-3 py-2.5 text-base outline-none transition-shadow focus:border-primary focus:bg-white focus:shadow-[0_0_0_3px_rgba(24,122,72,0.12)] md:py-2 md:text-sm";

type Option = { value: string; label: string; disabled?: boolean };

function textOf(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children);
  return "";
}

function readOptions(children: ReactNode): Option[] {
  const out: Option[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child) || child.type !== "option") return;
    const props = child.props as { value?: string | number; children?: ReactNode; disabled?: boolean };
    const label = textOf(props.children).replace(/\s+/g, " ").trim();
    out.push({
      value: props.value == null ? "" : String(props.value),
      label: label || "Select",
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
    const gap = 6;
    const spaceBelow = window.innerHeight - r.bottom - 16;
    const spaceAbove = r.top - 16;
    const openUp = spaceBelow < 180 && spaceAbove > spaceBelow;
    const maxH = Math.min(320, Math.max(140, openUp ? spaceAbove : spaceBelow));
    const width = Math.max(r.width, 200);
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
    setBox({
      top: openUp ? Math.max(8, r.top - maxH - gap) : r.bottom + gap,
      left,
      width,
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
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
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
            <>
              <button type="button" className="fixed inset-0 cursor-default bg-transparent" aria-label="Close" onClick={() => setOpen(false)} />
              <div
                ref={menuRef}
                role="listbox"
                className="fixed overflow-auto rounded-xl border border-line bg-card py-1 shadow-[0_20px_50px_rgba(18,40,30,0.22)]"
                style={{ top: box.top, left: box.left, width: box.width, maxHeight: box.maxH }}
              >
                {options.length === 0 ? (
                  <p className="px-3 py-2.5 text-sm text-muted">No options</p>
                ) : (
                  options.map((opt) => (
                    <button
                      key={opt.value || "empty"}
                      type="button"
                      role="option"
                      disabled={opt.disabled}
                      aria-selected={opt.value === String(value)}
                      className={`flex min-h-11 w-full px-3 py-2.5 text-left text-sm hover:bg-[#f7f1e6] disabled:opacity-50 ${
                        opt.value === String(value) ? "bg-emerald-50 font-medium text-primary" : ""
                      }`}
                      onClick={() => {
                        onChange({ target: { value: opt.value } });
                        setOpen(false);
                      }}
                    >
                      {opt.label}
                    </button>
                  ))
                )}
              </div>
            </>,
            popRoot(),
          )
        : null}
    </>
  );
}
