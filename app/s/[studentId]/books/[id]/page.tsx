import {requireRole} from '@/lib/auth';
import {bookDetail} from '@/lib/books';
import {notFound} from 'next/navigation';
import {BookReader} from '@/components/book-reader';
export default async function Book({params}:{params:Promise<{studentId:string;id:string}>}){const session=await requireRole('student'),{studentId,id}=await params;if(session.studentId!==studentId)notFound();let detail;try{detail=await bookDetail(id,session);}catch{notFound();}if(!detail)notFound();return <BookReader detail={detail} studentId={studentId}/>;}
