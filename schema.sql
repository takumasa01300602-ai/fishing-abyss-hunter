-- fishing-abyss-hunter（深海フィッシング：アビス・ハンター）用データベース
-- たかGames（taka-games）および全ゲーム共通の D1（farm-farm-happy-db）を参照します。
-- 何度流しても壊れないよう IF NOT EXISTS にしています。

CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  username   TEXT    NOT NULL,             -- 表示名
  ukey       TEXT    NOT NULL UNIQUE,      -- 小文字化した名前（重複チェック用）
  salt       TEXT    NOT NULL,             -- サーバー側ソルト
  hash       TEXT    NOT NULL,             -- SHA-256(salt + ブラウザで導出したキー)
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  token_hash TEXT    NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  last_used  INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS rate (
  k        TEXT    PRIMARY KEY,
  n        INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS saves (
  user_id    INTEGER PRIMARY KEY,
  data       TEXT    NOT NULL,
  saved_at   INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- ゆびさきパニック用
CREATE TABLE IF NOT EXISTS yp_records (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stage      TEXT    NOT NULL,
  best       INTEGER NOT NULL,
  cleared    INTEGER NOT NULL DEFAULT 0,
  best_at    INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, stage)
);
CREATE INDEX IF NOT EXISTS idx_yp_records_stage ON yp_records(stage, best DESC);

-- ルーンの砦用
CREATE TABLE IF NOT EXISTS fr_records (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stage      TEXT    NOT NULL,
  best       INTEGER NOT NULL,
  stars      INTEGER NOT NULL DEFAULT 0,
  cleared    INTEGER NOT NULL DEFAULT 0,
  best_at    INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, stage)
);
CREATE INDEX IF NOT EXISTS idx_fr_records_stage ON fr_records(stage, best DESC);

