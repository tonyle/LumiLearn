// Integer comparisons avoid rounding a score up across a reward boundary.
export function worksheetReward(earned:number,maximum:number){
 if(!Number.isFinite(earned)||!Number.isFinite(maximum)||maximum<=0||earned<0||earned>maximum)return 0;
 return earned===maximum?3:earned*100>=maximum*80?2:earned*100>=maximum*70?1:0;
}
