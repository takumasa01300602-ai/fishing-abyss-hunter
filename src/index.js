/**
 * 深海フィッシング：アビス・ハンター（fishing-abyss-hunter）アカウント & 記録 API（Cloudflare Workers + D1）
 *
 * ・アカウントは taka-games（および farm-farm-happy / yubisaki-panic / fortress-of-runes / dead-bridge-overdrive / sugar-stack 等）と共通です。
 *   同じ D1（farm-farm-happy-db）を使い、認証まわりの処理（キーの形式・ソルト・セッション）も共通仕様です。
 * ・メールアドレス不要。ユーザー名 + パスワード。
 * ・パスワードはブラウザ側で PBKDF2(60万回) を計算し、その結果（キー）だけを送信します。
 *   Workers無料プランはCPU時間が10msなので、サーバー側で重いハッシュを計算できないためです。
 *   サーバーは受け取ったキーを SHA-256(ソルト+キー) にして保存します。
 */

const SESSION_MS = 60 * 24 * 3600 * 1000;      // ログインの有効期間 60日
const MAX_SESSIONS_PER_USER = 10;
const NAME_RE = /^[A-Za-z0-9_\-ぁ-ゖァ-ヺー㐀-䶿一-鿿]+$/;
const KEY_RE = /^[0-9a-f]{64}$/;
const DUMMY_SALT = '0123456789abcdef0123456789abcdef';

// ===== 共通ユーティリティ =====
const enc = new TextEncoder();

class HttpError extends Error {
  constructor(status, code, message, extra) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra || {};
  }
}

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const sha256hex = async (s) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
const randHex = (n) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return hex(a); };
const safeEq = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
};

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers }
  });
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin) return {};
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (origin === new URL(request.url).origin || allowed.includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin'
    };
  }
  return {};
}

async function readJson(request, max) {
  const len = Number(request.headers.get('Content-Length') || 0);
  if (len > max) throw new HttpError(413, 'too_large', 'データが大きすぎます');
  const text = await request.text();
  if (text.length > max) throw new HttpError(413, 'too_large', 'データが大きすぎます');
  try {
    const v = JSON.parse(text || '{}');
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('not object');
    return v;
  } catch (e) {
    throw new HttpError(400, 'bad_json', 'リクエストの形式が正しくありません');
  }
}

const normName = (s) => String(s == null ? '' : s).normalize('NFKC').trim();
function checkName(s) {
  const name = normName(s);
  const len = [...name].length;
  if (len < 2 || len > 16 || !NAME_RE.test(name)) {
    throw new HttpError(400, 'bad_name', 'ユーザー名は2〜16文字で、英数字・ひらがな・カタカナ・漢字・_ - が使えます');
  }
  return { name, ukey: name.toLowerCase() };
}
function checkKey(k) {
  if (typeof k !== 'string' || !KEY_RE.test(k)) throw new HttpError(400, 'bad_key', '入力が不正です');
  return k;
}
const clientIp = (request) => request.headers.get('CF-Connecting-IP') || 'unknown';

// ===== 回数制限（総当たり・荒らし対策） =====
async function limitCheck(env, rules, message) {
  const t = Date.now();
  for (const [key, limit] of rules) {
    const r = await env.DB.prepare('SELECT n, reset_at FROM rate WHERE k = ?').bind(key).first();
    if (r && r.reset_at > t && r.n >= limit) {
      throw new HttpError(429, 'too_many', message || 'しばらく待ってからやり直してください');
    }
  }
}
async function limitHit(env, key, windowMs) {
  const t = Date.now();
  await env.DB.prepare(
    'INSERT INTO rate(k, n, reset_at) VALUES(?, 1, ?) ' +
    'ON CONFLICT(k) DO UPDATE SET ' +
    'n = CASE WHEN reset_at <= ? THEN 1 ELSE n + 1 END, ' +
    'reset_at = CASE WHEN reset_at <= ? THEN ? ELSE reset_at END'
  ).bind(key, t + windowMs, t, t, t + windowMs).run();
}
const LOGIN_WINDOW = 15 * 60 * 1000;
const LOGIN_MSG = 'ログインの失敗が続いたため、しばらく待ってからやり直してください';

