import { CustomerError, jsonError } from "@/lib/customers/errors";
import { strField } from "@/lib/customers/http";
import {
  adminVerifyUser,
  changeSuperAdminPassword,
  listPlatformUsers,
  platformStats,
  setUserStatus,
} from "@/lib/platform/service";
import {
  analyticsRange,
  assignPlan,
  controlDashboard,
  createBackup,
  deleteAnyDairy,
  deleteStaff,
  editDairy,
  findDairyRecord,
  ensurePlatformControl,
  getSettings,
  impersonatePayload,
  listAudit,
  listBackups,
  listNotices,
  listPayments,
  listPermissions,
  listPlans,
  listStaff,
  listSubscriptions,
  listTickets,
  markNotice,
  platformHealth,
  savePermission,
  saveSettings,
  saveStaff,
  saveTicket,
  setDeskStatus,
  setTicketStatus,
  syncNotices,
  writeAudit,
} from "@/lib/platform/control";

export const runtime = "nodejs";

type Session = { username?: string; role?: string; impersonating?: boolean };

function parseCookie(request: Request, name: string): Session | null {
  const header = request.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key !== name) continue;
    try {
      return JSON.parse(decodeURIComponent(rest.join("="))) as Session;
    } catch {
      return null;
    }
  }
  return null;
}

function requireAdmin(request: Request): Session {
  const session = parseCookie(request, "td_session");
  if (session?.role === "platform_admin" && !session.impersonating) return session;
  if (session?.role === "dairy_owner" || session?.impersonating) {
    throw new CustomerError("Sirf super admin dekh sakta hai", 403);
  }
  if (!session && request.headers.get("x-auth-role") === "platform_admin") {
    return { username: "admin", role: "platform_admin" };
  }
  throw new CustomerError("Sirf super admin dekh sakta hai", 403);
}

function requireAdminOrResume(request: Request): Session {
  try {
    return requireAdmin(request);
  } catch {
    const resume = parseCookie(request, "td_admin_resume");
    if (resume?.role === "platform_admin") return { ...resume, impersonating: true };
    throw new CustomerError("Sirf super admin dekh sakta hai", 403);
  }
}

function actorOf(session: Session) {
  return session.username || "admin";
}

