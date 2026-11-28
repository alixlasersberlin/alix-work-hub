import {assertEquals} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {JourneyInput} from './input.ts';
Deno.test('Existing journey schedule payload remains executable after validation',()=>{
  assertEquals(JourneyInput.safeParse({source:'cron'}).success,true);
  assertEquals(JourneyInput.safeParse({source:'cron',service_role:true}).success,false);
  assertEquals(JourneyInput.safeParse({dry_run:true}).success,true);
});