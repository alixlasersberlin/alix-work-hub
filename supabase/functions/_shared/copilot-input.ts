import { z } from 'npm:zod@3';
export const CopilotInput = z.object({
  messages:z.array(z.object({role:z.enum(['user','assistant']),content:z.string().min(1).max(16000)}).strict()).min(1).max(40),
  page:z.string().max(200).optional(),tenantSources:z.array(z.string().max(50)).max(20).nullable().optional(),
});
export function copilotSources(assigned:string[],requested:unknown):string[] | null {
  if (!assigned.length) return null;
  if (requested == null || (Array.isArray(requested) && requested.length===0)) return [...new Set(assigned)];
  return Array.isArray(requested) && requested.every(s=>typeof s==='string' && assigned.includes(s)) ? [...new Set(requested)] : null;
}