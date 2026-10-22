import { NextResponse } from "next/server";

export function requestId(request: Request) {
  return request.headers.get("x-request-id")?.slice(0, 80) || crypto.randomUUID();
}
export function ok<T>(data: T, status = 200, id = crypto.randomUUID()) {
  return NextResponse.json({ data, error: null, requestId: id }, { status });
}
export function fail(code: string, message: string, status = 400, id = crypto.randomUUID(), details?: unknown) {
  return NextResponse.json({ data: null, error: { code, message, ...(details ? { details } : {}) }, requestId: id }, { status });
}
export async function bodyJson(request: Request, maxBytes = 1_000_000) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > maxBytes) throw new Error("PAYLOAD_TOO_LARGE");
  const raw = await request.text();
  if (Buffer.byteLength(raw) > maxBytes) throw new Error("PAYLOAD_TOO_LARGE");
  return JSON.parse(raw) as unknown;
}
