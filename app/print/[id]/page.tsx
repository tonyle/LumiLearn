import Image from "next/image";
import {notFound,redirect} from "next/navigation";
import {z} from "zod";
import {printAssignment} from "@/lib/print-access";
import {letterSheets} from "@/lib/letter-layout";
import {PrintControls} from "@/components/print-controls";
export default async function PrintPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{page?:string}>}){
 const {id}=await params;if(!z.string().uuid().safeParse(id).success)notFound();
 let section;try{section=await printAssignment(id);}catch(error){if(error instanceof Error&&error.message==='UNAUTHORIZED')redirect('/kids');notFound();}
 const {page}=await searchParams;
 if(page!==undefined){const parsed=z.coerce.number().int().min(0).max(19).safeParse(page);if(!parsed.success)notFound();section.questions=section.questions.slice(parsed.data*10,(parsed.data+1)*10);section.startNumber=parsed.data*10+1;}
 if(!section.questions.length)notFound();
 const sheets=letterSheets([section]),pdfUrl=`/api/assignments/${id}/pdf${page!==undefined?`?page=${page}`:''}`;
 return <main className="print-preview"><PrintControls pdfUrl={pdfUrl}/>{sheets.map((sheet,i)=><article key={i} className="letter-sheet"><Image src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(sheet.svg)}`} alt={`Blank Letter worksheet ${i+1} of ${sheets.length}`} width={612} height={792} unoptimized/></article>)}</main>;
}
