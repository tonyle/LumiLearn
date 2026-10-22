import {getSession} from './auth';import {redirect} from 'next/navigation';
export async function parentPage(){const session=await getSession();if(session?.role!=='parent')redirect('/login');return session;}
