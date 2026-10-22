import {readFileSync,readdirSync} from "node:fs";
import {describe,expect,it} from "vitest";
import {letterSheets} from "@/lib/letter-layout";
import type {PaperQuestion} from "@/lib/paper";
const packs=readdirSync('examples/coppell').filter(f=>f.endsWith('.json')).map(f=>JSON.parse(readFileSync(`examples/coppell/${f}`,'utf8')));
describe('Letter print worksheets',()=>{
 it('prints every sample question once, balances 12-question packs, and fits Letter margins',()=>{
  for(const pack of packs){
   const questions=pack.questions.map((q:PaperQuestion&{externalId:string},index:number)=>({...q,id:String(index)}));
   const pages=letterSheets([{title:pack.title,questions}]);
   expect(pages).toHaveLength(2);expect(pages.map(p=>p.cells.length)).toEqual([6,6]);
   expect(pages.flatMap(p=>p.cells.map(c=>c.number))).toEqual(Array.from({length:12},(_,i)=>i+1));
   for(const page of pages)for(const cell of page.cells){expect(cell.x).toBeGreaterThanOrEqual(36);expect(cell.x+cell.width).toBeLessThanOrEqual(576);expect(cell.y+cell.height).toBeLessThanOrEqual(740.01);expect(cell.height-cell.contentBottom).toBeGreaterThan(25);}
  }
 });
 it('never includes answer keys or student ink and escapes unsafe printed text',()=>{
  const q={id:'q',type:'short_text',prompt:{text:'<script>bad</script> & practice'},options:[],answer_key:{accepted:['PRIVATE_KEY']},student_response:'PRIVATE_INK'};
  const [sheet]=letterSheets([{title:'Test <paper>',questions:[q]}]);
  expect(sheet.svg).not.toMatch(/PRIVATE_KEY|PRIVATE_INK|<script>/);expect(sheet.svg).toContain('&lt;script&gt;');expect(sheet.svg).toContain('width="612" height="792"');
 });
 it('preserves source question numbers when printing a selected app page',()=>{
  const pages=letterSheets([{title:'Page two',startNumber:11,questions:packs[0].questions.slice(10).map((q:PaperQuestion,i:number)=>({...q,id:String(i)}))}]);
  expect(pages.flatMap(p=>p.cells.map(c=>c.number))).toEqual([11,12]);
 });
 it('uses a separate section for each grade and subject',()=>{
  const pages=letterSheets(packs.map(pack=>({title:pack.title,questions:pack.questions})));
  expect(pages).toHaveLength(12);expect(new Set(pages.map(p=>p.title)).size).toBe(6);expect(pages.reduce((n,p)=>n+p.cells.length,0)).toBe(72);
 });
});
