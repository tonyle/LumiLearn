// @vitest-environment jsdom
import {createElement} from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {BookAudioPreparation} from '@/components/book-audio-preparation';
const m=vi.hoisted(()=>({request:vi.fn()}));
vi.mock('@/components/book-api',()=>({bookRequest:m.request,bookJson:()=>({method:'POST'})}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
it('shows preparation progress and queues a retry without blocking page editing',async()=>{m.request.mockResolvedValue({state:'processing',ready:2,total:5,workerReady:true});render(createElement(BookAudioPreparation,{bookId:'book',revision:1}));await screen.findByText(/2 \/ 5 audio files/);expect(screen.getByRole('progressbar').getAttribute('value')).toBe('2');fireEvent.click(screen.getByRole('button',{name:'Prepare / retry audio'}));await waitFor(()=>expect(m.request).toHaveBeenCalledWith('/api/parent/books/book/audio',{method:'POST'}));});
it('shows permanently prepared audio and the backup location',async()=>{m.request.mockResolvedValue({state:'ready',ready:5,total:5,workerReady:true});render(createElement(BookAudioPreparation,{bookId:'book',revision:1}));await screen.findByText('Ready for instant playback');expect(screen.getByText('data/uploads/books/audio')).toBeTruthy();});
