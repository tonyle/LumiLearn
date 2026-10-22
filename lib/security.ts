import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "lumi_session";
export const CSRF_COOKIE = "lumi_csrf";
export const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a); const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function assertCsrf(request: Request, cookieValue?: string) {
  const supplied = request.headers.get("x-csrf-token");
  if (!cookieValue || !supplied || !safeEqual(cookieValue, supplied)) throw new Error("CSRF");
}
export const cleanFilename = (name: string) => name.normalize("NFKC").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "upload";
