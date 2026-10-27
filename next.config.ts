import os from "node:os";
import path from "node:path";
import type { NextConfig } from "next";

const onVercel = Boolean(process.env.VERCEL);
const cwd = process.cwd();
const offSystemDisk = process.platform === "win32" && !/^c:/i.test(cwd);
const distDir =
  !onVercel && offSystemDisk
    ? path.join(os.tmpdir(), "tonydariy-next")
    : ".next";

const nextConfig: NextConfig = {
  distDir,
  serverExternalPackages: [],
};

export default nextConfig;
