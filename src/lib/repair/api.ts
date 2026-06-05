import { supabase } from '@/integrations/supabase/client';

/**
 * Typed-loose accessor for new repair_* tables until generated types include them.
 */
export const sbRepair = supabase as unknown as {
  from: (table: string) => any;
  storage: typeof supabase.storage;
  auth: typeof supabase.auth;
};