-- DEAD BRIDGE: OVERDRIVE 用
CREATE TABLE IF NOT EXISTS dbo_records (
  user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  best_score INTEGER NOT NULL DEFAULT 0,
  best_stage INTEGER NOT NULL DEFAULT 1,
  best_kills INTEGER NOT NULL DEFAULT 0,
  best_combo INTEGER NOT NULL DEFAULT 0,
  best_at    INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_dbo_records_score ON dbo_records(best_score DESC, best_at ASC);

-- SUGAR STACK 用
CREATE TABLE IF NOT EXISTS ss_records (
  user_id      INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  best_score   INTEGER NOT NULL DEFAULT 0,
  best_level   INTEGER NOT NULL DEFAULT 1,
  best_combo   INTEGER NOT NULL DEFAULT 0,
  best_cleared INTEGER NOT NULL DEFAULT 0,
  best_at      INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ss_records_score ON ss_records(best_score DESC, best_at ASC);

-- ポーション・アルケミスト (suika-alchemist) 用
CREATE TABLE IF NOT EXISTS sa_records (
  user_id        INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  best_score     INTEGER NOT NULL DEFAULT 0,
  best_tier      INTEGER NOT NULL DEFAULT 1,
  best_chain     INTEGER NOT NULL DEFAULT 0,
  stones_created INTEGER NOT NULL DEFAULT 0,
  best_at        INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sa_records_score ON sa_records(best_score DESC, best_at ASC);

-- ネオン・ピンボール・ダンジョン (pinball-rogue) 用
CREATE TABLE IF NOT EXISTS pr_records (
  user_id        INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  best_score     INTEGER NOT NULL DEFAULT 0,
  best_floor     INTEGER NOT NULL DEFAULT 1,
  best_combo     INTEGER NOT NULL DEFAULT 0,
  bosses_slain   INTEGER NOT NULL DEFAULT 0,
  best_at        INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pr_records_score ON pr_records(best_score DESC, best_at ASC);

-- ポケット・サバイバー：魔導の夜明け (survivor-magic) 用
CREATE TABLE IF NOT EXISTS sm_records (
  user_id        INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  best_score     INTEGER NOT NULL DEFAULT 0,
  best_wave      INTEGER NOT NULL DEFAULT 1,
  best_kills     INTEGER NOT NULL DEFAULT 0,
  best_level     INTEGER NOT NULL DEFAULT 1,
  best_at        INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sm_records_score ON sm_records(best_score DESC, best_at ASC);

-- 回転寿司パニック！大将の秒速握り (sushi-rush-kitchen) 用
CREATE TABLE IF NOT EXISTS sr_records (
  user_id        INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  best_score     INTEGER NOT NULL DEFAULT 0,
  best_dishes    INTEGER NOT NULL DEFAULT 0,
  best_combo     INTEGER NOT NULL DEFAULT 0,
  best_day       INTEGER NOT NULL DEFAULT 1,
  best_at        INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sr_records_score ON sr_records(best_score DESC, best_at ASC);

-- グラップル・クライマー：蒼穹の塔 (sky-hook-climber) 用
CREATE TABLE IF NOT EXISTS sh_records (
  user_id        INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  best_score     INTEGER NOT NULL DEFAULT 0,
  best_height    INTEGER NOT NULL DEFAULT 0,
  best_combo     INTEGER NOT NULL DEFAULT 0,
  best_rings     INTEGER NOT NULL DEFAULT 0,
  best_at        INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sh_records_score ON sh_records(best_score DESC, best_at ASC);

-- ブレイクアウト・オデッセイ：魔導ブロック崩し (brick-breaker-overdrive) 用
CREATE TABLE IF NOT EXISTS bb_records (
  user_id        INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  best_score     INTEGER NOT NULL DEFAULT 0,
  best_stage     INTEGER NOT NULL DEFAULT 1,
  best_balls     INTEGER NOT NULL DEFAULT 1,
  best_combo     INTEGER NOT NULL DEFAULT 0,
  best_at        INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bb_records_score ON bb_records(best_score DESC, best_at ASC);

-- 一閃！リズム居合斬り (rhythm-samurai) 用
CREATE TABLE IF NOT EXISTS rs_records (
  user_id        INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  best_score     INTEGER NOT NULL DEFAULT 0,
  best_stage     INTEGER NOT NULL DEFAULT 1,
  best_combo     INTEGER NOT NULL DEFAULT 0,
  best_perfect   INTEGER NOT NULL DEFAULT 0,
  best_at        INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rs_records_score ON rs_records(best_score DESC, best_at ASC);

-- ダンジョン・ソリティア：運命の迷宮 (dungeon-flip-cards) 用
CREATE TABLE IF NOT EXISTS df_records (
  user_id        INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  best_score     INTEGER NOT NULL DEFAULT 0,
  best_floor     INTEGER NOT NULL DEFAULT 1,
  best_gold      INTEGER NOT NULL DEFAULT 0,
  best_kills     INTEGER NOT NULL DEFAULT 0,
  best_at        INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_df_records_score ON df_records(best_score DESC, best_at ASC);

-- ネオン・ドリフト：ハイウェイ・エスケープ (neon-drift-chase) 用
CREATE TABLE IF NOT EXISTS nd_records (
  user_id        INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  best_score     INTEGER NOT NULL DEFAULT 0,
  best_distance  INTEGER NOT NULL DEFAULT 0,
  best_drift     INTEGER NOT NULL DEFAULT 0,
  best_takedowns INTEGER NOT NULL DEFAULT 0,
  best_at        INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_nd_records_score ON nd_records(best_score DESC, best_at ASC);

-- 深海フィッシング：アビス・ハンター (fishing-abyss-hunter) 用
CREATE TABLE IF NOT EXISTS ah_records (
  user_id        INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  best_score     INTEGER NOT NULL DEFAULT 0,
  best_depth     INTEGER NOT NULL DEFAULT 100,
  best_catch     INTEGER NOT NULL DEFAULT 0,
  boss_caught    INTEGER NOT NULL DEFAULT 0,
  best_at        INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ah_records_score ON ah_records(best_score DESC, best_at ASC);
