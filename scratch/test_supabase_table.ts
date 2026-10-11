import { getServerSupabase } from '../src/server/supabase';

async function test() {
  const supabase = getServerSupabase();
  const { data, error } = await supabase.from('action_guidance').select('id').limit(1);
  console.log('Query action_guidance:', { data, error });
}

test();
