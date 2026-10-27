import {vocabSession} from '@/lib/vocab-store';import {vocabListFilters} from '@/lib/vocab-management';import {vocabLessonList} from '@/lib/vocab-library';
import {saveVocabLesson} from '@/lib/vocab-lessons';import {resourceError} from '@/lib/resource-store';import {ok} from '@/lib/http';export async function POST(r:Request){try{return ok(await saveVocabLesson(r),201);}catch(e){return resourceError(e);}}

export async function GET(r:Request){try{await vocabSession(undefined,'parent');return ok(await vocabLessonList(vocabListFilters(new URL(r.url).searchParams)));}catch(e){return resourceError(e);}}
