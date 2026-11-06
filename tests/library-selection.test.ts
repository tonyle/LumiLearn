import {describe,it,expect} from 'vitest';
import {toggleLibraryQuestion,type LibraryQuestion} from '../lib/library-selection';
const question=(id:string,setId='first')=>({versionId:id,setId,prompt:{text:`Question ${id}`},answer:{kind:'number',value:42}} as LibraryQuestion);
describe('library selections across paginated filters',()=>{
 it('retains full selected questions from previous pages and sets in selection order',()=>{
  const firstPage=question('first'),nextPage=question('next'),otherSet=question('other','second');
  let selected=toggleLibraryQuestion([],firstPage,true);
  selected=toggleLibraryQuestion(selected,nextPage,true);
  selected=toggleLibraryQuestion(selected,otherSet,true);
  expect(selected.map(q=>q.versionId)).toEqual(['first','next','other']);
  expect(selected[0].answer).toEqual({kind:'number',value:42});
  selected=toggleLibraryQuestion(selected,nextPage,false);
  selected=toggleLibraryQuestion(selected,nextPage,true);
  expect(selected.map(q=>q.versionId)).toEqual(['first','other','next']);
 });
 it('enforces 200 unique selections even across different pages',()=>{
  let selected:LibraryQuestion[]=[];
  for(let index=0;index<202;index++)selected=toggleLibraryQuestion(selected,question(String(index)),true);
  expect(selected).toHaveLength(200);
  expect(toggleLibraryQuestion(selected,question('0'),true)).toEqual(selected);
  selected=toggleLibraryQuestion(selected,question('3'),false);
  const replacement=toggleLibraryQuestion(selected,question('201'),true);expect(replacement).toHaveLength(200);expect(replacement.at(-1)?.versionId).toBe('201');expect(replacement.some(q=>q.versionId==='3')).toBe(false);
 });
});
