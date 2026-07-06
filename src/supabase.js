import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://uqevgdliksjfhgtrbnwp.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_PfP_BHdtE5l-KJHckT_0wA_M3LH3RO6';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
