import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://zzjsasafuafekoybeaef.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6anNhc2FmdWFmZWtveWJlYWVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyMDM3NzUsImV4cCI6MjEwNjc3OTc3NX0.aPBeHRItRYLLhXgg6r0Hzd2c7BF94-taR_T_Fsfowuc'
);

async function check() {
  const { data, error } = await supabase.rpc('get_foreign_keys');
  // If rpc fails, we can just do a REST query if they have a view. But they don't.
  // We can't query information_schema directly via supabase-js without a custom RPC or using the Postgres connection string.
}

check();
