"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "./Providers";

export default function AuthForm({ mode }) {
  const isLogin = mode === "login";
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      signIn(await (isLogin ? api.login : api.register)(email, password));
      router.push("/analyze");
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-5 pt-16">
      <motion.form onSubmit={submit} initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }} className="card w-full max-w-md p-8">
        <h1 className="font-display text-3xl font-semibold">{isLogin ? "Welcome back" : "Create your account"}</h1>
        <p className="mt-2 text-sm text-dim">{isLogin ? "Sign in to see your saved analyses." : "Save your analyses and prompts. Takes 10 seconds."}</p>
        <label className="mt-6 block text-sm text-dim" htmlFor="email">Email</label>
        <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field mt-1.5" placeholder="you@example.com" />
        <label className="mt-4 block text-sm text-dim" htmlFor="pw">Password</label>
        <input id="pw" type="password" required minLength={8} autoComplete={isLogin ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} className="field mt-1.5" placeholder="At least 8 characters" />
        {err && <p role="alert" className="mt-4 text-sm text-fake">{err}</p>}
        <button disabled={busy} className="btn btn-primary mt-6 w-full">{busy ? <Loader2 size={18} className="animate-spin" /> : isLogin ? "Sign in" : "Create account"}</button>
        <p className="mt-5 text-center text-sm text-dim">{isLogin ? "New here? " : "Already registered? "}
          <Link href={isLogin ? "/register" : "/login"} className="text-iris hover:underline">{isLogin ? "Create an account" : "Sign in"}</Link></p>
      </motion.form>
    </main>
  );
}
