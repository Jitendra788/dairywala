export function CowIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M7 4.5c.8 0 1.4.4 1.8 1h6.4c.4-.6 1-.1 1.8-1 1.2 0 2 .8 2 1.8 0 .6-.3 1.1-.7 1.4.6.6 1 1.4 1.2 2.3H19v2h-1.1c-.2 2.2-1.8 4-3.9 4.6V20h-4v-3.4c-2.1-.6-3.7-2.4-3.9-4.6H5v-2h.2c.2-.9.6-1.7 1.2-2.3-.4-.3-.7-.8-.7-1.4 0-1 .8-1.8 2-1.8Z" />
    </svg>
  );
}

export function BuffaloIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M3.2 8.2c1.4-1.6 3.2-2.4 4.6-1.4.3.2.6.5.8.8h6.8c.2-.3.5-.6.8-.8 1.4-1 3.2-.2 4.6 1.4.3.4.2.8-.2 1-.8.4-1.5.4-2.1.2v1.6H19v1.8h-1.2c-.3 2.1-1.9 3.8-3.8 4.4V20h-4v-3.4c-1.9-.6-3.5-2.3-3.8-4.4H5V10h1.5V8.4c-.6.2-1.3.2-2.1-.2-.4-.2-.5-.6-.2-1Z" />
    </svg>
  );
}

export function LogoMark() {
  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#3b82f6] text-white shadow-sm">
      <CowIcon className="h-6 w-6" />
    </span>
  );
}

export function MilkCans() {
  return (
    <div className="pointer-events-none mt-4 flex justify-center gap-6 opacity-90">
      <Can label="BUFFALO" tone="#7c5c3b" />
      <Can label="COW" tone="#3b82f6" />
    </div>
  );
}

function Can({ label, tone }: { label: string; tone: string }) {
  return (
    <div className="flex w-16 flex-col items-center">
      <div className="h-3 w-10 rounded-t-md bg-slate-300" />
      <div
        className="flex h-20 w-14 items-end justify-center rounded-b-lg border border-slate-200 bg-gradient-to-b from-slate-100 to-slate-300 pb-2 shadow-inner"
      >
        <span
          className="rounded px-1 py-0.5 text-[8px] font-bold text-white"
          style={{ background: tone }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}
