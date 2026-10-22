import { requireRole } from "@/lib/auth";
import { sql } from "@/lib/db";
import { fail } from "@/lib/http";
import { z } from "zod";
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
  try{await requireRole("parent");const id=z.string().uuid().parse((await params).id);const [run]=await sql`SELECT snapshot_png FROM paper_runs WHERE page_id=${id} AND snapshot_png IS NOT NULL ORDER BY created_at DESC LIMIT 1`;if(!run)return fail("NOT_FOUND","No submitted snapshot yet.",404);return new Response(new Uint8Array(run.snapshot_png as Buffer),{headers:{"content-type":"image/png","cache-control":"private, no-store"}});}catch{return fail("FORBIDDEN","Parent sign-in required.",403);}
}
