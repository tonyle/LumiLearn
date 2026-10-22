import { describe, expect, it, vi } from "vitest";
import { pageLayout, paperHeight, paperSvg, safePaperFeedback, paperDraftSchema, type PaperQuestion } from "@/lib/paper";
import { mergePaperResults, typedResponse, type GradingQuestion } from "@/lib/paper-grading";
import { gradePaperImage } from "@/lib/ai/paper-grader";
import { gradeDeterministic } from "@/lib/grading";
const id="00000000-0000-4000-8000-000000000001";
const question:GradingQuestion={id,type:"number",prompt:{text:"What is 5 + 4?"},options:[],answer_key:{kind:"number",value:9,tolerance:0,unit:null},grading_policy:{mode:"deterministic"}};
describe("whole-page worksheets",()=>{
 it("lays out ten questions without overlapping and bounds every answer box",()=>{
  const questions:PaperQuestion[]=Array.from({length:10},(_,i)=>({...question,id:String(i),prompt:{text:i%2?"Longer text ".repeat(35):"Short question"}}));
  const cells=pageLayout(questions,1),height=paperHeight(questions,1);
  expect(cells).toHaveLength(10);
  for(const cell of cells){expect(cell.answer.y+cell.answer.height).toBeLessThanOrEqual(cell.y+cell.height);expect(cell.y+cell.height).toBeLessThan(height);}
  for(let i=0;i<cells.length;i+=2){if(i+2<cells.length)expect(cells[i+2].y).toBeGreaterThanOrEqual(Math.max(cells[i].y+cells[i].height,cells[i+1].y+cells[i+1].height));}
 });
 it("escapes printed content, captures ink, and excludes answer keys",()=>{
  const svg=paperSvg([{...question,prompt:{text:'<script>unsafe</script> & "text"'}}],"Math <paper>",0,{[id]:{text:"Typed & answer",strokes:[{tool:"pen",points:[{x:.1,y:.1,p:.5},{x:.5,y:.5,p:.8}]}]}});
  expect(svg).not.toContain("<script>");expect(svg).toContain("&lt;script&gt;");expect(svg).toContain("<path");expect(svg).not.toContain("answer_key");
 });
 it("keeps correct grades locked and scores only ten points per correct answer",()=>{
  const results=mergePaperResults([{questionId:id,status:"correct",points:10}],[{questionId:id,status:"incorrect",points:0}],[question]);
  expect(results[0].points).toBe(10);
  const feedback=safePaperFeedback("graded",[{...results[0],transcription:"private",reason:"secret answer"}],1);
  expect(feedback.earned).toBe(10);expect(feedback.maximum).toBe(10);expect(JSON.stringify(feedback)).not.toMatch(/private|secret|transcription|reason/);
 });
 it("rejects huge drawing payloads and never reads a blank numeric answer as zero",()=>{
  expect(paperDraftSchema.safeParse({[id]:{text:"",strokes:[{tool:"pen",points:[{x:2,y:0,p:.5}]}]}}).success).toBe(false);
  expect(gradeDeterministic({kind:"number",value:0,tolerance:0},{value:" "}).verdict).toBe("incorrect");
 });
 it("maps handwritten choice labels and ordering to option IDs",()=>{
  const choice={...question,options:[{id:"first",text:"Blue"},{id:"second",text:"Red"}],answer_key:{kind:"ordered_ids" as const,orderedIds:["second","first"]}};
  expect(typedResponse(choice,"B, A").value).toEqual(["second","first"]);
 });
 it("sends one image request for a whole page and grades exact math in code",async()=>{
  const fake=vi.fn().mockResolvedValue({ok:true,json:async()=>({status:"completed",output:[{content:[{type:"output_text",text:JSON.stringify({answers:[{questionId:id,transcription:"8",numericValue:8,booleanValue:null,optionIds:[],confidence:.99,verdict:"correct",reason:"AI made an arithmetic mistake"}]})}]}],usage:{input_tokens:100,output_tokens:50}})});
  const graded=await gradePaperImage(Buffer.from("image"),[question],fake as unknown as typeof fetch);
  expect(fake).toHaveBeenCalledTimes(1);expect(graded.results[0].status).toBe("incorrect");expect(graded.results[0].points).toBe(0);
  const request=JSON.parse(fake.mock.calls[0][1].body);expect(request.store).toBe(false);expect(request.input[0].content.filter((c:{type:string})=>c.type==="input_image")).toHaveLength(1);
 });
 it("leaves uncertain handwriting unscored and rejects mismatched question IDs",async()=>{
  const answer={questionId:id,transcription:"9?",numericValue:9,booleanValue:null,optionIds:[],confidence:.5,verdict:"correct",reason:"unclear"};
  const fake=vi.fn().mockImplementation(async()=>({ok:true,json:async()=>({status:"completed",output:[{content:[{type:"output_text",text:JSON.stringify({answers:[answer]})}]}]})}));
  const graded=await gradePaperImage(Buffer.from("image"),[question],fake as unknown as typeof fetch);
  expect(graded.results[0].status).toBe("needs_review");expect(graded.results[0].points).toBeNull();
  answer.questionId="00000000-0000-4000-8000-000000000002";
  await expect(gradePaperImage(Buffer.from("image"),[question],fake as unknown as typeof fetch)).rejects.toThrow("AI_QUESTION_MISMATCH");
 });
});
