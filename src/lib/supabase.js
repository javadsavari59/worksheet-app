import { createClient } from '@supabase/supabase-js';

// ⚠️ این دو مقدار را با مقادیر خودتان جایگزین کنید
const SUPABASE_URL = 'https://dmbsdnbzrqjbheaelhlk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_UJ86kK_kkRteGAVAgH51pA_e9D2SliF';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);