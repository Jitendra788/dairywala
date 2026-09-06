"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type ToastKind = "ok" | "err";
type Toast = { id: string; kind: ToastKind; text: string };

type ToastContextValue = {
  push: (text: string, kind?: ToastKind) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const push = useCallback((text: string, kind: ToastKind = "ok") => {
    const id = crypto.randomUUID();
    setItems((prev) => [...prev, { id, kind, text }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }, 3200);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-50 flex w-[min(calc(100vw-1.5rem),360px)] flex-col gap-2 sm:right-4">
        {items.map((item) => (
          <div
            key={item.id}
            className={`rounded-2xl px-4 py-3 text-sm font-medium text-white shadow-[0_12px_30px_rgba(18,40,30,0.18)] ${
              item.kind === "ok" ? "bg-primary" : "bg-danger"
            }`}
          >
            {item.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
