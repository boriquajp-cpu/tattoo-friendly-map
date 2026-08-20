-- =============================================================================
-- 013_create_blocked_users.sql
-- ユーザーによる投稿者ブロック機能
--
-- favorites (008) と同じパターン。ブロックした相手の報告(reports)を
-- クライアント側で一覧から除外するために使う。ブロックはログイン必須の
-- 機能なので、favoritesと異なり未ログイン時のlocalStorageフォールバックは
-- 持たせない。
-- =============================================================================

CREATE TABLE blocked_users (
  user_id         uuid        NOT NULL
                              REFERENCES users (id) ON DELETE CASCADE,
  blocked_user_id uuid        NOT NULL
                              REFERENCES users (id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (user_id, blocked_user_id)
);

ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blocked_users_select_own"
  ON blocked_users FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "blocked_users_insert_own"
  ON blocked_users FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "blocked_users_delete_own"
  ON blocked_users FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE blocked_users IS
  'ログインユーザーがブロックした投稿者。ブロック相手の報告はクライアント側で一覧から除外する。';
