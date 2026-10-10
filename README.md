# 深海フィッシング：アビス・ハンター (ABYSS HUNTER)

発光ルアーを暗黒の深海へ沈め、機雷を避けて最深部へダイブ！帰りの巻き上げでは発光深海魚・リュウグウノツカイ・古代の怪物を次々フックに引っ掛けて一気に水面へ引き上げ、空中でプラズマ砲を乱射して報酬を3倍にする3段階快感フィッシングアクション。

- **ジャンル**: 深海ダイブ＆一網打尽フィッシングアクション
- **対象端末**: iPhone 17 シリーズ（iOS 26 Safari 縦画面）
- **本番 URL（予定）**: https://fishing-abyss-hunter.minicity-cloud.workers.dev
- **共通基盤**: たかGames（`taka-games`）共通アカウント & D1（`farm-farm-happy-db`）連携済み
- **企画・仕様・検証基準**: [PLAN.md](./PLAN.md) / [CLAUDE.md](./CLAUDE.md)

## 開発コマンド

```bash
npm.cmd install
npm.cmd run dev          # 開発サーバー起動 (http://localhost:8803)
npm.cmd run db:local     # ローカルD1に schema.sql を適用
npm.cmd run db:remote    # 本番D1に schema.sql を適用
npm.cmd run deploy       # Cloudflare Workersにデプロイ
npm.cmd run icons        # アプリアイコンPNG再生成
```
