import {readFile,writeFile} from 'node:fs/promises';

// Persist only the detected LAN URL; never print or rewrite other settings.
export async function saveLanUrl(path, value) {
  const url = new URL(value);
  if (url.protocol !== 'http:' || url.port !== '3000' || url.pathname !== '/' || url.search || url.hash || url.username || url.password) throw new Error('Invalid iPad LAN URL');
  const source = await readFile(path, 'utf8');
  const setting = `IPAD_APP_URL=${url.origin}`;
  const updated = /^IPAD_APP_URL=.*$/m.test(source)
    ? source.replace(/^IPAD_APP_URL=.*$/gm, setting)
    : `${source}${source.endsWith('\n') ? '' : '\n'}${setting}\n`;
  await writeFile(path, updated);
}
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  await saveLanUrl('.env', process.env.IPAD_APP_URL);
}
