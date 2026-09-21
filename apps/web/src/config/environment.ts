export const environment = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string | undefined,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined,
};

export function assertPublicSupabaseConfig() {
  if (!environment.supabaseUrl || !environment.supabaseAnonKey) {
    throw new Error('Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no ambiente da nova aplicação.');
  }
}
