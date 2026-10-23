"use client";
import {useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {Camera,FileUp,ShieldCheck,CheckCircle2} from "lucide-react";

export function UploadPanel(){
  const router=useRouter();
  const camera=useRef<HTMLInputElement>(null);
  const uploading=useRef(false);
  const [file,setFile]=useState<File|null>(null);
  const [message,setMessage]=useState("");
  const [success,setSuccess]=useState(false);
  const [busy,setBusy]=useState(false);
  async function upload(selected:File){
    if(uploading.current)return;
    setFile(selected);setMessage("");setSuccess(false);
    if(!selected.size||selected.size>20*1024*1024){setMessage("Choose a non-empty worksheet smaller than 20 MB.");return;}
    uploading.current=true;setBusy(true);
    try{
      const body=new FormData();body.set("file",selected);
      const response=await fetch("/api/parent/uploads",{method:"POST",body});
      const json=await response.json();
      if(!response.ok){setMessage(json.error?.message||"Upload failed. Please try again.");return;}
      setSuccess(true);setFile(null);
      setMessage("Worksheet uploaded and stored privately.");
      router.refresh();
      if(json.data?.id)router.push(`/parent/upload/${json.data.id}`);
    }catch{setMessage("Could not upload. Check your connection and try again.");}
    finally{uploading.current=false;setBusy(false);}
  }
  return <section className="card stack">
    <span className="subject-icon"><Camera size={28}/></span>
    <div><h2>Capture a fresh page.</h2><p className="muted">Photograph a worksheet with your iPad, or upload one you already have.</p></div>
    <div className="capture-panel stack">
      <input ref={camera} aria-label="Take worksheet photo" type="file" accept="image/*" capture="environment" hidden disabled={busy} onChange={e=>{const selected=e.currentTarget.files?.[0];e.currentTarget.value="";if(selected)void upload(selected);}}/>
      <button type="button" className="primary" disabled={busy} onClick={()=>camera.current?.click()}><Camera size={20}/>{busy?"Uploading worksheet…":"Take a photo"}</button>
      <small className="muted">Use the rear camera. After you accept the photo, it uploads automatically.</small>
    </div>
    <div className="upload-divider"><span>or choose an existing file</span></div>
    <form className="stack" onSubmit={e=>{e.preventDefault();if(file)void upload(file);}}>
      <label className="field">Worksheet file<input name="file" type="file" accept="application/pdf,image/png,image/jpeg,image/heic,image/heif,.heic,.heif" disabled={busy} onChange={e=>{setFile(e.currentTarget.files?.[0]||null);setMessage("");setSuccess(false);}}/></label>
      {file&&<small className="muted">{file.name} · {(file.size/1024/1024).toFixed(1)} MB</small>}
      <button className="secondary" disabled={busy||!file}><FileUp size={18}/>{busy?"Uploading…":"Upload for review"}</button>
    </form>
    {message&&<div role={success?"status":"alert"} className={`notice ${success?"success":""}`}>{success&&<CheckCircle2 size={17}/>} {message}</div>}
    <p className="muted" style={{fontSize:".8rem",margin:0}}>PDF, PNG, JPEG or HEIC · Up to 20 MB. Keep the page flat, well lit and fully in view.</p>
    <div className="row muted"><ShieldCheck size={18}/><small>Your uploads stay private. Uploading a photo does not send it to AI automatically.</small></div>
  </section>;
}
