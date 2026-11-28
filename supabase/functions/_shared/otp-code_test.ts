import {assertEquals} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {sixDigitCode} from './otp-code.ts';
Deno.test('Authentication codes retain exactly six digits at both boundaries',()=>{
 assertEquals(sixDigitCode(bytes=>{bytes[0]=0;return bytes;}),'100000');
 assertEquals(sixDigitCode(bytes=>{bytes[0]=899999;return bytes;}),'999999');
});
Deno.test('Authentication code generation rejects biased overflow samples',()=>{
 let calls=0;
 assertEquals(sixDigitCode(bytes=>{bytes[0]=calls++===0?0xffffffff:1;return bytes;}),'100001');
 assertEquals(calls,2);
});