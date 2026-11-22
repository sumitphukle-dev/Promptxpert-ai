"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, token } from "@/lib/api";

const Ctx = createContext({ user: null, ready: false });
export const useAuth = () => useContext(Ctx);

export default function Providers({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!token.get()) return setReady(true);
    api.me().then(setUser).catch(() => token.clear()).finally(() => setReady(true));
  }, []);

  const signIn = useCallback((data) => { token.set(data.access); setUser(data.user); }, []);
  const signOut = useCallback(() => { token.clear(); setUser(null); }, []);
  const value = useMemo(() => ({ user, ready, signIn, signOut }), [user, ready, signIn, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
