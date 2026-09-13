"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Banknote, Pencil, Trash2, UserRound, Users } from "lucide-react";
import { addDays, formatDate, formatDateRange, todayISO } from "@/lib/dates";
import { farmerLabel } from "@/lib/farmer-label";
import { farmerAdvanceSummary } from "@/lib/farmer-ledger";
import { useI18n } from "@/hooks/use-i18n";
import { advanceRef, billRef } from "@/lib/ref";
import { formatInr, formatQty, round2 } from "@/lib/money";
import { useDairy } from "@/hooks/use-dairy";
import { FarmerLedger } from "@/components/farmer-ledger";
import { btnGhost, btnPrimary, Card, Field, confirmAction, inputClass, PageHeader, Select } from "@/components/ui";

type Tab = "bills" | "advances" | "history";

export function PaymentsView() {
  const dairy = useDairy();
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const pendingOnly = searchParams.get("status") === "open";
  const view: "hub" | Tab =
    tabParam === "advances" || tabParam === "history" ? tabParam : tabParam === "bills" || pendingOnly ? "bills" : "hub";

  const [fromDate, setFromDate] = useState(addDays(todayISO(), -9));
  const [toDate, setToDate] = useState(todayISO());
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [farmerId, setFarmerId] = useState(dairy.farmers[0]?.id ?? "");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [adv, setAdv] = useState({
    farmerId: dairy.farmers[0]?.id ?? "",
    amount: "",
    note: "",
    date: todayISO(),
  });

  useEffect(() => {
    const farmer = searchParams.get("farmer");
    if (farmer && dairy.farmers.some((f) => f.id === farmer)) {
      setFarmerId(farmer);
      setAdv((prev) => ({ ...prev, farmerId: farmer }));
    }
  }, [searchParams, dairy.farmers]);

  useEffect(() => {
    if (!farmerId && dairy.farmers[0]) setFarmerId(dairy.farmers[0].id);
    if (!adv.farmerId && dairy.farmers[0]) setAdv((prev) => ({ ...prev, farmerId: dairy.farmers[0].id }));
  }, [dairy.farmers, farmerId, adv.farmerId]);

  const bills = dairy.bills.filter((bill) => (pendingOnly ? bill.status === "open" : true));
  const unbilled = useMemo(
    () => dairy.entries.filter((e) => !e.billId && e.date >= fromDate && e.date <= toDate),
    [dairy.entries, fromDate, toDate],
  );
  const advSummary = farmerAdvanceSummary(dairy.advances);
  const openAdvance = dairy.advances.filter((a) => !a.recovered);
  const selectedFarmer = dairy.farmerById(farmerId);

  if (view === "hub") {
    return (
      <div className="mx-auto max-w-4xl space-y-5">
        <PageHeader kicker={t("payHubKicker")} title={t("payHubTitle")} hint={t("payHubHint")} />
        <Tip>
          <p className="font-semibold text-foreground">{t("howTo")}</p>
          <ol className="mt-1.5 list-decimal space-y-1 pl-4">
            <li>{t("payStep1")}</li>
            <li>{t("payStep2")}</li>
            <li>{t("payStep3")}</li>
          </ol>
        </Tip>
        <div className="grid gap-3 md:grid-cols-3">
          <HubCard
            href="/payments?tab=bills"
            icon={<Users size={20} />}
            title={t("farmerPayCard")}
            text={t("farmerPayCardHint")}
            action={t("farmerPayOpen")}
          />
          <HubCard
            href="/customers/payments"
            icon={<UserRound size={20} />}
            title={t("customerPayCard")}
            text={t("customerPayCardHint")}
            action={t("customerPayOpen")}
          />
          <HubCard
            href="/payments?tab=advances"
            icon={<Banknote size={20} />}
            title={t("advanceCard")}
            text={t("advanceCardHint")}
            action={t("giveAdvance")}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader
        kicker={t("payHubKicker")}
        title={view === "advances" ? t("advanceTitle") : view === "history" ? t("farmerHistory") : t("farmerPayTitle")}
        hint={view === "advances" ? t("advanceHint") : view === "history" ? t("farmerPayHint") : t("farmerPayHint")}
        actions={
          <Link href="/payments" className={btnGhost}>
            {t("backPayments")}
          </Link>
        }
      />

      <div className="chip-row">
        <Link href="/payments?tab=bills" className={`${view === "bills" ? btnPrimary : btnGhost}`}>
          {t("farmerPayments")}
        </Link>
        <Link href="/customers/payments" className={btnGhost}>
          {t("customerPayments")}
        </Link>
        <Link href="/payments?tab=advances" className={`${view === "advances" ? btnPrimary : btnGhost}`}>
          {t("advances")}
        </Link>
        <Link href="/payments?tab=history" className={`${view === "history" ? btnPrimary : btnGhost}`}>
          {t("farmerHistory")}
        </Link>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {message ? <p className="text-sm text-primary">{message}</p> : null}

      {view === "bills" ? (
        <>
          <Tip>{t("farmerPayHint")}</Tip>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Mini label={t("unbilledSlips")} value={String(unbilled.length)} hint={formatQty(unbilled.reduce((s, e) => s + e.qty, 0))} />
            <Mini label={t("openBills")} value={String(dairy.bills.filter((b) => b.status === "open").length)} hint={formatInr(dairy.bills.filter((b) => b.status === "open").reduce((s, b) => s + b.net, 0))} />
            <Mini label={t("advanceOpenAmt")} value={formatInr(advSummary.open)} hint={`${advSummary.openCount}`} warn={advSummary.open > 0} />
            <Mini label={t("advanceCleared")} value={formatInr(advSummary.recovered)} hint={t("advanceCleared")} />
          </div>
          <Card className="p-5">
            <div className="grid gap-3 md:grid-cols-4">
              <Field label={t("from")}>
                <input type="date" className={inputClass} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </Field>
              <Field label={t("to")}>
                <input type="date" className={inputClass} value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </Field>
              <div className="flex flex-col justify-end text-sm text-muted">
                {t("period")} {formatDateRange(fromDate, toDate)}
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  className={`${btnPrimary} w-full`}
                  disabled={busy === "bills"}
                  onClick={() => {
                    setBusy("bills");
                    setError("");
                    void dairy
                      .generateBills(fromDate, toDate)
                      .then((created) => {
                        const cut = round2(created.reduce((s, b) => s + b.advance, 0));
                        setMessage(created.length ? t("billsMade", { n: created.length, amt: formatInr(cut) }) : t("noMilkPeriod"));
                      })
                      .catch((e) => setError(e instanceof Error ? e.message : t("dashboardClosed")))
                      .finally(() => setBusy(""));
                  }}
                >
                  {busy === "bills" ? t("generating") : t("generateBills")}
                </button>
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="divide-y divide-line/70 md:hidden">
              {bills.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted">{pendingOnly ? t("noPendingBills") : t("noBills")}</p>
              ) : (
                bills.map((bill) => {
                  const farmer = dairy.farmerById(bill.farmerId);
                  const rowBusy = busy === bill.id;
                  return (
                    <div key={bill.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link href={`/payments?tab=history&farmer=${bill.farmerId}`} className="block truncate font-medium">
                            {farmerLabel(farmer)}
                          </Link>
                          <p className="text-[11px] text-muted">{formatDateRange(bill.fromDate, bill.toDate)}</p>
                          <p className="font-mono text-[11px] text-muted">{billRef(bill.id)}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[15px] font-semibold">{formatInr(bill.net)}</p>
                          <p className="text-[11px] text-muted">{bill.status === "paid" ? t("paid") : t("unpaid")}</p>
                        </div>
                      </div>
                      <div className="mt-2 flex gap-2">
                        {bill.status === "open" ? (
                          <>
                            <button
                              type="button"
                              className={`${btnPrimary} flex-1`}
                              disabled={rowBusy}
                              onClick={() => {
                                setBusy(bill.id);
                                setError("");
                                void dairy
                                  .markBillPaid(bill.id)
                                  .catch((e) => setError(e instanceof Error ? e.message : t("dashboardClosed")))
                                  .finally(() => setBusy(""));
                              }}
                            >
                              {rowBusy ? t("paying") : t("payNow")}
                            </button>
                            <Link href={`/payments/bills/${bill.id}`} className={`${btnGhost} flex-1`}>
                              {t("view")}
                            </Link>
                          </>
                        ) : (
                          <Link href={`/payments/bills/${bill.id}`} className={`${btnGhost} w-full`}>
                            {t("view")}
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="table-scroll hidden md:block">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="table-head text-[10px] tracking-wider text-muted uppercase">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">{t("reference")}</th>
                    <th className="py-2.5 font-medium">{t("farmer")}</th>
                    <th className="py-2.5 font-medium">{t("period")}</th>
                    <th className="py-2.5 font-medium">{t("amount")}</th>
                    <th className="py-2.5 font-medium">{t("advanceCleared")}</th>
                    <th className="py-2.5 font-medium">{t("colStatus")}</th>
                    <th className="px-4 py-2.5 font-medium text-right">{t("payNow")}</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-muted">
                        {pendingOnly ? t("noPendingBills") : t("noBills")}
                      </td>
                    </tr>
                  ) : (
                    bills.map((bill) => {
                      const farmer = dairy.farmerById(bill.farmerId);
                      const rowBusy = busy === bill.id;
                      return (
                        <tr key={bill.id} className="border-t border-line/70 hover:bg-[#faf6ee]">
                          <td className="px-4 py-2.5 font-mono text-xs">
                            <Link href={`/payments/bills/${bill.id}`} className="hover:text-primary">
                              {billRef(bill.id)}
                            </Link>
                          </td>
                          <td className="py-2.5">
                            <Link href={`/payments?tab=history&farmer=${bill.farmerId}`} className="hover:text-primary">
                              {farmerLabel(farmer)}
                            </Link>
                          </td>
                          <td>{formatDateRange(bill.fromDate, bill.toDate)}</td>
                          <td className="font-semibold">{formatInr(bill.net)}</td>
                          <td className={bill.advance ? "font-semibold text-amber-800" : "text-muted"}>
                            {bill.advance ? `−${formatInr(bill.advance)}` : "—"}
                          </td>
                          <td className="capitalize">{bill.status === "paid" ? `${t("paid")} ${formatDate(bill.paidAt ?? "")}` : t("unpaid")}</td>
                          <td className="px-4 text-right">
                            {bill.status === "open" ? (
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  className={btnPrimary}
                                  disabled={rowBusy}
                                  onClick={() => {
                                    setBusy(bill.id);
                                    setError("");
                                    void dairy
                                      .markBillPaid(bill.id)
                                      .catch((e) => setError(e instanceof Error ? e.message : t("dashboardClosed")))
                                      .finally(() => setBusy(""));
                                  }}
                                >
                                  {rowBusy ? t("paying") : t("payNow")}
                                </button>
                                <button
                                  type="button"
                                  className="rounded-lg p-2 text-muted hover:bg-red-50 hover:text-danger"
                                  onClick={() => {
                                    if (!confirmAction(t("confirmDeleteBill"))) return;
                                    void dairy.deleteBill(bill.id).catch((e) => setError(e instanceof Error ? e.message : t("delete")));
                                  }}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            ) : (
                              <Link href={`/payments?tab=history&farmer=${bill.farmerId}`} className="text-[11px] text-primary">
                                {t("history")}
                              </Link>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : null}

      {view === "advances" ? (
        <>
          <Tip>{t("advanceHint")}</Tip>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
            <Mini label={t("advanceCard")} value={formatInr(advSummary.given)} hint={`${advSummary.count}`} />
            <Mini label={t("advanceOpenAmt")} value={formatInr(advSummary.open)} hint={`${openAdvance.length}`} warn={advSummary.open > 0} />
            <Mini label={t("advanceCleared")} value={formatInr(advSummary.recovered)} hint={t("advanceCleared")} />
          </div>
          <Card className="p-5">
            <h2 className="mb-3 font-display text-lg">{editingId ? t("edit") : t("giveAdvance")}</h2>
            <div className="grid gap-3 md:grid-cols-[1.2fr_1fr_auto]">
              <Field label={t("farmer")}>
                <Select className={inputClass} value={adv.farmerId} onChange={(e) => setAdv({ ...adv, farmerId: e.target.value })}>
                  {dairy.farmers.map((f) => (
                    <option key={f.id} value={f.id}>
                      {farmerLabel(f)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("amount")}>
                <input className={inputClass} inputMode="decimal" value={adv.amount} onChange={(e) => setAdv({ ...adv, amount: e.target.value })} />
              </Field>
              <div className="flex items-end">
                <button
                  type="button"
                  className={`${btnPrimary} w-full min-w-36`}
                  disabled={!adv.farmerId || !Number(adv.amount) || busy === "adv"}
                  onClick={() => {
                    setBusy("adv");
                    setError("");
                    const work = editingId
                      ? dairy.updateAdvance(editingId, {
                          farmerId: adv.farmerId,
                          amount: Number(adv.amount),
                          note: adv.note,
                          date: adv.date,
                        })
                      : dairy.addAdvance({
                          farmerId: adv.farmerId,
                          amount: Number(adv.amount),
                          note: adv.note || "Advance",
                          date: adv.date,
                        });
                    void work
                      .then(() => {
                        setEditingId(null);
                        setFarmerId(adv.farmerId);
                        setAdv({ ...adv, amount: "", note: "" });
                        setMessage(editingId ? t("advanceUpdated") : t("advanceSaved"));
                      })
                      .catch((e) => setError(e instanceof Error ? e.message : t("save")))
                      .finally(() => setBusy(""));
                  }}
                >
                  {busy === "adv" ? t("saving") : editingId ? t("save") : t("giveAdvance")}
                </button>
              </div>
            </div>
            <button type="button" className="mt-2 text-[12px] font-semibold text-primary" onClick={() => setShowMore((v) => !v)}>
              {showMore ? t("lessOptions") : t("moreOptions")}
            </button>
            {showMore ? (
              <div className="mt-2 grid gap-3 md:grid-cols-2">
                <Field label={t("noteOptional")}>
                  <input className={inputClass} value={adv.note} onChange={(e) => setAdv({ ...adv, note: e.target.value })} />
                </Field>
                <Field label={t("paymentDate")}>
                  <input type="date" className={inputClass} value={adv.date} onChange={(e) => setAdv({ ...adv, date: e.target.value })} />
                </Field>
              </div>
            ) : null}
          </Card>
          <Card className="overflow-hidden p-0">
            <div className="divide-y divide-line/70 md:hidden">
              {dairy.advances.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted">{t("noAdvance")}</p>
              ) : (
                dairy.advances.map((a) => {
                  const farmer = dairy.farmerById(a.farmerId);
                  return (
                    <div key={a.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{farmerLabel(farmer)}</p>
                          <p className="text-[11px] text-muted">{formatDate(a.date)} · {a.note || "—"}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[15px] font-semibold">{formatInr(a.amount)}</p>
                          <p className="text-[11px] text-muted">{a.recovered ? t("advanceCleared") : t("unpaid")}</p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="table-scroll hidden md:block">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead className="table-head text-[10px] tracking-wider text-muted uppercase">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">{t("reference")}</th>
                    <th className="py-2.5 font-medium">{t("paymentDate")}</th>
                    <th className="py-2.5 font-medium">{t("farmer")}</th>
                    <th className="py-2.5 font-medium">{t("noteOptional")}</th>
                    <th className="py-2.5 font-medium">{t("amount")}</th>
                    <th className="py-2.5 font-medium">{t("colStatus")}</th>
                    <th className="px-4 py-2.5 font-medium text-right" />
                  </tr>
                </thead>
                <tbody>
                  {dairy.advances.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-muted">
                        {t("noAdvance")}
                      </td>
                    </tr>
                  ) : (
                    dairy.advances.map((a) => {
                      const farmer = dairy.farmerById(a.farmerId);
                      return (
                        <tr key={a.id} className="border-t border-line/70 hover:bg-[#faf6ee]">
                          <td className="px-4 py-2.5 font-mono text-xs">{advanceRef(a.id)}</td>
                          <td>{formatDate(a.date)}</td>
                          <td>
                            <Link href={`/payments?tab=history&farmer=${a.farmerId}`} className="hover:text-primary">
                              {farmerLabel(farmer)}
                            </Link>
                          </td>
                          <td>{a.note}</td>
                          <td className="font-semibold">{formatInr(a.amount)}</td>
                          <td>
                            {a.recovered ? (
                              <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                {t("advanceCleared")}
                                {a.billId ? ` · ${billRef(a.billId)}` : ""}
                              </span>
                            ) : (
                              <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                                {t("unpaid")}
                              </span>
                            )}
                          </td>
                          <td className="px-4 text-right">
                            <button
                              type="button"
                              className="mr-1 rounded-lg p-1.5 text-muted hover:bg-[#f4ead6] hover:text-primary disabled:opacity-30"
                              disabled={a.recovered}
                              onClick={() => {
                                setEditingId(a.id);
                                setShowMore(true);
                                setAdv({
                                  farmerId: a.farmerId,
                                  amount: String(a.amount),
                                  note: a.note,
                                  date: a.date,
                                });
                              }}
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              className="rounded-lg p-1.5 text-muted hover:bg-red-50 hover:text-danger disabled:opacity-30"
                              disabled={a.recovered}
                              onClick={() => {
                                if (!confirmAction(t("confirmDeleteAdvance"))) return;
                                void dairy.deleteAdvance(a.id).then(() => {
                                  if (editingId === a.id) setEditingId(null);
                                }).catch((e) => setError(e instanceof Error ? e.message : t("delete")));
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : null}

      {view === "history" ? (
        <Card className="space-y-4 p-4 sm:p-5">
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <Field label={t("farmer")}>
              <Select className={inputClass} value={farmerId} onChange={(e) => setFarmerId(e.target.value)}>
                {dairy.farmers.map((f) => (
                  <option key={f.id} value={f.id}>
                    {farmerLabel(f)}
                  </option>
                ))}
              </Select>
            </Field>
            {selectedFarmer ? (
              <Link href={`/farmers/${selectedFarmer.id}`} className="text-sm font-semibold text-primary">
                {t("openFarmer")} →
              </Link>
            ) : null}
          </div>
          {selectedFarmer ? (
            <FarmerLedger
              farmerName={farmerLabel(selectedFarmer)}
              entries={dairy.entries.filter((e) => e.farmerId === selectedFarmer.id)}
              advances={dairy.advances.filter((a) => a.farmerId === selectedFarmer.id)}
              bills={dairy.bills.filter((b) => b.farmerId === selectedFarmer.id)}
            />
          ) : (
            <p className="text-sm text-muted">{t("navFarmers")}</p>
          )}
        </Card>
      ) : null}
    </div>
  );
}

function HubCard({
  href,
  icon,
  title,
  text,
  action,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  text: string;
  action: string;
}) {
  return (
    <Link
      href={href}
      prefetch
      className="flex min-h-[168px] flex-col rounded-2xl border border-line bg-card p-4 shadow-[0_8px_30px_rgba(22,48,36,0.05)] transition-transform duration-75 active:scale-[0.99] hover:border-primary/40"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-primary">{icon}</span>
      <p className="mt-3 font-display text-[22px] leading-none">{title}</p>
      <p className="mt-2 flex-1 text-[13px] text-muted">{text}</p>
      <span className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-primary">
        {action} <ArrowRight size={14} />
      </span>
    </Link>
  );
}

function Tip({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-[13px] text-foreground/80">{children}</div>;
}

function Mini({ label, value, hint, warn }: { label: string; value: string; hint: string; warn?: boolean }) {
  return (
    <Card className={`p-3 ${warn ? "border-amber-200 bg-amber-50" : ""}`}>
      <p className="text-[11px] font-medium text-muted">{label}</p>
      <p className="mt-1 font-display text-[22px] leading-none">{value}</p>
      <p className="mt-1 text-[11px] text-muted">{hint}</p>
    </Card>
  );
}
