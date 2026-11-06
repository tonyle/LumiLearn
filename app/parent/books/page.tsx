import {requireRole} from '@/lib/auth';
import {BookList,type BookQuery} from '@/components/book-list';
export default async function Books({searchParams}:{searchParams:Promise<BookQuery>}){const session=await requireRole('parent');return <BookList session={session} query={await searchParams}/>;}
