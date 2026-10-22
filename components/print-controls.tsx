"use client";
import {useState} from "react";
import {Download,Printer} from "lucide-react";
export function PrintControls({pdfUrl}:{pdfUrl:string}){
 const[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function print(){setBusy(true);setError('');try{const response=await fetch(pdfUrl);if(!response.ok)throw Error('Could not prepare the PDF. Try again.');await response.arrayBuffer();window.print();}catch(error){setError(error instanceof Error?error.message:'Could not print.');}finally{setBusy(false);}}
 return <div className="print-controls"><button className="primary" disabled={busy} onClick={()=>void print()}><Printer size={18}/>{busy?'Preparing PDF…':'Print Letter'}</button><a className="button secondary" href={`${pdfUrl}${pdfUrl.includes('?')?'&':'?'}download=1`}><Download size={18}/> Download PDF</a><a className="button ghost" href={pdfUrl} target="_blank" rel="noopener noreferrer">Open PDF</a><p>Letter 8.5 × 11 in · Actual size / 100% · On iPad: Share → Print → choose your AirPrint printer.</p>{error&&<p className="notice" role="alert">{error}</p>}</div>;
}
