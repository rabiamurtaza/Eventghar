import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://zzjsasafuafekoybeaef.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6anNhc2FmdWFmZWtveWJlYWVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyMDM3NzUsImV4cCI6MjEwNjc3OTc3NX0.aPBeHRItRYLLhXgg6r0Hzd2c7BF94-taR_T_Fsfowuc'
);

async function check() {
  const email = `testuser_${Date.now()}@gmail.com`;
  const { data, error } = await supabase.auth.signUp({
    email,
    password: 'password123',
    options: {
      data: {
        full_name: 'Test',
        phone_number: '12345678901',
        role: 'user'
      }
    }
  });

  console.log('Signup error:', error);
  console.log('Signup data user ID:', data?.user?.id);

  if (data?.user?.id) {
    const { data: users, error: selectErr } = await supabase.from('users').select('*').eq('id', data.user.id);
    console.log('Select users error:', selectErr);
    console.log('Found in users table:', users);
  }
}

check();
