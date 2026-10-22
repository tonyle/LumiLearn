import {PDFDocument} from "pdf-lib";
import sharp from "sharp";
import {letterSheets,type LetterSection} from "./letter-layout";
export async function letterPdf(sections:LetterSection[]){
 const pdf=await PDFDocument.create();pdf.setTitle(sections.length===1?sections[0].title:'LumiLearn - Offline practice');pdf.setCreator('LumiLearn Home');pdf.setSubject('Blank US Letter practice worksheets');
 for(const sheet of letterSheets(sections)){
  const png=await sharp(Buffer.from(sheet.svg),{density:300}).resize(2550,3300).png().toBuffer();
  const image=await pdf.embedPng(png),page=pdf.addPage([612,792]);page.drawImage(image,{x:0,y:0,width:612,height:792});
 }
 return pdf.save();
}
