# BBQお買い物サポートアプリ

BBQ・キャンプの買い出し担当向けの買い物リスト自動生成＆共有アプリ。参加人数（大人・子供）を入力すると、原単位データに基づいて品目ごとの必要量・購入数量・予算を自動計算し、8桁の共有コードで複数人がリアルタイムに購入チェックを共有できます。

詳細な要件は [docs/requirements.md](docs/requirements.md) を参照してください（機能要件・非機能要件・データモデル・確定事項を網羅）。

## 主な機能

- 参加人数（大人・子供）に応じた買い物リストの自動生成
- 数量の増減・品目の追加削除などの手動編集
- OpenAI API による自然言語でのリスト修正（例：「子供を3人増やして」）
- 8桁の共有コードによる、認証不要のリスト共有
- Supabase Realtime による購入チェック状態のリアルタイム同期（1秒以内を目標）
- 購入進捗50%以上・19時以降に表示されるフィードバックアンケート

## 技術スタック

- **フロントエンド／API**: Next.js（`app/` 配下、App Router）
- **DB**: Supabase PostgreSQL（Prisma 7 + `@prisma/adapter-pg`）
- **リアルタイム同期**: Supabase Realtime Broadcast（フォールバックとして15秒ポーリング）
- **AI連携**: OpenAI API（自然言語によるリスト修正）

## セットアップ

```bash
cd app
npm install
```

`app/.env` を作成し、以下の環境変数を設定してください（値はコミットしないこと）。

| 変数名 | 用途 |
|---|---|
| `DATABASE_URL` | Supabase Transaction pooler（:6543、アプリ実行時の接続） |
| `DIRECT_URL` | Supabase Session pooler（:5432、`prisma migrate` 用） |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Realtime Broadcast 用（anon key のみ使用。`service_role` キーは不可） |
| `OPENAI_API_KEY` | リスト修正のAI連携用 |
| `DATA_PASSWORD` | `local/` 暗号化バックアップ（`data/local.enc`）の復号用パスワード |

マイグレーションと原単位マスタの投入:

```bash
npx prisma migrate dev
npm run db:seed
```

`npm run db:seed` には `local/data/shopping_list.csv` が必要です。この秘密データは Git 管理外のため、`npm run data:decrypt` で `data/local.enc` から復元するか、同じ列構成のダミーデータを自分で用意してください（列定義は [app/prisma/seed.ts](app/prisma/seed.ts) を参照）。

開発サーバーの起動:

```bash
npm run dev
```

## 開発コマンド（`app/` で実行）

- `npm run dev` — 開発サーバー起動
- `npm run build` — 本番ビルド（型チェック込み）
- `npm run lint` — Lint実行
- `npx prisma migrate dev` — スキーマ変更時のマイグレーション
- `npm run db:seed` — 原単位マスタをDBへ投入
- `npm run data:encrypt` / `npm run data:decrypt` — `local/` と `data/local.enc` 間の暗号化バックアップ・復元

## 秘密データの取り扱い

このリポジトリは MIT ライセンスで public 公開されています。`local/` および `local_ref/`（実績の買い出しデータ・原単位の元データ）は `.gitignore` で除外されており、暗号化された `data/local.enc` としてのみコミットされます。詳細は [data/README.md](data/README.md) を参照してください。

このルールを含む開発ガイドラインの詳細は [CLAUDE.md](CLAUDE.md) を参照してください。

## ライセンス

[MIT License](LICENSE)
