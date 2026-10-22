import {z} from "zod";
import {printAssignment} from "@/lib/print-access";
import {letterPdf} from "@/lib/letter-pdf";
import {fail} from "@/lib/http";
export const runtime='nodejs';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 try{const id=z.string().uuid().parse((await params).id);const section=await printAssignment(id),url=new URL(request.url),page=url.searchParams.get('page');if(page!==null){const index=z.coerce.number().int().min(0).max(19).parse(page);section.questions=section.questions.slice(index*10,(index+1)*10);section.startNumber=index*10+1;}if(!section.questions.length)return fail('NOT_FOUND','No questions on this page.',404);const data=await letterPdf([section]);const filename="lumilearn-"+section.title.normalize("NFKD").replace(/[^a-zA-Z0-9]+/g,"-").slice(0,80)+"-letter.pdf";return new Response(new Uint8Array(data),{headers:{'content-type':'application/pdf','content-disposition':`${url.searchParams.has('download')?'attachment':'inline'}; filename="${filename}"`,'cache-control':'private, no-store'}});}catch(error){const code=error instanceof Error?error.message:'';return fail('PRINT_FAILED',code==='PRINT_QUESTION_TOO_LONG'?'A question is too long for Letter paper. Shorten it before printing.':'This worksheet is not available for printing.',code==='UNAUTHORIZED'||code==='FORBIDDEN'?403:422);}
}
