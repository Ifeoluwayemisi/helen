import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { FirstOwnerSetupModal } from './FirstOwnerSetup';
import { OwnerSetupInput } from '../../services/authFlow';
import { ShoppingBag, Key, AlertCircle, ShieldCheck } from 'lucide-react';

/**
 * Production sign-in gate. Rendered instead of the app shell whenever there is
 * no valid server session, so no catalog, stock, sales, or staff data reaches
 * the screen before the operator authenticates. While the initial session probe
 * is still in flight this shows a neutral splash to avoid a flash of the app.
 */
export const AuthGate: React.FC = () => {
  const {
    sessionCheckComplete,
    requiresOwnerSetup,
    loginToServer,
    setupOwner,
  } = useStore();

  const [email, setEmail] = useState('');
  const [credential, setCredential] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoading(true);
    try {
      const res = await loginToServer(email, credential);
      if (res.success) {
        setCredential('');
      } else {
        setLoginError(
          res.error || 'Authentication failed. Please check your credentials.',
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOwnerSetupSubmit = async (input: OwnerSetupInput) => {
    setSetupError(null);
    setSetupLoading(true);
    try {
      const res = await setupOwner(input);
      if (res.success) {
        setEmail(input.email);
        setCredential('');
      } else {
        setSetupError(res.error || 'Store owner setup failed.');
      }
    } finally {
      setSetupLoading(false);
    }
  };

  const brandHeader = (
    <div className="flex items-center gap-3">
      <div className="w-11 h-11 rounded-2xl bg-emerald-800 border border-emerald-700 flex items-center justify-center shadow-sm">
        <ShoppingBag className="w-6 h-6 text-emerald-300" />
      </div>
      <div>
        <h1 className="text-lg font-extrabold tracking-tight text-white leading-tight">
          Hellen Store
        </h1>
        <p className="text-[11px] text-emerald-200 font-semibold">
          POS &amp; Inventory · Secure Terminal
        </p>
      </div>
    </div>
  );

  // Still probing for an existing session: show a neutral splash, never the app.
  if (!sessionCheckComplete) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center gap-4 bg-emerald-950 text-white">
        <div className="w-12 h-12 rounded-2xl bg-emerald-800 border border-emerald-700 flex items-center justify-center animate-pulse">
          <ShoppingBag className="w-7 h-7 text-emerald-300" />
        </div>
        <p className="text-sm font-semibold text-emerald-200">
          Verifying terminal session…
        </p>
      </div>
    );
  }

  // No owner provisioned yet: bootstrap the store owner before anything else.
  if (requiresOwnerSetup) {
    return (
      <FirstOwnerSetupModal
        submitting={setupLoading}
        error={setupError}
        onSubmit={handleOwnerSetupSubmit}
      />
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-emerald-950 p-4">
      <div className="w-full max-w-sm">
        <div className="rounded-3xl overflow-hidden shadow-2xl border border-emerald-800/60">
          <div className="p-5 bg-emerald-900">{brandHeader}</div>

          <form onSubmit={handleLoginSubmit} className="p-5 space-y-4 text-xs bg-white">
            <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span>Staff access is required to use this terminal.</span>
            </div>

            {loginError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span className="leading-tight">{loginError}</span>
              </div>
            )}

            <div>
              <label
                htmlFor="gate-email"
                className="block font-bold text-slate-700 mb-1"
              >
                Email
              </label>
              <input
                id="gate-email"
                type="email"
                required
                autoComplete="username"
                autoFocus={!email}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 font-medium"
              />
            </div>

            <div>
              <label
                htmlFor="gate-credential"
                className="block font-bold text-slate-700 mb-1"
              >
                Terminal PIN / Password
              </label>
              <input
                id="gate-credential"
                type="password"
                required
                autoComplete="current-password"
                autoFocus={Boolean(email)}
                value={credential}
                onChange={(e) => setCredential(e.target.value)}
                placeholder="Enter 4-digit PIN or password"
                className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 font-mono tracking-widest"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white font-bold shadow-sm transition flex items-center justify-center gap-2 active:scale-95"
            >
              <Key className="w-4 h-4" />
              {loading ? 'Verifying…' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-emerald-400/80 mt-4 leading-relaxed">
          Sign-in is verified against the Hellen Store server before any store
          data is shown.
        </p>
      </div>
    </div>
  );
};
