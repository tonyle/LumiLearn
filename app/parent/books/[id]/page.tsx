import {requireRole} from '@/lib/auth';
import {bookDetail} from '@/lib/books';
import {sql} from '@/lib/db';
import {BookParent} from '@/components/book-parent';
import {notFound} from 'next/navigation';
export default async function Book({params}:{params:Promise<{id:string}>}){const session=await requireRole('parent');const {id}=await params;let detail;try{detail=await bookDetail(id,session);}catch{notFound();}if(!detail)notFound();const students=await sql<{id:string;nickname:string;grade:string}[]>`SELECT id,nickname,grade FROM students WHERE active=true ORDER BY grade,nickname`;return <BookParent initial={detail} students={students}/>;}
