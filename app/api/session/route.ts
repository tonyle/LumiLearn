import { getSession } from "@/lib/auth";import { ok } from "@/lib/http";
export async function GET(){const session=await getSession();return ok(session?{role:session.role,studentId:session.studentId}:{role:null});}
