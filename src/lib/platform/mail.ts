import { connect } from "node:tls";

export type MailResult = { ok: boolean; error?: string };

function env(name: string) {
  return (process.env[name] || "").trim();
}

async function sendResend(to: string, subject: string, text: string): Promise<MailResult> {
  const key = env("RESEND_API_KEY");
  if (!key) return { ok: false, error: "no-resend" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env("EMAIL_FROM") || "DudhSetu <onboarding@resend.dev>",
      to,
      subject,
      text,
    }),
  });
  if (res.ok) return { ok: true };
  const body = await res.text().catch(() => "");
  return { ok: false, error: body.slice(0, 180) || `resend ${res.status}` };
}

function smtpCommand(socket: import("node:tls").TLSSocket, command: string) {
  return new Promise<string>((resolve, reject) => {
    const chunks: string[] = [];
    const onData = (buf: Buffer) => {
      chunks.push(buf.toString("utf8"));
      const text = chunks.join("");
      if (/^\d{3}[\s-]/m.test(text) && !/^\d{3}-/m.test(text.trim().split("\n").pop() || "")) {
        socket.off("data", onData);
        resolve(text);
      }
    };
    socket.on("data", onData);
    socket.once("error", reject);
    if (command) socket.write(`${command}\r\n`);
  });
}

async function sendSmtp(to: string, subject: string, text: string): Promise<MailResult> {
  const user = env("SMTP_USER") || env("GMAIL_USER");
  const pass = env("SMTP_PASS") || env("GMAIL_APP_PASSWORD");
  const host = env("SMTP_HOST") || (user.includes("@gmail.com") ? "smtp.gmail.com" : "");
  const port = Number(env("SMTP_PORT") || 465);
  if (!host || !user || !pass) return { ok: false, error: "no-smtp" };

  const from = env("EMAIL_FROM") || user;
  const payload = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    text,
  ].join("\r\n");

  return new Promise((resolve) => {
    const socket = connect({ host, port, servername: host }, async () => {
      try {
        await smtpCommand(socket, "");
        await smtpCommand(socket, "EHLO tony-dairy");
        await smtpCommand(socket, "AUTH LOGIN");
        await smtpCommand(socket, Buffer.from(user).toString("base64"));
        const auth = await smtpCommand(socket, Buffer.from(pass).toString("base64"));
        if (!auth.startsWith("235")) {
          socket.end();
          resolve({ ok: false, error: "smtp auth fail" });
          return;
        }
        await smtpCommand(socket, `MAIL FROM:<${user}>`);
        await smtpCommand(socket, `RCPT TO:<${to}>`);
        await smtpCommand(socket, "DATA");
        await smtpCommand(socket, `${payload}\r\n.`);
        await smtpCommand(socket, "QUIT");
        socket.end();
        resolve({ ok: true });
      } catch (error) {
        socket.destroy();
        resolve({ ok: false, error: error instanceof Error ? error.message : "smtp fail" });
      }
    });
    socket.setTimeout(20000, () => {
      socket.destroy();
      resolve({ ok: false, error: "smtp timeout" });
    });
    socket.once("error", (error) => resolve({ ok: false, error: error.message }));
  });
}

export async function sendVerifyEmail(to: string, code: string, kind: "verify" | "reset" = "verify"): Promise<MailResult> {
  const subject = kind === "reset" ? "DudhSetu password reset" : "DudhSetu verification code";
  const text =
    kind === "reset"
      ? `Password reset OTP: ${code}\n\nYe code 30 minute ke liye valid hai. Kisi ke saath share mat karna.`
      : `Aapka DudhSetu OTP: ${code}\n\nYe code 30 minute ke liye valid hai. Kisi ke saath share mat karna.`;
  try {
    const resend = await sendResend(to, subject, text);
    if (resend.ok) return resend;
  } catch {
    // try smtp
  }
  try {
    return await sendSmtp(to, subject, text);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "email fail" };
  }
}
