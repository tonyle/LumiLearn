import {parentPage} from '@/lib/parent-page';import {sql} from '@/lib/db';import {LibraryWorksheetBuilder} from '@/components/library-worksheet-builder';import type {LearnerChoice} from '@/lib/worksheet-authoring';import type {LibrarySet} from '@/lib/library-selection';import {parentLibraryQuestions} from '@/lib/parent-library';
export default async function FromLibrary({searchParams}:{searchParams:Promise<{set?:string}>}){
 await parentPage();
 const sets=await sql<LibrarySet[]>`SELECT DISTINCT qs.id,qs.title,q.grade,q.subject_code subject FROM question_sets qs JOIN questions q ON q.set_id=qs.id WHERE q.state IN ('published','approved') ORDER BY qs.title,qs.id,q.grade,q.subject_code`;
 const requestedSet=(await searchParams).set,initialSet=sets.find(s=>s.id===requestedSet);
 const grade=initialSet?.grade??'3',subject=initialSet?.subject??'math';
 const initialPage=await parentLibraryQuestions({grade,subject,set:initialSet?.id});
 const students=await sql<LearnerChoice[]>`SELECT id,nickname,grade FROM students WHERE active=true ORDER BY grade,nickname`;
 return <LibraryWorksheetBuilder students={students} sets={sets} initialPage={initialPage} initialSet={initialSet}/>;
}
