import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { supabase } from '../lib/supabase';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  roleLoading: boolean;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  isAdmin: false,
  loading: true,
  roleLoading: false,
  signOut: async () => {},
  deleteAccount: async () => ({ error: null }),
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ネイティブアプリでのGoogleログイン: システムブラウザのシートで認証後、
  // カスタムURLスキーム経由でアプリに戻ってきたところをここで受け取ってセッション化する
  useEffect(() => {
    const listenerPromise = CapacitorApp.addListener('appUrlOpen', ({ url }) => {
      if (!url.includes('login-callback')) return;
      // exchangeCodeForSession() はコールバックURL全体ではなく code パラメータの値のみを受け取る
      const code = new URL(url).searchParams.get('code');
      if (!code) return;
      void supabase.auth.exchangeCodeForSession(code)
        .then(({ error }) => {
          if (error) console.error('Googleログインのセッション化に失敗:', error.message);
        })
        .finally(() => {
          void Browser.close();
        });
    });

    return () => { void listenerPromise.then((l) => l.remove()); };
  }, []);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) {
      setIsAdmin(false);
      setRoleLoading(false);
      return;
    }
    // isAdmin が確定するまで roleLoading を true に保つ。これがないと、
    // AdminPage が「role未取得＝false」を「権限なし」と誤って一瞬（あるいは
    // 通信エラー時は恒久的に）表示してしまう競合状態になる。
    setRoleLoading(true);
    void (async () => {
      try {
        const { data } = await supabase.from('users').select('role').eq('id', userId).single();
        setIsAdmin(data?.role === 'admin');
      } catch {
        setIsAdmin(false);
      } finally {
        setRoleLoading(false);
      }
    })();
  }, [session?.user?.id]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const deleteAccount = async (): Promise<{ error: string | null }> => {
    const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
    if (error) return { error: error.message };
    await supabase.auth.signOut();
    return { error: null };
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, isAdmin, loading, roleLoading, signOut, deleteAccount }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
