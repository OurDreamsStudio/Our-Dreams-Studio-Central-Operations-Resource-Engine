const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rxmnvgutouhtynkuuqiq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4bW52Z3V0b3VodHlua3V1cWlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NjcwMzAsImV4cCI6MjA4OTU0MzAzMH0.YSe6L929mSoZxQANpobzEvK66enlCOkPfq-pPrAcq2Y';

const sb = createClient(supabaseUrl, supabaseKey);

async function testLogin() {
  console.log('Testing Supabase connection...');
  try {
    const { data, error } = await sb.auth.signInWithPassword({
      email: 'atendimentoourdreams@gmail.com',
      password: 'LifeCenter@*2006',
    });
    if (error) {
      console.log('AUTH_ERROR:', error.message, '| status:', error.status, '| code:', error.code);
    } else {
      console.log('AUTH_SUCCESS | user:', data.user?.email);
    }
  } catch (e) {
    console.log('FATAL:', e.message);
  }
}

testLogin().then(() => process.exit(0));
