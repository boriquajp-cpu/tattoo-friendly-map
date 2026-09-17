import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface BlockedUserRow {
  blocked_user_id: string;
  created_at: string;
}

/**
 * ログインユーザーがブロックした投稿者のIDを管理する。
 * favoritesと異なり、ブロックはアカウントに紐づく必要がある機能のため、
 * 未ログイン時は常に空集合（localStorageフォールバックは持たない）。
 */
export function useBlockedUsers() {
  const { user } = useAuth();
  const [blockedUsers, setBlockedUsers] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState<BlockedUserRow[]>([]);
  const latestUserId = useRef<string | null>(null);

  useEffect(() => {
    const userId = user?.id ?? null;
    latestUserId.current = userId;

    if (!userId) {
      setBlockedUsers(new Set());
      setRows([]);
      return;
    }

    void (async () => {
      const { data } = await supabase
        .from('blocked_users')
        .select('blocked_user_id, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (latestUserId.current !== userId) return;

      setRows((data ?? []) as BlockedUserRow[]);
      setBlockedUsers(new Set((data ?? []).map((row) => row.blocked_user_id)));
    })();
  }, [user]);

  const toggle = useCallback(async (blockedUserId: string) => {
    if (!user) return;

    // Reactの状態(user)は登録直後などに更新が追いつかないことがあるため、
    // 書き込み直前にSupabaseクライアントの現在のセッションを直接取り直す
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;

    const wasBlocked = blockedUsers.has(blockedUserId);

    // 楽観的更新
    setBlockedUsers((prev) => {
      const next = new Set(prev);
      if (wasBlocked) next.delete(blockedUserId); else next.add(blockedUserId);
      return next;
    });
    setRows((prevRows) => (
      wasBlocked
        ? prevRows.filter((r) => r.blocked_user_id !== blockedUserId)
        : [{ blocked_user_id: blockedUserId, created_at: new Date().toISOString() }, ...prevRows]
    ));

    const { error } = wasBlocked
      ? await supabase.from('blocked_users').delete().eq('user_id', userId).eq('blocked_user_id', blockedUserId)
      : await supabase.from('blocked_users').insert({ user_id: userId, blocked_user_id: blockedUserId });

    if (error) {
      console.error('ブロック状態の更新に失敗:', error.message);
      // 失敗時は楽観的更新をロールバック
      setBlockedUsers((prev) => {
        const next = new Set(prev);
        if (wasBlocked) next.add(blockedUserId); else next.delete(blockedUserId);
        return next;
      });
      setRows((prevRows) => (
        wasBlocked
          ? [{ blocked_user_id: blockedUserId, created_at: new Date().toISOString() }, ...prevRows]
          : prevRows.filter((r) => r.blocked_user_id !== blockedUserId)
      ));
    }
  }, [user, blockedUsers]);

  const isBlocked = useCallback((id: string) => blockedUsers.has(id), [blockedUsers]);

  return { blockedUsers, rows, isBlocked, toggle };
}
