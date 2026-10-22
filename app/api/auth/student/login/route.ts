import { verify } from '@node-rs/argon2';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { bodyJson, fail, ok } from '@/lib/http';
import { randomToken, SESSION_COOKIE, sha256 } from '@/lib/security';
import { rateLimit } from '@/lib/rate-limit';
export async function POST(request: Request) {
  if (!rateLimit(`login:${request.headers.get('x-forwarded-for') || 'local'}`,20,60_000)) return fail('RATE_LIMITED','Please wait a minute before trying again.',429);
  try {
    const {loginName,pin}=z.object({loginName:z.string().trim().toLowerCase().min(1).max(60),pin:z.string().regex(/^\d{6}$/)}).parse(await bodyJson(request));
    const [s]=await sql`SELECT id,pin_hash,locked_until FROM students WHERE lower(login_name)=${loginName} AND active=true`;
    if (!s?.pin_hash || (s.locked_until && new Date(s.locked_until)>new Date())) return fail('LOGIN_FAILED','Check your username and PIN, or ask your parent for help.',401);
    if (!await verify(s.pin_hash,pin)) {
      await sql`UPDATE students SET failed_logins=failed_logins+1,locked_until=CASE WHEN failed_logins>=4 THEN now()+interval '15 minutes' ELSE NULL END WHERE id=${s.id}`;
      return fail('LOGIN_FAILED','Check your username and PIN, or ask your parent for help.',401);
    }
    await sql`UPDATE students SET failed_logins=0,locked_until=NULL WHERE id=${s.id}`;
    const token=randomToken();
    await sql`INSERT INTO sessions(role,student_id,token_hash,expires_at) VALUES('student',${s.id},${sha256(token)},now()+interval '8 hours')`;
    const response=ok({studentId:s.id});
    response.cookies.set(SESSION_COOKIE,token,{httpOnly:true,sameSite:'strict',secure:process.env.COOKIE_SECURE==='true',path:'/',maxAge:28800});
    return response;
  } catch { return fail('INVALID_REQUEST','Enter your username and six-digit PIN.',400); }
}
