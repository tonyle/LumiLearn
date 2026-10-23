export const POKEMON=[
 {id:25,name:'Pikachu',move:'Thunderbolt',element:'electric',color:'#ffca28'},
 {id:6,name:'Charizard',move:'Flamethrower',element:'fire',color:'#ff7946'},
 {id:9,name:'Blastoise',move:'Hydro Pump',element:'water',color:'#40d7f1'},
 {id:3,name:'Venusaur',move:'Solar Beam',element:'nature',color:'#91ed79'},
 {id:448,name:'Lucario',move:'Aura Sphere',element:'aura',color:'#89b9ff'},
] as const;
export type PokemonId=typeof POKEMON[number]['id'];
export const RACE={distance:1100,questions:10,playerSpeed:9,aiSpeed:10,aiVariance:.8,boost:17,responseBonus:10,comboBonus:6,boostSeconds:3.5,catchUp:2.4,maxLead:85,acceleration:14,finalSprint:10,maxSpeed:40,grace:220,step:1/60} as const;
export type Racer={pokemon:PokemonId;position:number;speed:number;finish:number|null};
export type MeadowRace={seed:number;elapsed:number;steps:number;racers:Racer[];questionIndex:number;correct:number;streak:number;bestStreak:number;fastest:number|null;questionAt:number;boostLeft:number;boostPower:number;finished:boolean};
function random(seed:number,index:number){let n=(seed^Math.imul(index+17,2654435761))>>>0;n=Math.imul(n^(n>>>16),0x21f0aaad);n=Math.imul(n^(n>>>15),0x735a2d97);return ((n^(n>>>15))>>>0)/4294967296;}
export function createMeadowRace(seed:number,pokemon:PokemonId=25):MeadowRace{const others=POKEMON.filter(p=>p.id!==pokemon).map(p=>({id:p.id,sort:random(seed,p.id)})).sort((a,b)=>a.sort-b.sort).slice(0,3);return {seed,elapsed:0,steps:0,racers:[pokemon,...others.map(p=>p.id)].map(id=>({pokemon:id,position:0,speed:0,finish:null})),questionIndex:0,correct:0,streak:0,bestStreak:0,fastest:null,questionAt:0,boostLeft:0,boostPower:0,finished:false};}
export function raceAnswer(r:MeadowRace,correct:boolean,responseSeconds:number){if(r.finished||r.questionIndex>=RACE.questions)return;
 r.questionIndex++;r.questionAt=r.elapsed;
 if(correct){r.correct++;r.streak++;r.bestStreak=Math.max(r.bestStreak,r.streak);r.fastest=Math.min(r.fastest??Infinity,responseSeconds);r.boostPower=RACE.boost+RACE.responseBonus*Math.max(0,1-responseSeconds/18)+(r.streak%3===0?RACE.comboBonus:0);r.boostLeft=Math.min(RACE.boostSeconds*RACE.questions,r.boostLeft+RACE.boostSeconds);}else{r.streak=0;}
}
export function advanceRace(r:MeadowRace,toElapsed:number){const target=Math.floor(Math.max(0,Math.min(300,toElapsed))/RACE.step+1e-7);while(r.steps<target&&!r.finished){r.steps++;r.elapsed=r.steps*RACE.step;const player=r.racers[0],leader=Math.max(...r.racers.map(p=>p.position));
 for(let i=0;i<r.racers.length;i++){const p=r.racers[i];if(p.finish!==null)continue;let targetSpeed:number;
 if(i===0){targetSpeed=RACE.playerSpeed+Math.min(RACE.catchUp,Math.max(0,leader-p.position-25)/65)+(r.boostLeft>0?r.boostPower*Math.min(1,r.boostLeft/.7):0);if(r.questionIndex<10){const pace=(r.questionIndex+1)/11*RACE.distance;if(p.position>pace)targetSpeed*=Math.max(.12,1-(p.position-pace)/80);}}
 else{const personality=(random(r.seed,i)-.5)*2;const variance=Math.sin(r.elapsed/(5+i)+i*2)*RACE.aiVariance;targetSpeed=RACE.aiSpeed+personality*.55+variance;const lead=p.position-player.position;
 targetSpeed+=Math.max(-3.5,Math.min(1.9,(player.position-p.position)/70));
 if(lead>RACE.maxLead)targetSpeed*=Math.max(.18,1-(lead-RACE.maxLead)/90);
 // Pace early race against answered questions, but let very slow races conclude.
 const pace=Math.max((r.questionIndex+1)/11*RACE.distance,r.elapsed/RACE.grace*RACE.distance);
 if(p.position>pace)targetSpeed*=Math.max(.15,1-(p.position-pace)/80);
 // A small seeded competitive field keeps strong races winnable, not guaranteed.
 if(r.questionIndex>=3&&random(r.seed,99)>.9&&i===1)targetSpeed=36;if(r.questionIndex===10)targetSpeed+=(10-r.correct)*(.4+random(r.seed,67)*1.1);if(r.elapsed>=RACE.grace)targetSpeed=Math.max(targetSpeed,12);
 }
 // Smooth final approach while questions remain; time-based release prevents an endless invisible wall.
 if(r.questionIndex<10&&r.elapsed<RACE.grace&&p.position>RACE.distance-100)targetSpeed*=Math.max(.000001,(RACE.distance-p.position)/(i===0?180:100));
 if(r.questionIndex===RACE.questions)targetSpeed+=RACE.finalSprint*(i===0?1:.65);
 if(i>0&&r.elapsed<RACE.grace&&p.position-player.position>RACE.maxLead)targetSpeed=Math.min(targetSpeed,Math.max(.2,player.speed+(RACE.maxLead-(p.position-player.position))/4));
 targetSpeed=Math.max(.05,Math.min(RACE.maxSpeed,targetSpeed));const change=RACE.acceleration*RACE.step;p.speed+=Math.max(-change,Math.min(change,targetSpeed-p.speed));
 const remaining=RACE.distance-p.position;const travel=p.speed*RACE.step;const gated=r.questionIndex<10&&r.elapsed<RACE.grace;p.position+=gated?remaining*(-Math.expm1(-travel/remaining)):travel;if(p.position>=RACE.distance){p.position=RACE.distance;p.finish=r.elapsed;}
 }
 r.boostLeft=Math.max(0,r.boostLeft-RACE.step);
 // Player finishes, or all opponents finish: a clear finish/loss condition.
 r.finished=player.finish!==null||r.racers.slice(1).every(p=>p.finish!==null);
 }return r;}
export function raceRank(r:MeadowRace){return r.racers.map((p,i)=>({index:i,...p})).sort((a,b)=>a.finish!==null&&b.finish!==null?a.finish-b.finish:a.finish!==null?-1:b.finish!==null?1:b.position-a.position||a.index-b.index);}
export function raceSummary(r:MeadowRace){return {place:raceRank(r).findIndex(p=>p.index===0)+1,correct:r.correct,answered:r.questionIndex,accuracy:r.questionIndex?Math.round(r.correct/r.questionIndex*100):0,fastest:r.fastest,bestStreak:r.bestStreak,duration:r.elapsed,rewardPoints:0};}
