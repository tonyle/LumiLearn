import {mkdir,writeFile,readFile,unlink} from 'node:fs/promises';import {join,extname} from 'node:path';import {randomUUID} from 'node:crypto';import {PDFDocument} from 'pdf-lib';import {sha256,cleanFilename} from './security';
export const resourceRoot=join(process.cwd(),'data','uploads','resources');
export function resourcePath(key:string){if(!/^[a-f0-9-]{36}\.(pdf|docx|pptx|doc|ppt|mp4|mov|webm)$/.test(key))throw Error('INVALID_KEY');return join(resourceRoot,key);}
function officeZip(data:Buffer,kind:'word'|'ppt'){
 let eocd=-1;for(let i=data.length-22;i>=Math.max(0,data.length-65557);i--)if(data.readUInt32LE(i)===0x06054b50){eocd=i;break;}if(eocd<0)throw Error('INVALID_FILE');
 const count=data.readUInt16LE(eocd+10);let offset=data.readUInt32LE(eocd+16),total=0;const names=[];if(count>3000)throw Error('INVALID_FILE');
 for(let i=0;i<count;i++){if(offset+46>data.length||data.readUInt32LE(offset)!==0x02014b50)throw Error('INVALID_FILE');total+=data.readUInt32LE(offset+24);if(total>200*1024*1024)throw Error('INVALID_FILE');const length=data.readUInt16LE(offset+28);names.push(data.subarray(offset+46,offset+46+length).toString());offset+=46+length+data.readUInt16LE(offset+30)+data.readUInt16LE(offset+32);}
 if(!names.includes('[Content_Types].xml')||!names.includes(kind==='word'?'word/document.xml':'ppt/presentation.xml')||names.some(n=>/vbaProject\.bin$/i.test(n)))throw Error('INVALID_FILE');
}
export async function inspectResourceFile(file:File){
 const ext=extname(file.name).slice(1).toLowerCase(),video=['mp4','mov','webm'].includes(ext),max=video?100:20;if(!file.size||file.size>max*1024*1024)throw Error(video?'VIDEO_SIZE':'DOCUMENT_SIZE');const data=Buffer.from(await file.arrayBuffer());let kind:'pdf'|'document'|'slides'|'video',mime:string;
 if(ext==='pdf'&&data.subarray(0,5).toString()==='%PDF-'){try{await PDFDocument.load(data);}catch{throw Error('INVALID_FILE');}kind='pdf';mime='application/pdf';}
 else if(['docx','pptx'].includes(ext)){officeZip(data,ext==='docx'?'word':'ppt');kind=ext==='docx'?'document':'slides';mime=ext==='docx'?'application/vnd.openxmlformats-officedocument.wordprocessingml.document':'application/vnd.openxmlformats-officedocument.presentationml.presentation';}
 else if(['doc','ppt'].includes(ext)&&data.subarray(0,8).equals(Buffer.from([208,207,17,224,161,177,26,225]))){kind=ext==='doc'?'document':'slides';mime=ext==='doc'?'application/msword':'application/vnd.ms-powerpoint';}
 else if(video&&((ext==='webm'&&data.subarray(0,4).equals(Buffer.from([26,69,223,163])))||(ext!=='webm'&&data.subarray(4,8).toString()==='ftyp'))){kind='video';mime=ext==='webm'?'video/webm':ext==='mov'?'video/quicktime':'video/mp4';}
 else throw Error('INVALID_FILE');return {data,ext,kind,mime,hash:sha256(data),name:cleanFilename(file.name)};
}
export async function storeResourceFile(file:Awaited<ReturnType<typeof inspectResourceFile>>){
 let preview:Buffer|null=null;if(file.kind==='document'||file.kind==='slides'){
  let response:Response;try{response=await fetch(`${process.env.DOCUMENT_CONVERTER_URL||'http://documents:8080'}/convert?ext=${file.ext}`,{method:'POST',body:new Uint8Array(file.data),signal:AbortSignal.timeout(120000),headers:{'Content-Type':'application/octet-stream'}});}catch{throw Error('PREVIEW_FAILED');}
  if(!response.ok)throw Error(response.status===503?'CONVERTER_BUSY':'PREVIEW_FAILED');preview=Buffer.from(await response.arrayBuffer());if(preview.subarray(0,5).toString()!=='%PDF-')throw Error('PREVIEW_FAILED');
 }
 await mkdir(resourceRoot,{recursive:true,mode:0o700});const key=`${randomUUID()}.${file.ext}`,previewKey=preview?`${randomUUID()}.pdf`:file.kind==='pdf'?key:null;
 try{await writeFile(resourcePath(key),file.data,{flag:'wx',mode:0o600});if(preview&&previewKey)await writeFile(resourcePath(previewKey),preview,{flag:'wx',mode:0o600});}catch(error){await removeResourceFiles([key,previewKey]);throw error;}
 return {storage_key:key,preview_key:previewKey,original_filename:file.name,mime_type:file.mime,bytes:file.data.length,kind:file.kind};
}
export async function removeResourceFiles(keys:(string|null|undefined)[]){await Promise.all([...new Set(keys.filter((k):k is string=>!!k))].map(key=>unlink(resourcePath(key)).catch(()=>{})));}
export async function resourceFileExists(key:string){return readFile(resourcePath(key));}
