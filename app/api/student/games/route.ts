import {magicSummary} from '@/lib/magic-store';
import {gameSession,gameWallet,topFly} from '@/lib/games';import {ok} from '@/lib/http';import {resourceError} from '@/lib/resource-store';
export async function GET(){try{const s=await gameSession();return ok({wallet:await gameWallet(s.studentId!),magicProgress:await magicSummary(s.studentId!),leaders:await topFly(),dashLeaders:await topFly('dash'),meadowLeaders:await topFly('math20'),factsLeaders:await topFly('mathfacts')});}catch(e){return resourceError(e);}}
