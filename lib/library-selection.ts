import type {QuestionSet} from './question-contract';
export type LibraryQuestion=QuestionSet['questions'][number]&{versionId:string;setId:string;setTitle:string};
export type LibrarySet={id:string;title:string;grade:string;subject:QuestionSet['subject']};
export type LibraryQuestionPage={questions:LibraryQuestion[];total:number;page:number;pageSize:number};
/** Keep complete selected snapshots in selection order, independently of the current page. */
export function toggleLibraryQuestion(selected:LibraryQuestion[],question:LibraryQuestion,checked:boolean){
 if(!checked)return selected.filter(q=>q.versionId!==question.versionId);
 if(selected.length>=10||selected.some(q=>q.versionId===question.versionId))return selected;
 return [...selected,question];
}
