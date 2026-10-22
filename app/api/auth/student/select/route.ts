import { fail } from '@/lib/http';
export async function POST(){return fail('LOGIN_REQUIRED','Sign in with your username and PIN.',401);}
