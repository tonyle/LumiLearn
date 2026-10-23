import {mutateResource} from '@/lib/resource-mutation';export const runtime='nodejs';export const maxDuration=180;export async function POST(request:Request){return mutateResource(request);}
