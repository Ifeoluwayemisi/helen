import React, { useState } from 'react';
import { ShieldCheck, AlertCircle } from 'lucide-react';
import {
  MIN_OWNER_CREDENTIAL_LENGTH,
  OwnerSetupInput,
  validateOwnerSetupInput,
} from '../../services/authFlow';

export interface FirstOwnerSetupProps {
  submitting: boolean;
  error?: string | null;
  onSubmit: (input: OwnerSetupInput) => void;
}

export const FirstOwnerSetupForm: React.FC<FirstOwnerSetupProps> = ({
  submitting,
  error,
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [credential, setCredential] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const displayedError = error || localError;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateOwnerSetupInput({ name, email, credential });
    if (validationError) {
      setLocalError(validationError);
      return;
    }
    setLocalError(null);
    onSubmit({ name: name.trim(), email: email.trim(), credential });
  };

  return (
    <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs">
      <p className="text-slate-500 text-[11px]">
        This store has no owner yet. Create the first administrator account to
        unlock the terminal.
      </p>

      {displayedError && (
        <div
          role="alert"
          className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span className="leading-tight">{displayedError}</span>
        </div>
      )}

      <div>
        <label className="block font-bold text-slate-700 mb-1">Full Name</label>
        <input
          type="text"
          required
          placeholder="Store owner full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 font-medium"
        />
      </div>

      <div>
        <label className="block font-bold text-slate-700 mb-1">Email</label>
        <input
          type="email"
          required
          placeholder="owner@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 font-medium"
        />
      </div>

      <div>
        <label className="block font-bold text-slate-700 mb-1">
          Password or PIN
        </label>
        <input
          type="password"
          required
          placeholder={`At least ${MIN_OWNER_CREDENTIAL_LENGTH} characters`}
          value={credential}
          onChange={(e) => setCredential(e.target.value)}
          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 font-mono tracking-widest"
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold shadow-sm transition"
      >
        {submitting ? 'Creating owner account...' : 'Create Owner Account'}
      </button>
    </form>
  );
};

export const FirstOwnerSetupModal: React.FC<FirstOwnerSetupProps> = (props) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
    <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
      <div className="p-4 bg-emerald-900 text-white flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-emerald-400" />
        <h3 className="text-sm font-bold">Set Up Store Owner</h3>
      </div>
      <FirstOwnerSetupForm {...props} />
    </div>
  </div>
);
