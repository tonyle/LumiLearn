import {requireRole} from '@/lib/auth';import {notFound} from 'next/navigation';import {GameHub} from '@/components/game-hub';
export default async function Games({params}:{params:Promise<{studentId:string}>}){const s=await requireRole('student'),{studentId}=await params;if(s.studentId!==studentId)notFound();return <main className="student-main"><GameHub studentId={studentId}/></main>;}
