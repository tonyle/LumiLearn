import {sql} from './db';
import {loadUpload} from './uploads';
import {WorksheetError} from './worksheet-store';
// This installation has one family. Parent-authenticated upload routes grant
// all family parents access; never accept a storage key from the browser.
export async function loadGenerationReference(id:string){
 const [upload]=await sql`SELECT private_storage_key,mime_type FROM uploads WHERE id=${id}`;
 if(!upload)throw new WorksheetError('REFERENCE_UNAVAILABLE','The reference upload is unavailable. Choose another file.',404);
 try{return {data:await loadUpload(String(upload.private_storage_key)),mime:String(upload.mime_type)};}
 catch{throw new WorksheetError('REFERENCE_UNAVAILABLE','The reference file could not be opened. Upload it again.',422);}
}
