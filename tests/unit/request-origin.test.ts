import {describe,it,expect} from 'vitest';
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
