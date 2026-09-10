"use client";

import { useEffect, useRef, useState } from "react";
import { Droplets, ImagePlus, Trash2 } from "lucide-react";
import { DEFAULT_DAIRY_LOGO, isProfileReady, readImageAsLogo } from "@/lib/profile";
import { useDairy } from "@/hooks/use-dairy";
import { btnGhost, btnPrimary, Field, inputClass } from "@/components/ui";
import type { Settings } from "@/lib/types";

export function DairyLogo({
  settings,
  size = 40,
  className = "",
}: {
  settings: Pick<Settings, "logo" | "dairyName">;
  size?: number;
  className?: string;
}) {
  const src = settings.logo || DEFAULT_DAIRY_LOGO;
  if (src) {
    return (
      <img
        src={src}
        alt={settings.dairyName || "Dairy logo"}
        width={size}
        height={size}
        className={`shrink-0 rounded-2xl object-contain ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-2xl bg-primary text-white ${className}`}
      style={{ width: size, height: size }}
    >
      <Droplets size={Math.round(size * 0.45)} />
    </span>
  );
}

export function DairyLetterhead({
  settings,
  kicker = "Milk collection slip",
}: {
  settings: Settings;
  kicker?: string;
}) {
  return (
    <div className="text-center">
      <div className="flex justify-center">
        <DairyLogo settings={settings} size={72} className="shadow-sm" />
      </div>
      <p className="mt-3 text-[10px] tracking-[0.18em] text-muted uppercase">{kicker}</p>
      <h1 className="mt-1 font-display text-2xl leading-tight">{settings.dairyName || "Dairy name"}</h1>
      {settings.centerName ? <p className="mt-1 text-sm text-muted">{settings.centerName}</p> : null}
      {settings.phone ? <p className="text-xs text-muted">{settings.phone}</p> : null}
      {settings.address ? <p className="text-xs text-muted">{settings.address}</p> : null}
    </div>
  );
}

export function ProfileForm({
  onSaved,
  submitLabel = "Save dairy profile",
}: {
  onSaved?: () => void;
  submitLabel?: string;
}) {
  const dairy = useDairy();
  const s = dairy.settings;
  const fileRef = useRef<HTMLInputElement>(null);
  const [dairyName, setDairyName] = useState(s.dairyName);
  const [centerName, setCenterName] = useState(s.centerName);
  const [phone, setPhone] = useState(s.phone);
  const [address, setAddress] = useState(s.address);
  const [logo, setLogo] = useState(s.logo);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDairyName(s.dairyName);
    setCenterName(s.centerName);
    setPhone(s.phone);
    setAddress(s.address);
    setLogo(s.logo);
  }, [s.dairyName, s.centerName, s.phone, s.address, s.logo]);

  async function onLogo(file?: File) {
    if (!file) return;
    setError("");
    setSaved("");
    setBusy(true);
    try {
      setLogo(await readImageAsLogo(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Logo nahi chala");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function save() {
    setError("");
    setSaved("");
    if (!dairyName.trim()) {
      setError("Pehle dairy name daalo.");
      return;
    }
    dairy.updateSettings({
      dairyName: dairyName.trim(),
      centerName: centerName.trim(),
      phone: phone.trim(),
      address: address.trim(),
      logo,
      profileComplete: true,
    });
    setSaved("Profile save ho gaya. Slip aur bill isi se chhapenge.");
    onSaved?.();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <DairyLogo settings={{ logo, dairyName }} size={72} className="border border-line bg-white" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-muted">Dairy logo</p>
          <p className="mt-0.5 text-[12px] text-muted">Slip, bill aur sidebar pe yahi logo aayega.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => void onLogo(e.target.files?.[0])}
            />
            <button type="button" className={btnGhost} disabled={busy} onClick={() => fileRef.current?.click()}>
              <ImagePlus size={15} />
              {logo ? "Change logo" : "Add logo"}
            </button>
            {logo ? (
              <button type="button" className={btnGhost} onClick={() => setLogo("")}>
                <Trash2 size={15} />
                Remove
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <Field label="Dairy name">
        <input
          className={inputClass}
          value={dairyName}
          onChange={(e) => setDairyName(e.target.value)}
          placeholder="Jaise — Sharma Dairy"
        />
      </Field>
      <Field label="Collection centre">
        <input
          className={inputClass}
          value={centerName}
          onChange={(e) => setCenterName(e.target.value)}
          placeholder="Centre / village"
        />
      </Field>
      <Field label="Phone">
        <input
          className={inputClass}
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Mobile"
        />
      </Field>
      <Field label="Address">
        <input
          className={inputClass}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="City, state"
        />
      </Field>

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {saved ? <p className="text-sm font-medium text-primary">{saved}</p> : null}

      <button type="button" className={`${btnPrimary} w-full sm:w-auto`} disabled={busy} onClick={save}>
        {submitLabel}
      </button>
      {isProfileReady(s) ? (
        <p className="text-[12px] text-muted">Abhi live: {s.dairyName}{s.centerName ? ` · ${s.centerName}` : ""}</p>
      ) : null}
    </div>
  );
}