// ===== セッション =====
async function createSession(env, userId) {
  const token = randHex(32);
  const th = await sha256hex(token);
  const t = Date.now();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO sessions(user_id, token_hash, created_at, last_used, expires_at) VALUES(?,?,?,?,?)')
      .bind(userId, th, t, t, t + SESSION_MS),
    env.DB.prepare(
      'DELETE FROM sessions WHERE user_id = ? AND (expires_at < ? OR id NOT IN ' +
      '(SELECT id FROM sessions WHERE user_id = ? ORDER BY id DESC LIMIT ?))'
    ).bind(userId, t, userId, MAX_SESSIONS_PER_USER)
  ]);
  return token;
}

async function requireUser(request, env) {
  const m = (request.headers.get('Authorization') || '').match(/^Bearer ([0-9a-f]{64})$/);
  if (!m) throw new HttpError(401, 'unauthorized', 'ログインしてください');
  const th = await sha256hex(m[1]);
  const row = await env.DB.prepare(
    'SELECT s.id AS sid, s.last_used, s.expires_at, u.id, u.username, u.ukey ' +
    'FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?'
  ).bind(th).first();
  const t = Date.now();
  if (!row || row.expires_at < t) throw new HttpError(401, 'unauthorized', 'ログインの有効期限が切れました。もう一度ログインしてください');
  if (t - row.last_used > 24 * 3600 * 1000) {
    await env.DB.prepare('UPDATE sessions SET last_used = ?, expires_at = ? WHERE id = ?').bind(t, t + SESSION_MS, row.sid).run();
  }
  return { id: row.id, username: row.username, ukey: row.ukey, sid: row.sid };
}

async function verifyPassword(env, user, key) {
  await limitCheck(env, [['lu:' + user.ukey, 10]], LOGIN_MSG);
  const row = await env.DB.prepare('SELECT salt, hash FROM users WHERE id = ?').bind(user.id).first();
  const ok = row && safeEq(await sha256hex(row.salt + key), row.hash);
  if (!ok) {
    await limitHit(env, 'lu:' + user.ukey, LOGIN_WINDOW);
    throw new HttpError(403, 'bad_password', '現在のパスワードが違います');
  }
}

// ===== アカウント =====
async function register(request, env) {
  if (String(env.REGISTRATION_OPEN) === 'false') {
    throw new HttpError(403, 'closed', '現在、新規登録を受け付けていません');
  }
  const b = await readJson(request, 2000);
  const { name, ukey } = checkName(b.username);
  const key = checkKey(b.key);
  const ip = clientIp(request);

  await env.DB.prepare('DELETE FROM rate WHERE reset_at < ?').bind(Date.now()).run();
  await limitCheck(env, [['rg:' + ip, 10]], '登録の試行が多すぎます。1時間ほど待ってからやり直してください');
  await limitHit(env, 'rg:' + ip, 3600 * 1000);

  const code = normName(env.INVITE_CODE);
  if (!code) throw new HttpError(403, 'no_invite_config', '招待コードが設定されていません。管理者に連絡してください');
  const given = normName(b.invite);
  if (!given || !safeEq(await sha256hex(given), await sha256hex(code))) {
    throw new HttpError(403, 'bad_invite', '招待コードが違います');
  }

  const max = Number(env.MAX_USERS) || 60;
  const c = await env.DB.prepare('SELECT COUNT(*) AS c FROM users').first();
  if (c.c >= max) throw new HttpError(403, 'full', '登録できる人数の上限に達しています');

  const exists = await env.DB.prepare('SELECT id FROM users WHERE ukey = ?').bind(ukey).first();
  if (exists) throw new HttpError(409, 'taken', 'そのユーザー名はすでに使われています');

  const salt = randHex(16);
  const hash = await sha256hex(salt + key);
  let id;
  try {
    const r = await env.DB.prepare('INSERT INTO users(username, ukey, salt, hash, created_at) VALUES(?,?,?,?,?)')
      .bind(name, ukey, salt, hash, Date.now()).run();
    id = r.meta.last_row_id;
  } catch (e) {
    throw new HttpError(409, 'taken', 'そのユーザー名はすでに使われています');
  }
  const token = await createSession(env, id);
  return json({ token, user: { username: name } }, 201);
}

