import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ブラウザ用Supabaseクライアント（Realtime購読専用）。
// anon keyは公開前提の鍵。DBへのアクセスは従来どおりAPI Routes経由で行い、
// このクライアントはBroadcastチャンネルの購読にのみ使う。
let client: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!client) client = createClient(url, key);
  return client;
}
