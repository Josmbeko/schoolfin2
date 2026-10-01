import React, { useState } from 'react';
import { Loader2, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const { signInWithGoogle, signInWithEmail, authError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try { await fn(); } catch (e) {
      setError(e instanceof Error ? e.message : 'Connexion impossible.');
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="bg-slate-900 text-white p-8">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center mb-5">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-extrabold">EduFinance Pro</h1>
          <p className="text-sm text-slate-400 mt-1">Espace sécurisé de gestion scolaire et financière</p>
        </div>

        <div className="p-8 space-y-5">
          {(error || authError) && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              {error || authError}
            </div>
          )}

          <button
            disabled={busy}
            onClick={() => run(signInWithGoogle)}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            Continuer avec Google
          </button>

          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <div className="h-px bg-slate-200 flex-1" />
            <span>OU EMAIL</span>
            <div className="h-px bg-slate-200 flex-1" />
          </div>

          <form onSubmit={(e) => {
            e.preventDefault();
            run(() => signInWithEmail(email.trim(), password));
          }} className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-700">Adresse email</label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input value={email} onChange={e => setEmail(e.target.value)} type="email" required className="w-full pl-10 pr-3 py-3 rounded-xl border border-slate-300 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Mot de passe</label>
              <div className="relative mt-1">
                <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input value={password} onChange={e => setPassword(e.target.value)} type="password" required className="w-full pl-10 pr-3 py-3 rounded-xl border border-slate-300 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <button disabled={busy} type="submit" className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50">
              {busy ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>

          <p className="text-[11px] leading-relaxed text-slate-500 text-center">
            L’accès est contrôlé par Firebase Authentication et les rôles enregistrés dans Firestore.
          </p>
        </div>
      </div>
    </div>
  );
};
