"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, UserRound } from "lucide-react";
import { fetchAuthRecord, login } from "@/lib/auth";
import { btnPrimary, Card, Field, inputClass } from "@/components/ui";

export function LoginScreen() {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin");
  const [remember, setRemember] = useState(true);
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [isDefault, setIsDefault] = useState(true);

  useEffect(() => {
    void fetchAuthRecord().then((auth) => setIsDefault(auth.isDefault !== false));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(username, password, remember);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login nahi hua");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative z-10 h-dvh overflow-y-auto bg-background">
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-4 py-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-10">
        <div className="mb-6 text-center sm:mb-8">
          <img
            src="/dairy-logo.png"
            alt="Tony Dairy"
            className="mx-auto h-16 w-16 rounded-3xl object-contain shadow-[0_10px_30px_rgba(24,122,72,0.35)] sm:h-[72px] sm:w-[72px]"
          />
          <h1 className="mt-3 font-display text-[28px] leading-none sm:mt-4 sm:text-3xl">Tony Dairy</h1>
          <p className="mt-2 text-[13px] text-muted sm:text-sm">Collection desk lock — login ke baad hi data dikhega.</p>
        </div>

        <Card className="p-4 sm:p-5">
          <form onSubmit={onSubmit} className="space-y-3">
            <Field label="Username">
              <div className="relative">
                <UserRound size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
                <input
                  className={`${inputClass} pl-9`}
                  autoComplete="username"
                  inputMode="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </Field>
            <Field label="Password">
              <div className="relative">
                <Lock size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
                <input
                  className={`${inputClass} pr-12 pl-9`}
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute top-1/2 right-1.5 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-muted"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? "Hide password" : "Show password"}
                >
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>
            <label className="flex min-h-11 items-center gap-2 text-[13px] text-muted sm:min-h-0 sm:text-sm">
              <input type="checkbox" className="h-4 w-4 accent-primary" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              Is device par logged in rakho
            </label>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <button type="submit" className={`${btnPrimary} min-h-12 w-full py-3`} disabled={busy || !username || !password}>
              {busy ? "Checking…" : "Login"}
            </button>
          </form>
          {isDefault ? (
            <p className="mt-4 rounded-xl bg-[#f7f1e6] px-3 py-2 text-center text-[12px] leading-relaxed text-muted">
              Pehli baar: username <b className="text-foreground">admin</b> · password <b className="text-foreground">admin</b>
              <span className="mt-1 block">Settings se password change kar lena.</span>
            </p>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
