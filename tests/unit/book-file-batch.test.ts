import {beforeEach,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({render:vi.fn(),prepare:vi.fn()}));
vi.mock('@/lib/books',()=>({readingService:m.render}));
vi.mock('@/lib/db',()=>({sql:vi.fn()}));
import {PDFDocument} from 'pdf-lib';
import sharp from 'sharp';
import {importBookFiles} from '@/lib/book-files';
beforeEach(()=>vi.clearAllMocks());
it('imports multiple PDFs and photos in selection order',async()=>{
 const pdf=await PDFDocument.create();pdf.addPage();const bytes=await pdf.save();
 const image=await sharp({create:{width:20,height:30,channels:3,background:'white'}}).jpeg().toBuffer();
 m.render.mockImplementation(async()=>Response.json({pages:[{image:image.toString('base64')}]}));
 const pages=await importBookFiles([new File([new Uint8Array(bytes)],'first.pdf'),new File([image],'photo.jpg'),new File([new Uint8Array(bytes)],'last.pdf')]);
 expect(pages).toHaveLength(3);expect(m.render).toHaveBeenCalledTimes(2);
});
it('rejects too many files before rendering',async()=>{await expect(importBookFiles(Array.from({length:21},()=>new File(['x'],'p.jpg')))).rejects.toThrow('20');expect(m.render).not.toHaveBeenCalled();});
