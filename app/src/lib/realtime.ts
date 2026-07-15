import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Supabaseプロジェクトを他サービスと共有するため、チャンネル名にも bbq: 接頭辞を付ける。
// チャンネル名に共有コードを含める＝「コードを知っている人だけが購読できる」という
// 既存のアクセスモデル（認証なし・共有コードがアクセスキー）に合わせた設計。
export function listChannelName(shareCode: string): string {
  return `bbq:list:${shareCode}`;
}

export const LIST_UPDATED_EVENT = "list-updated";

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!client) client = createClient(url, key);
  return client;
}

// リスト更新のpush通知。データ本体は載せず「更新があった」事実のみ送る
// （受信側がAPI経由で再取得するため、仮に部外者に購読されても漏れる情報がない）。
// 未subscribeチャンネルからのsend()はWebSocketではなくHTTP POSTで送信される。
// 送信失敗は握りつぶす: クライアント側のフォールバックポーリングが保険になる。
export async function notifyListUpdated(shareCode: string): Promise<void> {
  const supabase = getClient();
  if (!supabase) return;
  try {
    const channel = supabase.channel(listChannelName(shareCode));
    await channel.httpSend(LIST_UPDATED_EVENT, {});
    await supabase.removeChannel(channel);
  } catch {
    // noop
  }
}
