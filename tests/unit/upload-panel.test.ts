// @vitest-environment jsdom
import {createElement} from 'react';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,describe,it,expect,vi} from 'vitest';
import {UploadPanel} from '@/components/upload-panel';
const refresh=vi.hoisted(()=>vi.fn());
vi.mock('next/navigation',()=>({useRouter:()=>({refresh})}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.clearAllMocks();});
describe('iPad worksheet capture',()=>{
 it('uploads an accepted camera photo immediately and refreshes the private list',async()=>{
  const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({data:{id:'photo'}})});vi.stubGlobal('fetch',fetcher);
  render(createElement(UploadPanel));const input=screen.getByLabelText('Take worksheet photo');expect(input.getAttribute('capture')).toBe('environment');
  const file=new File(['photo'],'worksheet.jpg',{type:'image/jpeg'});fireEvent.change(input,{target:{files:[file]}});
  await screen.findByText('Worksheet uploaded and stored privately.');expect(fetcher).toHaveBeenCalledTimes(1);expect(fetcher.mock.calls[0][1].body.get('file')).toBe(file);expect(refresh).toHaveBeenCalledTimes(1);
 });
 it('retains a camera photo after a network failure so the parent can retry',async()=>{
  const fetcher=vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ok:true,json:async()=>({data:{}})});vi.stubGlobal('fetch',fetcher);render(createElement(UploadPanel));
  fireEvent.change(screen.getByLabelText('Take worksheet photo'),{target:{files:[new File(['photo'],'worksheet.jpg',{type:'image/jpeg'})]}});
  await screen.findByRole('alert');fireEvent.click(screen.getByRole('button',{name:'Upload for review'}));await screen.findByText('Worksheet uploaded and stored privately.');expect(fetcher).toHaveBeenCalledTimes(2);
 });
 it('does not upload on camera cancel or before an existing file is submitted',async()=>{
  const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({data:{}})});vi.stubGlobal('fetch',fetcher);render(createElement(UploadPanel));
  fireEvent.change(screen.getByLabelText('Take worksheet photo'),{target:{files:[]}});
  fireEvent.change(screen.getByLabelText('Worksheet file'),{target:{files:[new File(['pdf'],'worksheet.pdf',{type:'application/pdf'})]}});expect(fetcher).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Upload for review'}));await waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(1));
 });
});
