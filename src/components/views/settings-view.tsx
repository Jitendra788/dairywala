"use client";

import { useEffect, useState } from "react";
import { changePassword, changeUsername, getAuthRecord } from "@/lib/auth";
import { useAuth } from "@/hooks/use-auth";
import { useDairy } from "@/hooks/use-dairy";
import { btnGhost, btnPrimary, Card, Field, inputClass, PageHeader } from "@/components/ui";

export function SettingsView() {
  const dairy = useDairy();
  const { username } = useAuth();
  const s = dairy.settings;
  const [user, setUser] = useState(username);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  useEffect(() => {
    if (username) setUser(username);
    setIsDefault(Boolean(getAuthRecord()?.isDefault));
  }, [username]);

  useEffect(() => {
    const id = window.location.hash.replace("#", "");
    if (!id) return;
    window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }, []);

  async function saveAccount() {
    setMsg("");
    setErr("");
    try {
      if (user.trim() && user.trim() !== username) {
        await changeUsername(current, user);
      }
      if (next.trim()) {
        await changePassword(current, next);
      }
      if (!next.trim() && user.trim() === username) {
        setErr("Username ya naya password daalo.");
        return;
      }
      setCurrent("");
      setNext("");
      setIsDefault(Boolean(getAuthRecord()?.isDefault));
      setMsg("Account update ho gaya.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Update nahi hua");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        kicker="सेटिंग"
        title="Dairy settings"
        hint="Centre name slips aur bills par chhapega. Data is browser mein save hota hai — Hamari jaisa offline desk."
      />

      <Card id="profile" className="space-y-3 p-5">
        <Field label="Dairy name">
          <input
            className={inputClass}
            value={s.dairyName}
            onChange={(e) => dairy.updateSettings({ dairyName: e.target.value })}
          />
        </Field>
        <Field label="Collection centre">
          <input
            className={inputClass}
            value={s.centerName}
            onChange={(e) => dairy.updateSettings({ centerName: e.target.value })}
          />
        </Field>
        <Field label="Phone">
          <input
            className={inputClass}
            value={s.phone}
            onChange={(e) => dairy.updateSettings({ phone: e.target.value })}
          />
        </Field>
        <Field label="Address">
          <input
            className={inputClass}
            value={s.address}
            onChange={(e) => dairy.updateSettings({ address: e.target.value })}
          />
        </Field>
      </Card>

      <Card id="account" className="space-y-3 p-4 sm:p-5">
        <h2 className="font-display text-xl">Users & staff</h2>
        <p className="text-sm text-muted">
          {isDefault ? "Abhi default admin / admin chal raha hai. Password change karo." : "Username ya password yahan se badlo."}
        </p>
        <Field label="Username">
          <input className={inputClass} value={user} onChange={(e) => setUser(e.target.value)} />
        </Field>
        <Field label="Current password">
          <input className={inputClass} type="password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </Field>
        <Field label="New password">
          <input className={inputClass} type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="Optional" />
        </Field>
        {err ? <p className="text-sm text-danger">{err}</p> : null}
        {msg ? <p className="text-sm font-medium text-primary">{msg}</p> : null}
        <button type="button" className={`${btnPrimary} w-full sm:w-auto`} onClick={() => void saveAccount()}>
          Update account
        </button>
      </Card>

      <Card id="data" className="p-5">
        <h2 className="font-display text-xl">Backup & demo data</h2>
        <p className="mt-1 text-sm text-muted">
          Collection data is saved in this browser. Reset restores seed farmers and recent slips.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            className={btnGhost}
            onClick={() => {
              if (confirm("Saara local data reset ho jayega. Continue?")) dairy.resetDemo();
            }}
          >
            Reset demo dairy
          </button>
          <a href="/plan" className={btnPrimary}>
            Module roadmap
          </a>
        </div>
      </Card>
    </div>
  );
}
