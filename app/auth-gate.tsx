"use client";

import { FormEvent, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Eye, EyeOff, Loader2, LockKeyhole, Mail, ReceiptText, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
import { ExpenseTracker } from "./expense-tracker";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type AuthMode = "login" | "register";

function displayName(user: User) {
  const name = String(user.user_metadata?.full_name ?? "").trim();
  if (name) return name.split(" ")[0];
  return user.email?.split("@")[0] ?? "Bun venit";
}

export function AuthGate() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    void supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  if (!isSupabaseConfigured) return <ConfigurationNotice />;

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-[#f4efe5] text-[#17312d]">
        <div className="flex items-center gap-3 text-sm font-bold"><Loader2 className="size-5 animate-spin" /> Se deschide registrul…</div>
      </div>
    );
  }

  if (!user) return <AuthScreen />;

  return (
    <ExpenseTracker
      displayName={displayName(user)}
      userId={user.id}
      onSignOut={async () => {
        if (!supabase) return;
        const { error } = await supabase.auth.signOut();
        if (error) toast.error("Nu am putut închide sesiunea.");
      }}
    />
  );
}

function ConfigurationNotice() {
  return (
    <div className="grid min-h-dvh place-items-center bg-[#f4efe5] px-5 text-[#17312d]">
      <div className="w-full max-w-lg rounded-[28px] border border-[#d9d1c3] bg-[#fffdf8] p-7 shadow-[0_24px_70px_rgba(57,45,30,0.12)] sm:p-9">
        <div className="grid size-14 place-items-center rounded-2xl bg-[#173b35] text-white"><LockKeyhole className="size-6" /></div>
        <h1 className="mt-6 text-2xl font-black">Configurarea conturilor nu este finalizată</h1>
        <p className="mt-3 leading-relaxed text-[#746c61]">Registrul este pregătit pentru conturi individuale, dar trebuie conectat la baza de date înainte de publicare.</p>
      </div>
    </div>
  );
}

function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    if (mode === "register" && name.trim().length < 2) {
      toast.error("Introdu numele tău.");
      return;
    }
    if (password.length < 8) {
      toast.error("Parola trebuie să aibă minimum 8 caractere.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "register") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: name.trim() } },
        });
        if (error) throw error;
        if (!data.session) setConfirmationSent(true);
        else toast.success("Contul a fost creat.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Autentificarea nu a reușit.";
      toast.error(message.includes("Invalid login") ? "E-mail sau parolă incorectă." : message);
    } finally {
      setBusy(false);
    }
  };

  if (confirmationSent) {
    return (
      <div className="grid min-h-dvh place-items-center bg-[#f4efe5] px-4 text-[#17312d]">
        <Toaster position="top-center" richColors />
        <div className="w-full max-w-md rounded-[28px] border border-[#d9d1c3] bg-[#fffdf8] p-7 text-center shadow-[0_24px_70px_rgba(57,45,30,0.12)] sm:p-9">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#dfece4] text-[#1f594a]"><Mail className="size-7" /></span>
          <h1 className="mt-5 text-2xl font-black">Verifică e-mailul</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#746c61]">Am trimis un mesaj la <strong>{email}</strong>. Deschide linkul din mesaj, apoi te poți conecta.</p>
          <Button className="mt-6 h-12 w-full rounded-xl bg-[#173b35]" onClick={() => { setMode("login"); setConfirmationSent(false); }}>Mergi la conectare</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#f4efe5] px-4 py-8 text-[#17312d] sm:grid sm:place-items-center sm:py-12">
      <Toaster position="top-center" richColors />
      <div className="w-full max-w-5xl overflow-hidden rounded-[30px] border border-[#d9d1c3] bg-[#fffdf8] shadow-[0_28px_80px_rgba(57,45,30,0.13)] sm:grid sm:grid-cols-[0.9fr_1.1fr]">
        <section className="bg-[#173b35] p-7 text-[#fffaf0] sm:flex sm:flex-col sm:justify-between sm:p-10">
          <div>
            <div className="grid size-13 place-items-center rounded-2xl bg-white/12"><ReceiptText className="size-6" /></div>
            <p className="mt-8 text-xs font-bold uppercase tracking-[0.18em] text-[#b9d3c5]">Registrul meu</p>
            <h1 className="mt-2 text-3xl font-black leading-tight sm:text-4xl">Banii și bonurile tale, într-un singur loc.</h1>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-[#d6e4dc]">Intră de pe orice telefon sau calculator. Tot ce salvezi rămâne în contul tău.</p>
          </div>
          <div className="mt-8 flex items-start gap-3 rounded-2xl bg-white/9 p-4 text-sm text-[#e4eee8]">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#b9d3c5]" />
            <p>Fiecare utilizator vede numai veniturile, cheltuielile, notițele și bonurile din contul său.</p>
          </div>
        </section>

        <section className="p-6 sm:p-10">
          <div className="grid grid-cols-2 gap-1 rounded-2xl bg-[#eee7da] p-1.5">
            <button type="button" onClick={() => setMode("login")} className={`min-h-11 rounded-xl text-sm font-extrabold ${mode === "login" ? "bg-white text-[#173b35] shadow-sm" : "text-[#746b5e]"}`}>Conectare</button>
            <button type="button" onClick={() => setMode("register")} className={`min-h-11 rounded-xl text-sm font-extrabold ${mode === "register" ? "bg-white text-[#173b35] shadow-sm" : "text-[#746b5e]"}`}>Cont nou</button>
          </div>

          <div className="mt-7">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#96775e]">{mode === "login" ? "Bine ai revenit" : "Începe acum"}</p>
            <h2 className="mt-1 text-2xl font-black">{mode === "login" ? "Intră în cont" : "Creează contul tău"}</h2>
          </div>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "register" && (
              <label className="block text-sm font-bold">
                Nume
                <span className="relative mt-2 block">
                  <UserRound className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#8c8174]" />
                  <Input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required className="h-12 rounded-xl bg-white pl-11 text-base" placeholder="Numele tău" />
                </span>
              </label>
            )}
            <label className="block text-sm font-bold">
              E-mail
              <span className="relative mt-2 block">
                <Mail className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#8c8174]" />
                <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required className="h-12 rounded-xl bg-white pl-11 text-base" placeholder="nume@exemplu.ro" />
              </span>
            </label>
            <label className="block text-sm font-bold">
              Parolă
              <span className="relative mt-2 block">
                <LockKeyhole className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#8c8174]" />
                <Input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={8} className="h-12 rounded-xl bg-white px-11 text-base" placeholder="Minimum 8 caractere" />
                <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-[#786f65]" aria-label={showPassword ? "Ascunde parola" : "Arată parola"}>{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
              </span>
            </label>
            <Button type="submit" disabled={busy} className="h-13 w-full rounded-xl bg-[#173b35] text-base font-extrabold hover:bg-[#102e29]">
              {busy ? <><Loader2 className="size-5 animate-spin" /> Se verifică…</> : mode === "login" ? "Intră în registru" : "Creează cont"}
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}
