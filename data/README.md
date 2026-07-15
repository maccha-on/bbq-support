# data/local.enc について

`local.enc` は、Git 管理外ディレクトリ `local/`（原単位の実データなどの秘密データ）全体を暗号化した単一アーカイブです。ファイル名を含む全内容が暗号化されており、パスワードなしに中身を知ることはできません。

- 暗号方式: scrypt（N=2^17, r=8, p=1）による鍵導出 + AES-256-GCM（認証付き暗号）
- パスワード: 環境変数 `DATA_PASSWORD`（`app/.env`、Git 管理外）
- 生成・復元ツール: [app/scripts/local-data.ts](../app/scripts/local-data.ts)

## 使い方（`app/` ディレクトリで実行）

```bash
# local/ を暗号化して data/local.enc を更新（local/ の内容を変更したら実行してコミット）
npm run data:encrypt

# data/local.enc から local/ を復元（新しい開発環境のセットアップ時）
npm run data:decrypt

# 既存の local/ に上書き復元する場合
npm run data:decrypt -- --force
```

パスワードを共有されていない第三者はこのファイルを復号できません。復号せずにアプリを動かす場合は、`local/data/shopping_list.csv` と同じ列構成のサンプルデータを各自用意してください（列定義は [app/prisma/seed.ts](../app/prisma/seed.ts) を参照）。