async function login(request, env) {
  const b = await readJson(request, 2000);
  const { ukey } = checkName(b.username);
  const key = checkKey(b.key);
  const ip = clientIp(request);

  await limitCheck(env, [['li:' + ip, 20], ['lu:' + ukey, 10]], LOGIN_MSG);
  const row = await env.DB.prepare('SELECT id, username, salt, hash FROM users WHERE ukey = ?').bind(ukey).first();
  const h = await sha256hex((row ? row.salt : DUMMY_SALT) + key);
  if (!row || !safeEq(h, row.hash)) {
    await limitHit(env, 'li:' + ip, LOGIN_WINDOW);
    await limitHit(env, 'lu:' + ukey, LOGIN_WINDOW);
    throw new HttpError(401, 'bad_credentials', 'ユーザー名またはパスワードが違います');
  }
  await env.DB.prepare('DELETE FROM rate WHERE k = ?').bind('lu:' + ukey).run();
  const token = await createSession(env, row.id);
  return json({ token, user: { username: row.username } });
}

async function logout(request, env) {
  const user = await requireUser(request, env);
  await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(user.sid).run();
  return json({ ok: true });
}

async function me(request, env) {
  const user = await requireUser(request, env);
  return json({ user: { username: user.username } });
}

async function changePassword(request, env) {
  const user = await requireUser(request, env);
  const b = await readJson(request, 2000);
  const key = checkKey(b.key);
  const newKey = checkKey(b.newKey);
  await verifyPassword(env, user, key);
  const salt = randHex(16);
  const hash = await sha256hex(salt + newKey);
  await env.DB.batch([
    env.DB.prepare('UPDATE users SET salt = ?, hash = ? WHERE id = ?').bind(salt, hash, user.id),
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND id <> ?').bind(user.id, user.sid)
  ]);
  return json({ ok: true });
}

async function deleteAccount(request, env) {
  const user = await requireUser(request, env);
  const b = await readJson(request, 2000);
  await verifyPassword(env, user, checkKey(b.key));
  await env.DB.prepare('DELETE FROM ah_records WHERE user_id = ?').bind(user.id).run().catch(() => {});
  await env.DB.batch([
    env.DB.prepare('DELETE FROM ss_records WHERE user_id = ?').bind(user.id),
    env.DB.prepare('DELETE FROM dbo_records WHERE user_id = ?').bind(user.id),
    env.DB.prepare('DELETE FROM fr_records WHERE user_id = ?').bind(user.id),
    env.DB.prepare('DELETE FROM yp_records WHERE user_id = ?').bind(user.id),
    env.DB.prepare('DELETE FROM saves WHERE user_id = ?').bind(user.id),
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id),
    env.DB.prepare('DELETE FROM users WHERE id = ?').bind(user.id),
    env.DB.prepare('DELETE FROM rate WHERE k = ?').bind('lu:' + user.ukey)
  ]);
  return json({ ok: true });
}

// ===== 深海フィッシング：アビス・ハンター ゲーム記録 =====
const RECORD_MIN_INTERVAL = 3 * 1000;          // 同じユーザーの保存は3秒に1回まで
const RANKING_SIZE = 20;

async function getRecords(request, env) {
  const user = await requireUser(request, env);
  const row = await env.DB.prepare(
    'SELECT best_score, best_depth, best_catch, boss_caught FROM ah_records WHERE user_id = ?'
  ).bind(user.id).first();
  return json({
    record: row || { best_score: 0, best_depth: 100, best_catch: 0, boss_caught: 0 }
  });
}

