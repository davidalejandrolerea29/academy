import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://mwoyahbkirqtgecfnkrv.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13b3lhaGJraXJxdGdlY2Zua3J2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgzMTEyMDAsImV4cCI6MjA2Mzg4NzIwMH0.HuPtihiridZRK5M2Pmh9lmr5XpuGtUvDxMA9I4CI1II";
//const supabaseServiceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13b3lhaGJraXJxdGdlY2Zua3J2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODMxMTIwMCwiZXhwIjoyMDYzODg3MjAwfQ.H_n_8NqhCFY8FkxlomC9biaE3dagPg-CE4owlbRfFK8";

if (!supabaseUrl || !supabaseAnonKey ) {
  throw new Error('Missing Supabase environment variables');
}

// Cliente público
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Cliente admin (con service role)

