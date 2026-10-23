// @vitest-environment jsdom
import {createElement} from 'react';
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {VocabPhotoImport} from '@/components/vocab-photo-import';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('offers the rear camera and requires review before importing extracted words',async()=>{vi.stubGlobal('URL',Object.assign(URL,{createObjectURL:()=> 'blob:photo',revokeObjectURL:vi.fn()}));const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({data:{words:[{word:'cat'},{word:'dog'}],warnings:[]}})});vi.stubGlobal('fetch',fetcher);const use=vi.fn();const {container}=render(createElement(VocabPhotoImport,{onUse:use}));const camera=container.querySelector('input[capture="environment"]')!;expect(camera.getAttribute('accept')).toBe('image/*');fireEvent.change(camera,{target:{files:[new File(['photo'],'words.jpg',{type:'image/jpeg'})]}});expect(fetcher).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Read words from photo'}));await screen.findByLabelText('Photo word 1');expect(use).not.toHaveBeenCalled();fireEvent.change(screen.getByLabelText('Photo word 2'),{target:{value:'sun'}});fireEvent.click(screen.getByRole('button',{name:'Use these 2 words'}));expect(use).toHaveBeenCalledWith('cat\nsun');});
