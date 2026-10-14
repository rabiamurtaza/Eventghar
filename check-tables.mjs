import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  'https://ftjznkianxklloxwxnjc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0anpua2lhbnhrbGxveHd4bmpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExMTQ5NTMsImV4cCI6MjEwNjY5MDk1M30.6_XV1eitUnFtNfTX15EewGB5FcuiRqTRsedNcRPQt5A'
);
async function checkTables() {
  const [users, organizers, admins] = await Promise.all([
    supabase.from('users').select('*').limit(1),
    supabase.from('organizers').select('*').limit(1),
    supabase.from('admins').select('*').limit(1)
  ]);
  console.log('users error:', users.error?.message);
  console.log('organizers error:', organizers.error?.message);
  console.log('admins error:', admins.error?.message);
}
checkTables();
