import { cookies } from "next/headers";
import { sha256, SESSION_COOKIE } from "@/lib/security";
import { sql } from "@/lib/db";

export type Session = { id: string; role: "parent" | "student"; parentId: string | null; studentId: string | null };

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await sql<{ id:string; role:"parent"|"student"; parent_id:string|null; student_id:string|null }[]>`
    SELECT id, role, parent_id, student_id FROM sessions
    WHERE token_hash=${sha256(token)} AND expires_at>now() AND (role='parent' OR EXISTS (SELECT 1 FROM students WHERE students.id=sessions.student_id AND students.active=true)) LIMIT 1`;
  const row = rows[0];
  return row ? { id: row.id, role: row.role, parentId: row.parent_id, studentId: row.student_id } : null;
}
export async function requireRole(role: Session["role"]) {
  const session = await getSession();
  if (!session || session.role !== role) throw new Error("UNAUTHORIZED");
  return session;
}
