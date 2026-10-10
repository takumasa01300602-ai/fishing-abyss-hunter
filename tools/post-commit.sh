#!/bin/sh
# コミット後に GitHub へ push し、自動デプロイする（失敗してもコミットは取り消されません）
# 無効にしたいとき: SKIP_DEPLOY=1 git commit ... （push もデプロイも行いません）
# ※ これは .git/hooks/post-commit の控えです。別のPCで使うときは .git/hooks/post-commit にコピーしてください。
[ -n "$SKIP_DEPLOY" ] && exit 0
cd "$(git rev-parse --show-toplevel)" || exit 0
echo "[post-commit] git push を実行します..."
git push || echo "[post-commit] push に失敗しました（コミットは完了しています）"
echo "[post-commit] npm run deploy を実行します..."
npm.cmd run deploy || echo "[post-commit] デプロイに失敗しました（コミットは完了しています）"
exit 0
