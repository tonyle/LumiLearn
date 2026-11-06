import {requireRole} from '@/lib/auth';
import {notFound} from 'next/navigation';
import {BookList,type BookQuery} from '@/components/book-list';
export default async function Books({params,searchParams}:{params:Promise<{studentId:string}>;searchParams:Promise<BookQuery>}){const session=await requireRole('student'),{studentId}=await params;if(session.studentId!==studentId)notFound();return <div className="student-main"><BookList session={session} studentId={studentId} query={await searchParams}/></div>;}
