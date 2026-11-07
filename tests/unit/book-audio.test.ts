import {afterEach,expect,it,vi} from 'vitest';
import {BookAudioPlayer} from '@/lib/book-audio';
class AudioDouble {
 src='';preload='';onplaying:(()=>void)|null=null;onended:(()=>void)|null=null;onerror:(()=>void)|null=null;
 pause=vi.fn();load=vi.fn();removeAttribute=vi.fn();play=vi.fn().mockResolvedValue(undefined);
}
afterEach(()=>vi.useRealTimers());
it('starts playback in the click path and stops old audio before the next passage',()=>{
 const sounds:AudioDouble[]=[],state=vi.fn(),error=vi.fn();const player=new BookAudioPlayer(state,error,()=>{const a=new AudioDouble();sounds.push(a);return a as unknown as HTMLAudioElement;});
 player.play('/first',.65);expect((sounds[0] as unknown as HTMLAudioElement).playbackRate).toBe(.65);expect((sounds[0] as unknown as HTMLAudioElement).preservesPitch).toBe(true);expect(sounds[0].play).toHaveBeenCalledTimes(1);const late=sounds[0].onerror;
 player.play('/second');expect(sounds[0].pause).toHaveBeenCalled();expect(sounds[0].removeAttribute).toHaveBeenCalledWith('src');late?.();expect(error).not.toHaveBeenCalled();sounds[1].onplaying?.();expect(state).toHaveBeenLastCalledWith('playing');player.stop();expect(state).toHaveBeenLastCalledWith('idle');expect(sounds[1].pause).toHaveBeenCalled();
});
it('times out pending audio and ignores late callbacks after stop or dispose',()=>{
 vi.useFakeTimers();const a=new AudioDouble(),state=vi.fn(),error=vi.fn(),p=new BookAudioPlayer(state,error,()=>a as unknown as HTMLAudioElement,100);p.play('/slow');const late=a.onplaying;vi.advanceTimersByTime(101);expect(error).toHaveBeenCalledWith(expect.stringMatching(/timed out/i));expect(a.pause).toHaveBeenCalled();late?.();expect(state).toHaveBeenLastCalledWith('idle');p.play('/next');p.dispose();vi.advanceTimersByTime(200);expect(error).toHaveBeenCalledTimes(1);
});
it('surfaces playback failures and allows a fresh retry',async()=>{
 const a=new AudioDouble(),error=vi.fn(),p=new BookAudioPlayer(vi.fn(),error,()=>a as unknown as HTMLAudioElement);a.play.mockRejectedValueOnce(Object.assign(Error('gesture'),{name:'NotAllowedError'}));p.play('/audio');await Promise.resolve();expect(error).toHaveBeenCalledWith(expect.stringMatching(/tap Listen/i));p.play('/audio');a.onplaying?.();a.onended?.();expect(a.pause).toHaveBeenCalled();p.dispose();
});