async function putRecord(request, env) {
  const user = await requireUser(request, env);
  const b = await readJson(request, 1000);
  const v0 = Number(b.score ?? 0);
  const v1 = Number(b.depth ?? 100);
  const v2 = Number(b.catchCount ?? 0);
  const v3 = Number(b.boss ?? 0);

  if (
    !Number.isInteger(v0) || v0 < 0 || v0 > 99999999 ||
    !Number.isInteger(v1) || v1 < 0 || v1 > 9999 ||
    !Number.isInteger(v2) || v2 < 0 || v2 > 999 ||
    !Number.isInteger(v3) || v3 < 0 || v3 > 999
  ) {
    throw new HttpError(400, 'bad_score', '記録の形式が正しくありません');
  }

  const t = Date.now();
  const r = await env.DB.prepare(
    'INSERT INTO ah_records(user_id, best_score, best_depth, best_catch, boss_caught, best_at, updated_at) ' +
    'VALUES(?,?,?,?,?,?,?) ' +
    'ON CONFLICT(user_id) DO UPDATE SET ' +
    'best_score = MAX(best_score, excluded.best_score), ' +
    'best_depth = MAX(best_depth, excluded.best_depth), ' +
    'best_catch = MAX(best_catch, excluded.best_catch), ' +
    'boss_caught = MAX(boss_caught, excluded.boss_caught), ' +
    'best_at = CASE WHEN excluded.best_score > best_score THEN excluded.best_at ELSE best_at END, ' +
    'updated_at = excluded.updated_at ' +
    'WHERE ah_records.updated_at <= ?'
  ).bind(user.id, v0, v1, v2, v3, t, t, t - RECORD_MIN_INTERVAL).run();

  if (!r.meta || !r.meta.changes) throw new HttpError(429, 'too_soon', '保存の間隔が短すぎます');
  return json({ ok: true });
}

async function getRanking(request, env) {
  const user = await requireUser(request, env);
  const { results } = await env.DB.prepare(
    'SELECT u.username AS name, r.best_score AS m0, r.best_depth AS m1, r.best_catch AS m2, r.boss_caught AS m3, (r.user_id = ?) AS me ' +
    'FROM ah_records r JOIN users u ON u.id = r.user_id ' +
    'WHERE r.best_score > 0 ORDER BY r.best_score DESC, r.best_at ASC LIMIT ?'
  ).bind(user.id, RANKING_SIZE).all();

  const mine = await env.DB.prepare(
    'SELECT best_score AS m0, best_depth AS m1, best_catch AS m2, boss_caught AS m3, best_at ' +
    'FROM ah_records WHERE user_id = ?'
  ).bind(user.id).first();

  let myRank = null;
  if (mine && mine.m0 > 0) {
    const c = await env.DB.prepare(
      'SELECT COUNT(*) AS c FROM ah_records WHERE (best_score > ? OR (best_score = ? AND best_at < ?))'
    ).bind(mine.m0, mine.m0, mine.best_at).first();
    myRank = c.c + 1;
  }

  return json({
    ranking: (results || []).map((x) => ({
      name: x.name,
      bestScore: x.m0,
      subStat: x.m1,
      comboStat: x.m2,
      extraStat: x.m3,
      me: !!x.me
    })),
    me: mine ? {
      rank: myRank,
      bestScore: mine.m0,
      subStat: mine.m1,
      comboStat: mine.m2,
      extraStat: mine.m3
    } : null
  });
}

// ===== ルーティング =====
async function route(request, env, url) {
  const m = request.method;
  const p = url.pathname;
  if (!env.DB) throw new HttpError(500, 'no_db', 'データベースが設定されていません');

  if (p === '/api/ping' && m === 'GET') return json({ ok: true, registration: String(env.REGISTRATION_OPEN) !== 'false' });
  if (p === '/api/register' && m === 'POST') return register(request, env);
  if (p === '/api/login' && m === 'POST') return login(request, env);
  if (p === '/api/logout' && m === 'POST') return logout(request, env);
  if (p === '/api/me' && m === 'GET') return me(request, env);
  if (p === '/api/password' && m === 'POST') return changePassword(request, env);
  if (p === '/api/account/delete' && m === 'POST') return deleteAccount(request, env);

  // ゲーム用API
  if (p === '/api/records' && m === 'GET') return getRecords(request, env);
  if (p === '/api/records' && m === 'POST') return putRecord(request, env);
  if (p === '/api/ranking' && m === 'GET') return getRanking(request, env);

  throw new HttpError(404, 'not_found', '見つかりません');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

    const base = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...cors };
    try {
      const res = await route(request, env, url);
      const h = new Headers(res.headers);
      for (const [k, v] of Object.entries(base)) h.set(k, v);
      return new Response(res.body, { status: res.status, headers: h });
    } catch (e) {
      if (e instanceof HttpError) {
        return json({ error: e.code, message: e.message, ...e.extra }, e.status, base);
      }
      console.error(e && e.stack ? e.stack : e);
      return json({ error: 'server', message: 'サーバーでエラーが発生しました' }, 500, base);
    }
  }
};
