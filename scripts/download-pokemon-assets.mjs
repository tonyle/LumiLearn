import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const root=path.resolve('public/pokemon');await mkdir(root,{recursive:true});
const manifest=[];
for(const [id,name] of [[25,'Pikachu'],[6,'Charizard'],[9,'Blastoise'],[3,'Venusaur'],[448,'Lucario']]){
 const filename=`${id}.webp`,destination=path.join(root,filename);let data;
 try{data=await readFile(destination);const meta=await sharp(data).metadata();if(meta.format!=='webp'||!meta.width)throw Error('Invalid cache');console.log(`Cached: ${name}`);}
 catch{const url=`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;let error;
 for(let attempt=0;attempt<3;attempt++){try{const response=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error(`HTTP ${response.status}`);const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>5_000_000)throw Error('Image too large');data=await sharp(bytes,{limitInputPixels:4_000_000}).resize(475,475,{fit:'inside',withoutEnlargement:true}).webp({quality:88}).toBuffer();break;}catch(e){error=e;}}
 if(!data)throw Error(`Could not download ${name}: ${error}. Retry npm run assets:pokemon before deploying.`);await writeFile(destination+'.tmp',data);await rename(destination+'.tmp',destination);console.log(`Downloaded: ${name}`);}
 manifest.push({id,name,file:filename,sha256:createHash('sha256').update(data).digest('hex'),source:`https://github.com/PokeAPI/sprites/blob/master/sprites/pokemon/other/official-artwork/${id}.png`});
}
await writeFile(path.join(root,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
