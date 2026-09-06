"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Settings2, UserRound } from "lucide-react";
import { logout } from "@/lib/auth";
import { useAuth } from "@/hooks/use-auth";
import { useDairy } from "@/hooks/use-dairy";

export function UserMenu() {
  const { username } = useAuth();
  const dairy = useDairy();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const letters = (username || "TD").slice(0, 2).toUpperCase();

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="flex items-center gap-2 rounded-full"
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
      >
        <span className="hidden max-w-28 truncate text-[13px] font-medium lg:block">
          {username || dairy.settings.dairyName}
        </span>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-dark text-[11px] font-bold text-white">
          {letters}
        </span>
      </button>
      {open ? (
        <div className="absolute top-full right-0 z-[60] mt-2 w-[min(16rem,calc(100vw-1.5rem))] rounded-2xl border border-line bg-card p-2 shadow-[0_16px_40px_rgba(18,40,30,0.16)]">
          <div className="flex items-center gap-2 rounded-xl bg-[#f7f1e6] px-3 py-2">
            <UserRound size={16} className="shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{username}</p>
              <p className="truncate text-[11px] text-muted">{dairy.settings.dairyName}</p>
            </div>
          </div>
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="mt-1 flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-[#f7f1e6]"
          >
            <Settings2 size={15} /> Settings / password
          </Link>
          <button
            type="button"
            className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-danger hover:bg-red-50"
            onClick={() => {
              logout();
              setOpen(false);
              router.replace("/login");
            }}
          >
            <LogOut size={15} /> Logout
          </button>
        </div>
      ) : null}
    </div>
  );
}
