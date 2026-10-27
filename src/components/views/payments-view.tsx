"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { addDays, formatDate, formatDateRange, formatDateTime, todayISO } from "@/lib/dates";
import { farmerLabel } from "@/lib/farmer-label";
import { billPaidAmount, billRemainingOf, farmerAdvanceSummary, farmerPendingDue } from "@/lib/farmer-ledger";
import { useI18n } from "@/hooks/use-i18n";
import { advanceRef, billRef } from "@/lib/ref";
import { formatInr, formatQty, round2 } from "@/lib/money";
import { useDairy } from "@/hooks/use-dairy";
import { FarmerLedger } from "@/components/farmer-ledger";
import { PayTabs } from "@/components/pay-tabs";
import { AppList, AppRow, btnGhost, btnPrimary, Card, Field, confirmAction, inputClass, PageHeader, Select } from "@/components/ui";

type Tab = "bills" | "advances" | "history";

export function PaymentsView() {
  const dairy = useDairy();
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const pendingOnly = searchParams.get("status") === "open";
  const view: Tab = tabParam === "advances" || tabParam === "history" ? tabParam : "bills";

  const [fromDate, setFromDate] = useState(addDays(todayISO(), -9));
  const [toDate, setToDate] = useState(todayISO());
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [farmerId, setFarmerId] = useState(dairy.farmers[0]?.id ?? "");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState("");
  const [billFilter, setBillFilter] = useState<"all" | "open" | "paid">(pendingOnly ? "open" : "all");
  const [payAmt, setPayAmt] = useState("");
  const [payDate, setPayDate] = useState(todayISO());
  const [payNote, setPayNote] = useState("");
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

  const pendingRows = useMemo(() => {
    return dairy.farmers
      .map((farmer) => ({
        farmer,
        pending: farmerPendingDue(farmer.id, dairy.bills, dairy.entries),
      }))
      .filter((row) => row.pending > 0)
      .sort((a, b) => b.pending - a.pending);
  }, [dairy.farmers, dairy.bills, dairy.entries]);
  const pendingTotal = round2(pendingRows.reduce((sum, row) => sum + row.pending, 0));
  const farmerChoices = pendingOnly ? pendingRows.map((row) => row.farmer) : dairy.farmers;

  useEffect(() => {
    if (pendingOnly) {
      if (pendingRows.length && !pendingRows.some((row) => row.farmer.id === farmerId)) {
        setFarmerId(pendingRows[0].farmer.id);
      }
      return;
    }
    if (!farmerId && dairy.farmers[0]) setFarmerId(dairy.farmers[0].id);
    if (!adv.farmerId && dairy.farmers[0]) setAdv((prev) => ({ ...prev, farmerId: dairy.farmers[0].id }));
  }, [dairy.farmers, farmerId, adv.farmerId, pendingOnly, pendingRows]);

  const payments = dairy.payments || [];
  const farmerBills = dairy.bills.filter((row) => row.farmerId === farmerId);
  const farmerPays = payments.filter((row) => row.farmerId === farmerId);
  const paid = farmerId ? dairy.farmerPaidTotal(farmerId) : 0;
  const toPay = farmerId ? farmerPendingDue(farmerId, dairy.bills, dairy.entries) : 0;
  const giveNow = Number(payAmt) || 0;
  const afterPay = round2(Math.max(0, toPay - giveNow));
  const unbilled = useMemo(
    () => dairy.entries.filter((e) => e.farmerId === farmerId && !e.billId),
    [dairy.entries, farmerId],
  );
  const bills = dairy.bills.filter((bill) => {
    const remain = billRemainingOf(bill);
    if (pendingOnly || billFilter === "open") return remain > 0;
    if (billFilter === "paid") return remain <= 0;
    return true;
  });
  const advSummary = farmerAdvanceSummary(dairy.advances);
  const selectedFarmer = dairy.farmerById(farmerId);

  async function payFarmerNow() {
    if (!farmerId || giveNow <= 0) return;
    setBusy("pay");
    setError("");
    setMessage("");
    try {
      await dairy.addFarmerPayment({ farmerId, amount: giveNow, date: payDate, note: payNote });
      setPayAmt("");
      setPayNote("");
      setMessage(t("paymentSaved", { amt: formatInr(afterPay) }));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("dashboardClosed"));
    } finally {
      setBusy("");
    }
  }

  function fillPay(id: string, amount: number) {
    setFarmerId(id);
    setPayAmt(String(amount));
  }

  return (
    <div className="mx-auto max-w-7xl space-y-3">
      <PageHeader
        kicker={t("payHubKicker")}
        title={
          pendingOnly
            ? t("pendingPayments")
            : view === "advances"
              ? t("advanceTitle")
              : view === "history"
                ? t("farmerHistory")
                : t("farmerPayTitle")
        }
      />
      <PayTabs
        active={
          pendingOnly ? "pending" : view === "advances" ? "advance" : view === "history" ? "history" : "farmer"
        }
      />
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {message ? <p className="text-sm text-primary">{message}</p> : null}

      {view === "bills" ? (
        <>
          {pendingOnly ? (
            <Card className="p-4 sm:p-5">
              <p className="text-[11px] font-medium text-muted">{t("pendingTotal")}</p>
              <p className="mt-1 font-display text-[36px] leading-none tabular-nums text-amber-900">{formatInr(pendingTotal)}</p>
              <p className="mt-2 text-[13px] text-muted">{t("dashPendingHint", { n: pendingRows.length })}</p>
              {pendingRows.length ? (
                <ul className="mt-4 space-y-2">
                  {pendingRows.map((row) => (
                    <li key={row.farmer.id}>
                      <button
                        type="button"
                        className={`flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left ${
                          farmerId === row.farmer.id ? "bg-emerald-50" : "bg-[#f7f1e6]"
                        }`}
                        onClick={() => fillPay(row.farmer.id, row.pending)}
                      >
                        <span className="truncate font-medium">{farmerLabel(row.farmer)}</span>
                        <span className="shrink-0 font-semibold tabular-nums text-amber-900">{formatInr(row.pending)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-muted">{t("noPendingBills")}</p>
              )}
            </Card>
          ) : null}

          <Card className="p-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1.6fr)_repeat(2,minmax(7.5rem,0.7fr))] sm:items-end">
              <div className="col-span-2 sm:col-span-1">
                <Field label={t("farmer")}>
                  <Select className={inputClass} value={farmerId} onChange={(e) => setFarmerId(e.target.value)}>
                    {farmerChoices.map((f) => (
                      <option key={f.id} value={f.id}>
                        {farmerLabel(f)}
                        {pendingOnly ? ` · ${formatInr(pendingRows.find((row) => row.farmer.id === f.id)?.pending || 0)}` : ""}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <NumBox label={t("alreadyPaid")} value={formatInr(paid)} />
              <NumBox label={t("toPayFarmer")} value={formatInr(toPay)} ok={toPay === 0} />
            </div>
            {unbilled.length ? (
              <p className="mt-1.5 text-[12px] text-amber-800">
                {t("unbilledSlips")} {unbilled.length} · {formatQty(unbilled.reduce((s, e) => s + e.qty, 0))}
              </p>
            ) : null}
            <div className="mt-2 grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:items-end">
              <div className="min-w-0 sm:w-[8.5rem]">
                <Field label={t("amount")}>
                  <div className="flex items-center gap-1 rounded-xl border border-line bg-[#fbf7ef] px-2.5 py-2 focus-within:border-primary focus-within:bg-white">
                    <span className="text-sm font-semibold text-muted">₹</span>
                    <input
                      className="w-full min-w-0 bg-transparent text-sm font-semibold outline-none"
                      inputMode="decimal"
                      value={payAmt}
                      onChange={(e) => setPayAmt(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </Field>
              </div>
              <div className="min-w-0 sm:w-[10.5rem]">
                <Field label={t("paymentDate")}>
                  <input type="date" className={inputClass} value={payDate} onChange={(e) => setPayDate(e.target.value)} />
                </Field>
              </div>
              <div className="col-span-2 min-w-0 flex-1">
                <Field label={t("note")}>
                  <input className={inputClass} value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder={t("noteOptional")} />
                </Field>
              </div>
              <button
                type="button"
                className={`${btnPrimary} col-span-2 w-full sm:w-auto`}
                disabled={!farmerId || giveNow <= 0 || busy === "pay"}
                onClick={() => void payFarmerNow()}
              >
                {busy === "pay" ? t("paying") : t("payNow")}
              </button>
            </div>
            {giveNow > 0 ? (
              <p className="mt-1.5 text-[12px] text-muted">
                {t("afterPayRemain")} <span className="font-semibold">{formatInr(afterPay)}</span>
              </p>
            ) : null}
            {farmerPays.length ? (
              <ul className="mt-2 space-y-1 border-t border-line pt-2">
                {farmerPays.slice(0, 5).map((row) => {
                  const note = displayPayNote(row.note);
                  return (
                    <li key={row.id} className="flex items-center justify-between gap-3 text-[13px]">
                      <span className="min-w-0 truncate">
                        <span className="text-muted">{formatDate(row.date)}</span>
                        {note ? <span className="text-ink"> · {note}</span> : null}
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums">{formatInr(row.amount)}</span>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </Card>

          {pendingOnly ? null : (
            <>
          <Card className="p-3 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <Field label={t("from")}>
                <input type="date" className={inputClass} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </Field>
              <Field label={t("to")}>
                <input type="date" className={inputClass} value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </Field>
              <button
                type="button"
                className={`${btnPrimary} mt-5 w-full sm:w-auto`}
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
          </Card>

          <div className="chip-row">
            <button type="button" className={billFilter === "all" ? btnPrimary : btnGhost} onClick={() => setBillFilter("all")}>
              {t("filterAll")}
            </button>
            <button type="button" className={billFilter === "open" ? btnPrimary : btnGhost} onClick={() => setBillFilter("open")}>
              {t("filterUnpaid")}
            </button>
            <button type="button" className={billFilter === "paid" ? btnPrimary : btnGhost} onClick={() => setBillFilter("paid")}>
              {t("filterPaid")}
            </button>
          </div>
            </>
          )}

          <Card className="overflow-hidden p-0">
            <AppList>
              {bills.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-muted">
                  {pendingOnly ? (pendingRows.length ? `${t("unbilledSlips")} · ${t("generateBills")}` : t("noPendingBills")) : t("noBills")}
                </p>
              ) : (
                bills.map((bill) => {
                  const remain = billRemainingOf(bill);
                  const paidAmt = billPaidAmount(bill);
                  return (
                    <AppRow key={bill.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{farmerLabel(dairy.farmerById(bill.farmerId))}</p>
                          <p className="text-[11px] text-muted">{formatDateRange(bill.fromDate, bill.toDate)}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[16px] font-semibold tabular-nums">{formatInr(bill.net)}</p>
                          <p className={`text-[11px] font-semibold ${remain > 0 ? "text-amber-800" : "text-primary"}`}>
                            {remain > 0 ? `${t("remainingDue")} ${formatInr(remain)}` : t("payClearedZero")}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        {remain > 0 ? (
                          <button type="button" className={`${btnPrimary} flex-1`} onClick={() => fillPay(bill.farmerId, remain)}>
                            {t("payNow")}
                          </button>
                        ) : null}
                        <Link href={`/payments/bills/${bill.id}`} className={`${btnGhost} ${remain > 0 ? "flex-1" : "w-full"}`}>
                          {t("view")}
                        </Link>
                        {paidAmt <= 0 ? (
                          <button
                            type="button"
                            className={`${btnGhost} text-danger`}
                            onClick={() => {
                              if (!confirmAction(t("confirmDeleteBill"))) return;
                              void dairy.deleteBill(bill.id).catch((e) => setError(e instanceof Error ? e.message : t("delete")));
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        ) : null}
                      </div>
                    </AppRow>
                  );
                })
              )}
            </AppList>
            <div className="table-scroll hidden md:block">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead className="table-head text-[10px] tracking-wider text-muted uppercase">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">{t("farmer")}</th>
                    <th className="py-2.5 font-medium">{t("period")}</th>
                    <th className="py-2.5 font-medium">{t("amount")}</th>
                    <th className="py-2.5 font-medium">{t("alreadyPaid")}</th>
                    <th className="py-2.5 font-medium">{t("toPayFarmer")}</th>
                    <th className="px-4 py-2.5 font-medium text-right">{t("payNow")}</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted">
                        {pendingOnly ? t("noPendingBills") : t("noBills")}
                      </td>
                    </tr>
                  ) : (
                    bills.map((bill) => {
                      const remain = billRemainingOf(bill);
                      const paidAmt = billPaidAmount(bill);
                      return (
                        <tr key={bill.id} className="border-t border-line/70 hover:bg-[#faf6ee]">
                          <td className="px-4 py-2.5">
                            <Link href={`/payments/bills/${bill.id}`} className="hover:text-primary">
                              {farmerLabel(dairy.farmerById(bill.farmerId))}
                            </Link>
                            <p className="font-mono text-[11px] text-muted">{billRef(bill.id)}</p>
                          </td>
                          <td>{formatDateRange(bill.fromDate, bill.toDate)}</td>
                          <td className="font-semibold">{formatInr(bill.net)}</td>
                          <td>{formatInr(paidAmt)}</td>
                          <td className={remain > 0 ? "font-semibold text-amber-800" : "font-semibold text-primary"}>{formatInr(remain)}</td>
                          <td className="px-4 text-right">
                            {remain > 0 ? (
                              <button type="button" className={btnPrimary} onClick={() => fillPay(bill.farmerId, remain)}>
                                {t("payNow")}
                              </button>
                            ) : (
                              <span className="text-[11px] text-primary">{t("payClearedZero")}</span>
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
          <Card className="p-4 sm:p-5">
            <div className="mb-3 grid grid-cols-2 gap-2">
              <NumBox label={t("advanceOpenAmt")} value={formatInr(advSummary.open)} />
              <NumBox label={t("advanceCleared")} value={formatInr(advSummary.recovered)} ok />
            </div>
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
              <div className="mt-3 flex items-center gap-2 rounded-2xl border border-line bg-[#fbf7ef] px-4 py-3 focus-within:border-primary focus-within:bg-white">
                <span className="text-lg font-semibold text-muted">₹</span>
                <input
                  className="money-input w-full min-w-0 bg-transparent font-display text-[34px] leading-none outline-none"
                  inputMode="decimal"
                  value={adv.amount}
                  onChange={(e) => setAdv({ ...adv, amount: e.target.value })}
                  placeholder="0"
                />
              </div>
            </Field>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label={t("paymentDate")}>
                <input type="date" className={inputClass} value={adv.date} onChange={(e) => setAdv({ ...adv, date: e.target.value })} />
              </Field>
              <Field label={t("noteOptional")}>
                <input className={inputClass} value={adv.note} onChange={(e) => setAdv({ ...adv, note: e.target.value })} />
              </Field>
            </div>
            <button
              type="button"
              className={`${btnPrimary} mt-4 w-full sm:w-auto`}
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
          </Card>
          <Card className="overflow-hidden p-0">
            <AppList>
              {dairy.advances.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-muted">{t("noAdvance")}</p>
              ) : (
                dairy.advances.map((a) => (
                  <AppRow key={a.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{farmerLabel(dairy.farmerById(a.farmerId))}</p>
                        <p className="text-[11px] text-muted">{formatDate(a.date)}{a.note ? ` · ${a.note}` : ""}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[16px] font-semibold tabular-nums">{formatInr(a.amount)}</p>
                        <p className={`text-[11px] font-semibold ${a.recovered ? "text-primary" : "text-amber-800"}`}>
                          {a.recovered ? t("advanceCleared") : t("unpaid")}
                        </p>
                      </div>
                    </div>
                    {!a.recovered ? (
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          className={`${btnGhost} flex-1`}
                          onClick={() => {
                            setEditingId(a.id);
                            setAdv({ farmerId: a.farmerId, amount: String(a.amount), note: a.note, date: a.date });
                          }}
                        >
                          {t("edit")}
                        </button>
                        <button
                          type="button"
                          className={`${btnGhost} flex-1 text-danger`}
                          onClick={() => {
                            if (!confirmAction(t("confirmDeleteAdvance"))) return;
                            void dairy.deleteAdvance(a.id).then(() => {
                              if (editingId === a.id) setEditingId(null);
                            }).catch((e) => setError(e instanceof Error ? e.message : t("delete")));
                          }}
                        >
                          {t("delete")}
                        </button>
                      </div>
                    ) : null}
                  </AppRow>
                ))
              )}
            </AppList>
            <div className="table-scroll hidden md:block">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="table-head text-[10px] tracking-wider text-muted uppercase">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">{t("farmer")}</th>
                    <th className="py-2.5 font-medium">{t("paymentDate")}</th>
                    <th className="py-2.5 font-medium">{t("amount")}</th>
                    <th className="py-2.5 font-medium">{t("colStatus")}</th>
                    <th className="px-4 py-2.5 font-medium text-right" />
                  </tr>
                </thead>
                <tbody>
                  {dairy.advances.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted">{t("noAdvance")}</td>
                    </tr>
                  ) : (
                    dairy.advances.map((a) => (
                      <tr key={a.id} className="border-t border-line/70 hover:bg-[#faf6ee]">
                        <td className="px-4 py-2.5">
                          {farmerLabel(dairy.farmerById(a.farmerId))}
                          <p className="font-mono text-[11px] text-muted">{advanceRef(a.id)}</p>
                        </td>
                        <td>{formatDate(a.date)}</td>
                        <td className="font-semibold">{formatInr(a.amount)}</td>
                        <td>
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${a.recovered ? "bg-emerald-50 text-primary" : "bg-amber-50 text-amber-800"}`}>
                            {a.recovered ? t("advanceCleared") : t("unpaid")}
                          </span>
                        </td>
                        <td className="px-4 text-right">
                          <button
                            type="button"
                            className="mr-1 rounded-lg p-1.5 text-muted hover:bg-[#f4ead6] disabled:opacity-30"
                            disabled={a.recovered}
                            onClick={() => {
                              setEditingId(a.id);
                              setAdv({ farmerId: a.farmerId, amount: String(a.amount), note: a.note, date: a.date });
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
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : null}

      {view === "history" ? (
        <div className="space-y-4">
          <Card className="p-4 sm:p-5">
            <Field label={t("farmer")}>
              <Select className={inputClass} value={farmerId} onChange={(e) => setFarmerId(e.target.value)}>
                {dairy.farmers.map((f) => (
                  <option key={f.id} value={f.id}>
                    {farmerLabel(f)}
                  </option>
                ))}
              </Select>
            </Field>
          </Card>
          {selectedFarmer ? (
            <FarmerLedger
              farmerName={farmerLabel(selectedFarmer)}
              farmerId={selectedFarmer.id}
              entries={dairy.entries.filter((e) => e.farmerId === selectedFarmer.id)}
              advances={dairy.advances.filter((a) => a.farmerId === selectedFarmer.id)}
              bills={dairy.bills.filter((b) => b.farmerId === selectedFarmer.id)}
              payments={payments.filter((row) => row.farmerId === selectedFarmer.id)}
            />
          ) : (
            <p className="text-sm text-muted">{t("navFarmers")}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function displayPayNote(note?: string) {
  const text = (note || "").trim();
  return !text || text === "Farmer payment" ? "" : text;
}

function NumBox({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className={`rounded-xl px-2.5 py-1.5 ${ok ? "bg-emerald-50" : "bg-[#f7f1e6]"}`}>
      <p className="text-[10px] leading-none text-muted">{label}</p>
      <p className={`mt-1 font-display text-[18px] leading-none tabular-nums ${ok ? "text-primary" : ""}`}>{value}</p>
    </div>
  );
}
