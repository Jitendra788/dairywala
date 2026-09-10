"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { formatDate } from "@/lib/dates";
import { formatInr, formatQty } from "@/lib/money";
import { useDairy } from "@/hooks/use-dairy";
import { btnGhost, btnPrimary, Card } from "@/components/ui";
import { DairyLetterhead, ProfileForm } from "@/components/dairy-brand";

export function SlipView() {
  const { id } = useParams<{ id: string }>();
  const dairy = useDairy();
  const [editProfile, setEditProfile] = useState(false);
  const entry = dairy.entries.find((e) => e.id === id);
  const farmer = entry ? dairy.farmerById(entry.farmerId) : undefined;

  if (!entry || !farmer) {
    return (
      <Card className="mx-auto max-w-lg p-8 text-center">
        <p>Slip nahi mili.</p>
        <Link href="/collection" className="mt-3 inline-block text-sm text-primary">
          Back to collection
        </Link>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="flex flex-wrap gap-2 print:hidden">
        <button type="button" className={btnPrimary} onClick={() => window.print()}>
          Print slip
        </button>
        <button type="button" className={btnGhost} onClick={() => setEditProfile((v) => !v)}>
          {editProfile ? "Close edit" : "Edit logo / name"}
        </button>
        <Link href="/collection" className="self-center text-sm text-primary">
          Back to desk
        </Link>
      </div>

      {editProfile ? (
        <Card className="space-y-3 p-4 print:hidden sm:p-5">
          <h2 className="font-display text-lg">Dairy profile</h2>
          <p className="text-sm text-muted">Logo aur name yahan se badlo — slip turant update hogi.</p>
          <ProfileForm onSaved={() => setEditProfile(false)} />
        </Card>
      ) : null}

      <Card className="print-slip p-6 text-center">
        <DairyLetterhead settings={dairy.settings} />
        <div className="my-4 border-t border-dashed border-line" />
        <Row label="Date" value={`${formatDate(entry.date)} · ${entry.shift}`} />
        <Row label="Farmer" value={`${farmer.code} · ${farmer.name}`} />
        <Row label="Milk" value={entry.milkType === "cow" ? "Cow / गाय" : "Buffalo / भैंस"} />
        <Row label="Quantity" value={formatQty(entry.qty)} />
        <Row label="FAT / SNF / CLR" value={`${entry.fat} / ${entry.snf} / ${entry.clr}`} />
        <Row label="Rate" value={formatInr(entry.rate)} />
        <div className="my-3 border-t border-dashed border-line" />
        <Row label="Amount" value={formatInr(entry.amount)} strong />
        <Row label="Balance" value={formatInr(dairy.farmerBalance(farmer.id))} />
        <p className="mt-6 text-[11px] text-muted">{dairy.settings.dairyName} · Thank you / धन्यवाद</p>
      </Card>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex justify-between py-1 text-sm">
      <span className="text-muted">{label}</span>
      <span className={strong ? "text-base font-semibold" : ""}>{value}</span>
    </div>
  );
}
