import { requireRole } from "@/lib/auth";
import { sql } from "@/lib/db";
import { fail } from "@/lib/http";
import { z } from "zod";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
  try{await requireRole("parent");const id=z.string().uuid().parse((await params).id);const version=new URL(request.url).searchParams.get('v');if(version&&!z.string().uuid().safeParse(version).success)return fail('NOT_FOUND','Snapshot not found.',404);const [run]=await sql`SELECT snapshot_png FROM paper_runs WHERE page_id=${id} AND (${version}::uuid IS NULL OR id=${version}::uuid) AND snapshot_png IS NOT NULL ORDER BY created_at DESC LIMIT 1`;if(!run)return fail("NOT_FOUND","No submitted snapshot yet.",404);return new Response(new Uint8Array(run.snapshot_png as Buffer),{headers:{"content-type":"image/png","cache-control":"private, no-store"}});}catch{return fail("FORBIDDEN","Parent sign-in required.",403);}
}
