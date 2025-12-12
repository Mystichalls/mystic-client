// lib/supabase.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Simpele, rechtstreekse Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,        // sessie opslaan in localStorage
    detectSessionInUrl: true,    // tokens uit magic link automatisch verwerken
    autoRefreshToken: true,
  },
});