export async function GET(request: Request) {
  try {
    requireAdmin(request);
    await ensurePlatformControl();
    const url = new URL(request.url);
    const view = url.searchParams.get("view") || "";
    if (view === "dashboard") return Response.json(await controlDashboard());
    if (view === "dairies") {
      return Response.json({ users: await listPlatformUsers() });
    }
    if (view === "users") {
      return Response.json({
        dairies: await listPlatformUsers(),
        staff: await listStaff(),
        permissions: await listPermissions(),
      });
    }
    if (view === "subscriptions") {
      return Response.json({
        plans: await listPlans(),
        subscriptions: await listSubscriptions(),
        payments: await listPayments(),
      });
    }
    if (view === "analytics") {
      const from = url.searchParams.get("from") || "";
      const to = url.searchParams.get("to") || "";
      return Response.json(await analyticsRange(from, to));
    }
    if (view === "tickets") return Response.json({ tickets: await listTickets() });
    if (view === "notifications") {
      await syncNotices();
      return Response.json({ notices: await listNotices() });
    }
    if (view === "audit") {
      return Response.json({
        logs: await listAudit({
          dairy: url.searchParams.get("dairy") || "",
          actor: url.searchParams.get("actor") || "",
          action: url.searchParams.get("action") || "",
          module: url.searchParams.get("module") || "",
          from: url.searchParams.get("from") || "",
          to: url.searchParams.get("to") || "",
        }),
      });
    }
    if (view === "backups") return Response.json({ backups: await listBackups(), health: await platformHealth() });
    if (view === "health") return Response.json(await platformHealth());
    if (view === "settings") return Response.json({ settings: await getSettings() });
    return Response.json({ stats: await platformStats(), users: await listPlatformUsers() });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const op = strField(body, "op");
    if (op === "audit") {
      const session = requireAdminOrResume(request);
      await writeAudit({
        actor: actorOf(session),
        dairyId: strField(body, "dairyId"),
        dairyName: strField(body, "dairyName"),
        module: strField(body, "module") || "desk",
        action: strField(body, "action") || "update",
        oldValue: strField(body, "oldValue"),
        newValue: strField(body, "newValue"),
      });
      return Response.json({ ok: true });
    }
    const session = requireAdmin(request);
    const actor = actorOf(session);
    await ensurePlatformControl();
    const id = strField(body, "id");

    if (op === "verify" || op === "activate") {
      const user = await findDairyRecord(id);
      if (!user) throw new CustomerError("Dairy nahi mili", 404);
      if (user.source === "desk") return Response.json(await setDeskStatus(id, "active", actor));
      const result = user.status === "pending" ? await adminVerifyUser(id) : await setUserStatus(id, "active");
      await writeAudit({ actor, dairyId: user.dairyId, dairyName: user.dairyName, module: "dairies", action: "activate", newValue: id });
      return Response.json(result);
    }
    if (op === "suspend" || op === "block") {
      const user = await findDairyRecord(id);
      if (!user) throw new CustomerError("Dairy nahi mili", 404);
      if (user.source === "desk") return Response.json(await setDeskStatus(id, "blocked", actor));
      const result = await setUserStatus(id, "blocked");
      await writeAudit({ actor, dairyId: user.dairyId, dairyName: user.dairyName, module: "dairies", action: "suspend", newValue: id });
      return Response.json(result);
    }
    if (op === "cancel") {
      const user = await findDairyRecord(id);
      if (!user) throw new CustomerError("Dairy nahi mili", 404);
      if (user.source === "desk") return Response.json(await setDeskStatus(id, "cancelled", actor));
      const result = await setUserStatus(id, "cancelled");
      await writeAudit({ actor, dairyId: user.dairyId, dairyName: user.dairyName, module: "dairies", action: "cancel", newValue: id });
      return Response.json(result);
    }
    if (op === "restore" || op === "unblock") {
      const user = await findDairyRecord(id);
      if (!user) throw new CustomerError("Dairy nahi mili", 404);
      if (user.source === "desk") return Response.json(await setDeskStatus(id, "active", actor));
      const result = await setUserStatus(id, "active");
      await writeAudit({ actor, dairyId: user.dairyId, dairyName: user.dairyName, module: "dairies", action: "restore", newValue: id });
      return Response.json(result);
    }
    if (op === "delete") return Response.json(await deleteAnyDairy(id, actor));
    if (op === "edit") {
      return Response.json(
        await editDairy(
          id,
          {
            dairyName: strField(body, "dairyName"),
            name: strField(body, "name"),
            phone: strField(body, "phone"),
            address: strField(body, "address"),
            category: strField(body, "category"),
            planId: strField(body, "planId"),
          },
          actor,
        ),
      );
    }
    if (op === "impersonate") return Response.json(await impersonatePayload(id, actor));
    if (op === "assignPlan") return Response.json(await assignPlan(strField(body, "dairyId"), strField(body, "planId"), strField(body, "couponCode"), actor));
    if (op === "staffSave") {
      return Response.json(
        await saveStaff(
          {
            id: strField(body, "id") || undefined,
            dairyId: strField(body, "dairyId"),
            name: strField(body, "name"),
            email: strField(body, "email"),
            phone: strField(body, "phone"),
            role: strField(body, "role"),
            status: strField(body, "status"),
          },
          actor,
        ),
      );
    }
    if (op === "staffDelete") return Response.json(await deleteStaff(id, actor));
    if (op === "permission") {
      return Response.json(await savePermission(strField(body, "role"), strField(body, "module"), Boolean(body.allowed), actor));
    }
    if (op === "ticketSave") {
      return Response.json(
        await saveTicket(
          {
            id: strField(body, "id") || undefined,
            dairyId: strField(body, "dairyId"),
            dairyName: strField(body, "dairyName"),
            userName: strField(body, "userName"),
            subject: strField(body, "subject"),
            priority: strField(body, "priority") || "medium",
            message: strField(body, "message"),
          },
          actor,
        ),
      );
    }
    if (op === "ticketStatus") {
      return Response.json(await setTicketStatus(id, strField(body, "status") as "open" | "progress" | "resolved" | "closed", actor));
    }
    if (op === "noticeRead") return Response.json(await markNotice(id, Boolean(body.all)));
    if (op === "backup") return Response.json(await createBackup(actor));
    if (op === "changeAdminPassword") {
      return Response.json(await changeSuperAdminPassword(strField(body, "current"), strField(body, "next")));
    }
    if (op === "settings") {
      const settings = (body.settings || {}) as Record<string, string>;
      return Response.json({ settings: await saveSettings(settings, actor) });
    }
    throw new CustomerError("Unknown action");
  } catch (error) {
    return jsonError(error);
  }
}
