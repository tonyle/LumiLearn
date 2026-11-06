import {describe,it,expect,afterEach,vi} from 'vitest';
afterEach(() => vi.unstubAllEnvs());
import {hasSameOrigin} from '@/lib/request-origin';
function request(headers:Record<string,string>){return new Request('http://0.0.0.0:3000/api/parent/students/test',{headers});}
describe('browser request origin',()=>{
 it('accepts LAN and localhost browser hosts behind standalone Docker',()=>{
  expect(hasSameOrigin(request({host:'192.168.1.16:3000',origin:'http://192.168.1.16:3000'}))).toBe(true);
  expect(hasSameOrigin(request({host:'localhost:3000',origin:'http://localhost:3000'}))).toBe(true);
 });
 it('rejects foreign origins, wrong ports, null and spoofed forwarded hosts',()=>{
  for(const origin of ['http://evil.example','http://192.168.1.16:4000','null'])expect(hasSameOrigin(request({host:'192.168.1.16:3000',origin}))).toBe(false);
  expect(hasSameOrigin(request({host:'localhost:3000','x-forwarded-host':'evil.example',origin:'http://evil.example'}))).toBe(false);
 });
 it('keeps non-browser clients working and rejects explicit cross-site requests',()=>{
  expect(hasSameOrigin(request({}))).toBe(true);
  expect(hasSameOrigin(request({'sec-fetch-site':'cross-site'}))).toBe(false);
 });
});

describe('authenticated LAN HTTPS proxy',()=>{
 const secret='a'.repeat(48);
 const headers={host:'192.168.1.16:3443',origin:'https://192.168.1.16:3443','x-forwarded-proto':'https','x-internal-proxy-secret':secret};
 function configure(){vi.stubEnv('INTERNAL_PROXY_SECRET',secret);vi.stubEnv('IPAD_APP_URL','https://192.168.1.16:3443');}
 it('accepts an authenticated proxy with the configured public HTTPS host',()=>{
  configure(); expect(hasSameOrigin(request(headers))).toBe(true);
 });
 it('rejects spoofed forwarding, absent or wrong secrets and unconfigured hosts',()=>{
  configure();
  expect(hasSameOrigin(request({...headers,'x-internal-proxy-secret':''}))).toBe(false);
  expect(hasSameOrigin(request({...headers,'x-internal-proxy-secret':'b'.repeat(48)}))).toBe(false);
  expect(hasSameOrigin(request({...headers,host:'evil.example',origin:'https://evil.example'}))).toBe(false);
  expect(hasSameOrigin(request({...headers,'x-forwarded-proto':'http'}))).toBe(false);
  vi.stubEnv('INTERNAL_PROXY_SECRET','short');
  expect(hasSameOrigin(request({...headers,'x-internal-proxy-secret':'short'}))).toBe(false);
 });
 it('allows INTERNAL_HTTPS_HOST configuration while retaining direct HTTP support',()=>{
  configure(); vi.stubEnv('IPAD_APP_URL','');vi.stubEnv('INTERNAL_HTTPS_HOST','192.168.1.16:3443');
  expect(hasSameOrigin(request(headers))).toBe(true);
  expect(hasSameOrigin(request({host:'192.168.1.16:3000',origin:'http://192.168.1.16:3000','x-forwarded-proto':'https'}))).toBe(true);
 });
});
