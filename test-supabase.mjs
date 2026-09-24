import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vvnwcxtfjwgtehofdwuq.supabase.co';
const supabaseAnonKey = 'sb_publishable_rbBnAhq05X6QmtX-kV-5BA_6HqQY5vy';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
  console.log('🔍 Testing Supabase connection...\n');
  console.log('📡 URL:', supabaseUrl);
  console.log('🔑 Key:', supabaseAnonKey.slice(0, 30) + '...\n');

  // Test 1: Basic connection - try to list tables
  console.log('--- Test 1: Listing tables in public schema ---');
  const { data: tables, error: tablesError } = await supabase
    .from('evaluations')
    .select('*')
    .limit(1);

  if (tablesError) {
    console.error('❌ evaluations table error:', tablesError.message);
    console.error('   Code:', tablesError.code);
    console.error('   Hint:', tablesError.hint || 'N/A');
  } else {
    console.log('✅ evaluations table accessible! Rows returned:', tables?.length ?? 0);
    if (tables?.length > 0) {
      console.log('   Sample columns:', Object.keys(tables[0]).join(', '));
    }
  }

  // Test 2: Check auth service
  console.log('\n--- Test 2: Auth service ---');
  const { data: session, error: authError } = await supabase.auth.getSession();
  if (authError) {
    console.error('❌ Auth error:', authError.message);
  } else {
    console.log('✅ Auth service working. Session:', session?.session ? 'active' : 'none (anonymous)');
  }

  // Test 3: Try insert a test record
  console.log('\n--- Test 3: Test INSERT to evaluations ---');
  const testRecord = {
    employee_id: 'test-connection-check',
    employee_name: 'Test Connection',
    evaluator_role: 'SYSTEM',
    evaluator_email: 'system@test.com',
    department: 'Test Department',
    status: 'DRAFT',
    classification: 'Good',
    details: JSON.stringify({ test: true }),
    performance_score: 75
  };

  const { data: insertData, error: insertError } = await supabase
    .from('evaluations')
    .insert([testRecord])
    .select();

  if (insertError) {
    console.error('❌ INSERT error:', insertError.message);
    console.error('   Code:', insertError.code);
    console.error('   Details:', insertError.details || 'N/A');
    console.error('   Hint:', insertError.hint || 'N/A');
  } else {
    console.log('✅ INSERT successful!', insertData);
    
    // Cleanup test record
    if (insertData?.[0]?.id) {
      await supabase.from('evaluations').delete().eq('id', insertData[0].id);
      console.log('🧹 Test record cleaned up.');
    }
  }

  console.log('\n=== Summary ===');
  const allOk = !tablesError && !authError && !insertError;
  if (allOk) {
    console.log('🎉 Supabase is fully connected and working!');
  } else {
    console.log('⚠️  Some issues found. Check errors above.');
  }
}

testConnection().catch(console.error);
