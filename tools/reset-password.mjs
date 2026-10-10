// パスワードを忘れた人のためのリセット用スクリプト（管理者=あなたのPCで実行）
import { pbkdf2Sync, randomBytes, createHash } from 'node:crypto';

const [, , nameArg, pwArg] = process.argv;
if (!nameArg || !pwArg) {
  console.log('使い方: node tools/reset-password.mjs <ユーザー名> <新しいパスワード>');
  process.exit(1);
}
const NAME_RE = /^[A-Za-z0-9_\-ぁ-ゖァ-ヺー㐀-䶿一-鿿]+$/;
const name = nameArg.normalize('NFKC').trim();
if ([...name].length < 2 || [...name].length > 16 || !NAME_RE.test(name)) {
  console.log('ユーザー名の形式が正しくありません');
  process.exit(1);
}
if (pwArg.length < 8) {
  console.log('パスワードは8文字以上にしてください');
  process.exit(1);
}
const ukey = name.toLowerCase();
const key = pbkdf2Sync(pwArg.normalize('NFKC'), 'minicity-v1:' + ukey, 600000, 32, 'sha256').toString('hex');
const salt = randomBytes(16).toString('hex');
const hash = createHash('sha256').update(salt + key).digest('hex');

console.log('\n次の2つを順番に実行してください（データベース名を変えた場合は farm-farm-happy-db を置き換え）\n');
console.log(`npx.cmd wrangler d1 execute farm-farm-happy-db --remote --command "UPDATE users SET salt='${salt}', hash='${hash}' WHERE ukey='${ukey}'"\n`);
console.log(`npx.cmd wrangler d1 execute farm-farm-happy-db --remote --command "DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE ukey='${ukey}')"\n`);
