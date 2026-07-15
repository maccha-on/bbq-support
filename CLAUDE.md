# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

BBQお買い物サポートアプリ。参加人数（大人・子供）から原単位データに基づいて買い物リストを自動生成し、8桁の共有コードで複数人がリアルタイムに購入チェックを共有できるようにする。詳細な要件は [docs/requirements.md](docs/requirements.md) を参照（機能要件・非機能要件・データモデル・確定事項がすべてここにある）。

技術スタック: Next.js（フロント＋API Routes、`app/` 配下）、Supabase PostgreSQL（Prisma 7 + `@prisma/adapter-pg` 経由）、Supabase Realtime Broadcast（チェック状態のpush同期。フォールバックとして15秒ポーリング）、OpenAI API（自然言語によるリスト修正）。

### 開発コマンド（app/ で実行）

- `npm run dev` — 開発サーバー起動
- `npm run build` — 本番ビルド（型チェック込み）
- `npx prisma migrate dev` — スキーマ変更時のマイグレーション（`DIRECT_URL` 接続で実行される）
- `npm run db:seed` — 原単位マスタを DB へ投入（`local/data/shopping_list.csv` が必要）

### 環境変数（app/.env、Git 管理外。値は絶対にコミットしない）

- `DATABASE_URL` — Supabase Transaction pooler（:6543、アプリ実行時）
- `DIRECT_URL` — Supabase Session pooler（:5432、prisma migrate 用）
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Realtime Broadcast 用（anon key は公開前提の鍵。`service_role` キーは使わない）
- `OPENAI_API_KEY` / `DATA_PASSWORD`

### Supabase プロジェクト共有時の注意

Supabase プロジェクトは複数サービスで共有するため、本アプリの DB オブジェクトは **`bbq_` 接頭辞**（`bbq_lists` 等、`schema.prisma` の `@@map` で対応）、Realtime チャンネルは **`bbq:list:{shareCode}`** 形式とし、他サービスと衝突させない。新しいテーブル・チャンネルを追加する際も必ずこの接頭辞を付けること。

## 秘密データの取り扱い（最重要）

このリポジトリは **MITライセンスで GitHub に public 公開する方針**。コミットした内容はすべて公開され、誰でも自由に利用できる状態になる。そのため以下を厳守する（要件書 NFR-2 参照）:

- `local/` と `local_ref/` は**秘密データ**（実績の買い出しデータ、原単位の元データ）。`.gitignore` で除外済みであり、**絶対にコミット・push しない**。`git add -A` や `-f` 付きの add で誤って含めないこと。
- `local/` 内の実データ（品目ごとの数量・単価・係数など）を、コード・ドキュメント・コミットメッセージ・テストデータへ**転記しない**。原単位データは DB 側に保持し、リポジトリに含めるのはサンプル／ダミーデータのみとする。
- OpenAI API キー等の秘匿情報は環境変数（`.env`、Git 管理外）で管理する。
- 共有コードの生成方式について、推測の手がかりになる情報（シード値・弱点の記述など）をリポジトリに残さない。

`local/` のデータは要件検討やロジック設計の**参照用**として読むのは問題ないが、出力先（コミットされるファイル）に実値を書かないこと。

### 秘密データの暗号化バックアップ（data/local.enc）

`local/` の内容は `data/local.enc`（scrypt + AES-256-GCM で暗号化した単一アーカイブ）としてのみコミットする。詳細は [data/README.md](data/README.md) を参照。

- `local/` の内容を変更したら `app/` で `npm run data:encrypt` を実行し、更新された `data/local.enc` をコミットする
- 新しい環境では `npm run data:decrypt` で `local/` を復元する（既存の `local/` がある場合は `--force` が必要）
- パスワードは `app/.env` の `DATA_PASSWORD`。**20文字以上のランダム文字列を維持**し、値をコード・ドキュメント・コミットに書かない。public リポジトリ上の暗号文は恒久的に総当たり攻撃の対象になるため、パスワード変更で守れるのは push 前のみ

## 設計上の確定事項

実装時に迷いやすい点は要件書で確定済み。主なもの:

- 認証なし。8桁共有コードがアクセスキーを兼ねる（総当たり耐性のあるランダム生成が必要）
- 編集競合は Last Write Wins（競合制御なし）
- AI によるリスト修正は 1 リストあたり累計 30 回まで
- モバイルファースト（スマホ表示・操作を最優先）
- チェック状態の共有は 1 秒以内の反映が目標
