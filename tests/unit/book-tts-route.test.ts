import {beforeEach,expect,it,vi} from 'vitest';
vi.mock('@/lib/db',()=>({sql:vi.fn()}));
const m=vi.hoisted(()=>({session:vi.fn(),target:vi.fn(),limit:vi.fn(),audio:vi.fn()}));
vi.mock('@/lib/resource-store',async importOriginal=>({...await importOriginal<typeof import('@/lib/resource-store')>(),resourceSession:m.session}));
vi.mock('@/lib/book-language',async importOriginal=>({...await importOriginal<typeof import('@/lib/book-language')>(),readingTarget:m.target,limitReading:m.limit}));
vi.mock('@/lib/book-audio-library',()=>({readBookAudio:m.audio}));
import {GET} from '@/app/api/books/[id]/listen/route';
import {ResourceError} from '@/lib/resource-store';
const pageId='11111111-1111-4111-8111-111111111111';
function request(query='',range?:string){return GET(new Request(`http://localhost/api/books/book/listen?pageId=${pageId}&regionId=r1${query}`,{headers:range?{range}:{}}),{params:Promise.resolve({id:'book'})});}
beforeEach(()=>{vi.clearAllMocks();m.session.mockResolvedValue({id:'s',role:'student'});m.target.mockResolvedValue('The cat sleeps.');m.audio.mockResolvedValue(Buffer.from('RIFF1234WAVEdata'));});
it('resolves authorized reviewed text before reading a prepared WAV with af_heart and slow defaults',async()=>{const response=await request();expect(response.status).toBe(200);expect(response.headers.get('content-type')).toBe('audio/wav');expect(m.audio).toHaveBeenCalledWith('book','The cat sleeps.');expect(response.headers.get('cache-control')).toContain('no-store');expect(response.headers.get('x-tts-cache')).toBe('HIT');});
it('never accesses cached audio for an unassigned book',async()=>{m.target.mockRejectedValue(new ResourceError('NOT_FOUND','Book not assigned',404));expect((await request()).status).toBe(404);expect(m.audio).not.toHaveBeenCalled();});
it.each(['&speed=9','&voice=am_adam','&text=Injected','&speed=abc'])('rejects unsupported configuration %s',async query=>{expect((await request(query)).status).toBe(422);expect(m.audio).not.toHaveBeenCalled();});
it('returns byte ranges for Safari without bypassing authorization',async()=>{const response=await request('', 'bytes=0-3');expect(response.status).toBe(206);expect(await response.text()).toBe('RIFF');expect(response.headers.get('content-range')).toBe('bytes 0-3/16');expect(m.target).toHaveBeenCalled();});
it('maps unavailable and timed out services to stable JSON errors',async()=>{m.audio.mockRejectedValue(new ResourceError('TTS_TIMEOUT','Audio generation timed out. Try again.',504));const r=await request();expect(r.status).toBe(504);expect((await r.json()).error.code).toBe('TTS_TIMEOUT');});

it('returns preparation status without calling TTS when a file is missing',async()=>{m.audio.mockResolvedValueOnce(null);const r=await request();expect(r.status).toBe(409);expect((await r.json()).error.code).toBe('AUDIO_PREPARING');});
