const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKeys = process.env.SUPABASE_SECRET_KEYS;

const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || (() => {
  if (!supabaseSecretKeys) return undefined;
  try {
    const keys = JSON.parse(supabaseSecretKeys);
    return keys.service_role || keys.anon || keys.SUPABASE_SERVICE_ROLE_KEY || keys.SUPABASE_ANON_KEY;
  } catch {
    return undefined;
  }
})();

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEYS in backend/.env');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

module.exports = supabase;

