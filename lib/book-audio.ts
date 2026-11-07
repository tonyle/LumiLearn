export type BookAudioState='idle'|'loading'|'playing';
/** Call play synchronously from the user's tap so iPad can authorize media playback. */
export class BookAudioPlayer {
 private audio:HTMLAudioElement|null=null;
 private generation=0;
 private timer:ReturnType<typeof setTimeout>|null=null;
 constructor(private state:(value:BookAudioState)=>void,private error:(message:string)=>void,private create:()=>HTMLAudioElement=()=>new Audio(),private timeout=100000){}
 private release(){if(this.timer){clearTimeout(this.timer);this.timer=null;}const a=this.audio;this.audio=null;if(a){a.onplaying=a.onended=a.onerror=null;a.pause();a.removeAttribute('src');a.load();}}
 stop(){this.generation++;this.release();this.state('idle');}
 dispose(){this.generation++;this.release();}
 play(url:string,speed=1){
  this.stop();const attempt=this.generation,a=this.create();this.audio=a;this.state('loading');
  const fail=(message:string)=>{if(this.generation!==attempt)return;this.stop();this.error(message);};
  a.onplaying=()=>{if(this.generation!==attempt)return;if(this.timer)clearTimeout(this.timer);this.timer=null;this.state('playing');};
  a.onended=()=>{if(this.generation===attempt)this.stop();};
  a.onerror=()=>fail('Reading audio is not ready or unavailable. Ask your parent to check Book studio, then tap Listen again.');
  this.timer=setTimeout(()=>fail('Reading audio timed out. Tap Listen to try again.'),this.timeout);
  a.preload='auto';a.src=url;a.defaultPlaybackRate=speed;a.playbackRate=speed;a.preservesPitch=true;const legacy=a as HTMLAudioElement&{webkitPreservesPitch?:boolean};if('webkitPreservesPitch' in legacy)legacy.webkitPreservesPitch=true;
  // No await before play(): preserves Safari's user activation across server synthesis.
  try{void a.play().catch(e=>fail(e?.name==='NotAllowedError'?'Tap Listen again to allow audio playback.':'Reading audio could not play. Tap Listen to try again.'));}catch{fail('Reading audio could not play. Tap Listen to try again.');}
 }
}
