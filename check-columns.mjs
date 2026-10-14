import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  'https://ftjznkianxklloxwxnjc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0anpua2lhbnhrbGxveHd4bmpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExMTQ5NTMsImV4cCI6MjEwNjY5MDk1M30.6_XV1eitUnFtNfTX15EewGB5FcuiRqTRsedNcRPQt5A'
);
async function checkColumns() {
  const { error } = await supabase.from('users').insert([{ fake_column: 1 }]);
  console.log('Insert Error:', error);
}
checkColumns();
