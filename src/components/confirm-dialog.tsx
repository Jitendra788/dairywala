"use client";

import type { ReactNode } from "react";
import { btnGhost, btnPrimary } from "@/components/ui";

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = "Confirm",
  danger = false,
  busy = false,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center sm:p-4">
      <div className="max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-line bg-card p-5 shadow-[0_20px_50px_rgba(18,40,30,0.18)]">
        <h2 className="font-display text-xl">{title}</h2>
        <div className="mt-3 text-sm text-muted">{children}</div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className={btnGhost} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={danger ? "inline-flex items-center justify-center rounded-xl bg-danger px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" : btnPrimary}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Please wait…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
