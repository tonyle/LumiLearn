import { hasSameOrigin } from '@/lib/request-origin';
import { hash } from '@node-rs/argon2';
import { z } from 'zod';
import { requireRole } from '@/lib/auth';
import { sql } from '@/lib/db';
import { bodyJson,fail,ok } from '@/lib/http';
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}) {
  try { await requireRole('parent'); } catch { return fail('UNAUTHORIZED','Parent login required.',401); }
  if(!hasSameOrigin(request))return fail('FORBIDDEN','Invalid origin.',403);
  try {
    const {id}=await params; z.string().uuid().parse(id);
    const input=z.object({loginName:z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{2,39}$/),pin:z.string().regex(/^\d{6}$/)}).parse(await bodyJson(request));
    const pinHash=await hash(input.pin);
    const updated=await sql.begin(async tx=>{
      const rows=await tx`UPDATE students SET login_name=${input.loginName},pin_hash=${pinHash},failed_logins=0,locked_until=NULL,updated_at=now() WHERE id=${id} RETURNING id`;
      await tx`DELETE FROM sessions WHERE student_id=${id}`;
      return rows.length;
    });
    return updated?ok({saved:true}):fail('NOT_FOUND','Student not found.',404);
  }catch{return fail('INVALID_REQUEST','Use a unique username (3–40 letters, numbers or hyphens) and a six-digit PIN.',400);}
}
