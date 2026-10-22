import {samplePrintSections} from "@/lib/print-access";
import {letterPdf} from "@/lib/letter-pdf";
import {fail} from "@/lib/http";
export const runtime='nodejs';
export async function GET(){try{const sections=await samplePrintSections();if(!sections.length)return fail('NOT_FOUND','No practice packs found.',404);const data=await letterPdf(sections);return new Response(new Uint8Array(data),{headers:{'content-type':'application/pdf','content-disposition':'inline; filename="lumilearn-grades-1-3-5-letter.pdf"','cache-control':'private, no-store'}});}catch{return fail('PRINT_FAILED','Parent sign-in is required to print practice packs.',403);}}
