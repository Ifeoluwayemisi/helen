import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { User, UserRole } from '../../types';
import {
  Users,
  UserPlus,
  ShieldCheck,
  Power,
  Key,
  CheckCircle,
  X,
  AlertCircle,
  UserCheck,
} from 'lucide-react';

export const StaffScreen: React.FC = () => {
  const { dbState, createUser, updateUser, toggleUserActive, currentUser, switchUser } = useStore();
  const { users } = dbState;

  const isAdmin = currentUser.role === 'ADMIN';

  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('CASHIER');
  const [pin, setPin] = useState('1234');
  const [formError, setFormError] = useState<string | null>(null);

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('Staff name is required.');
      return;
    }
    if (!email.trim()) {
      setFormError('Login identifier / email is required.');
      return;
    }

    try {
      createUser({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role,
        pin: pin.trim() || undefined,
        active: true,
      });
      setIsAddUserOpen(false);
      setName('');
      setEmail('');
      setPin('1234');
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Error creating staff user');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50">
      {/* Top Banner */}
      <div className="bg-white border-b border-slate-200 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-700" />
              <span>Staff Accounts &amp; Permissions</span>
            </h2>
            <p className="text-xs text-slate-500">
              Role-Based Access Control: Admin, Cashier, and Inventory Staff
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={() => setIsAddUserOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition shadow-sm active:scale-95"
              >
                <UserPlus className="w-4 h-4" />
                <span>Add Staff Account</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Quick Active Operator Switcher for evaluation */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-emerald-700" />
              <span>Active Terminal Session (Current Operator)</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {users.map((u) => {
                const isSelected = u.id === currentUser.id;
                return (
                  <button
                    key={u.id}
                    disabled={!u.active}
                    onClick={() => switchUser(u.id)}
                    className={`flex items-center justify-between p-3 rounded-xl border text-left transition ${
                      isSelected
                        ? 'border-emerald-700 bg-emerald-50/80 ring-2 ring-emerald-700 text-emerald-950'
                        : !u.active
                        ? 'border-slate-200 bg-slate-100 opacity-50 cursor-not-allowed'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-xs flex items-center gap-1.5">
                        <span>{u.name}</span>
                        {isSelected && <span className="text-[10px] bg-emerald-700 text-white px-1.5 py-0.2 rounded-full font-bold">ACTIVE</span>}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Role: <strong className="uppercase">{u.role}</strong>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Staff Accounts Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Configured Staff Directory</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Staff Member</th>
                    <th className="py-3 px-3">Login / Email</th>
                    <th className="py-3 px-3">Assigned Role</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          <span>{u.name}</span>
                          {u.id === currentUser.id && (
                            <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-md">
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">ID: {u.id}</div>
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-600">{u.email}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            u.role === 'ADMIN'
                              ? 'bg-purple-100 text-purple-800'
                              : u.role === 'CASHIER'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            u.active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {u.active ? 'ACTIVE' : 'DEACTIVATED'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isAdmin && u.id !== currentUser.id && (
                          <button
                            onClick={() => toggleUserActive(u.id)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                              u.active
                                ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            }`}
                          >
                            {u.active ? 'Deactivate' : 'Reactivate'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Role Permissions Matrix Reference */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span>Operational Role Permissions Matrix (PRD Section 7)</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-purple-50/60 border border-purple-200">
                <h4 className="font-bold text-purple-900 mb-1">ADMIN (Store Owner)</h4>
                <ul className="space-y-1 text-purple-800 text-[11px] list-disc list-inside">
                  <li>Full sales and POS operations</li>
                  <li>Add/edit product pricing &amp; catalogue</li>
                  <li>Receive and adjust inventory</li>
                  <li>Full sales revenue reporting</li>
                  <li>Staff creation &amp; deactivation</li>
                  <li>Store business settings &amp; backups</li>
                </ul>
              </div>

              <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200">
                <h4 className="font-bold text-blue-900 mb-1">CASHIER</h4>
                <ul className="space-y-1 text-blue-800 text-[11px] list-disc list-inside">
                  <li>Process customer checkout</li>
                  <li>Cash, Transfer, Card payment recording</li>
                  <li>Print &amp; share customer receipts</li>
                  <li>View own sales history</li>
                  <li>Check stock quantity availability</li>
                  <li>Restricted from changing prices</li>
                </ul>
              </div>

              <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200">
                <h4 className="font-bold text-amber-900 mb-1">INVENTORY STAFF</h4>
                <ul className="space-y-1 text-amber-800 text-[11px] list-disc list-inside">
                  <li>Record incoming goods delivery</li>
                  <li>Perform stock count adjustments</li>
                  <li>Mark damaged / returned goods</li>
                  <li>View stock movements ledger</li>
                  <li>Monitor low-stock alerts</li>
                  <li>Restricted from administrative settings</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: ADD STAFF */}
      {isAddUserOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold">New Staff Account</h3>
              </div>
              <button onClick={() => setIsAddUserOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-5 space-y-3.5 text-xs">
              {formError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Okon"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  autoFocus
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Login Email / Username *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. john@hellenstore.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Assigned Role *</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  <option value="CASHIER">CASHIER (Checkout &amp; Receipts)</option>
                  <option value="INVENTORY">INVENTORY (Stock Intake &amp; Adjustments)</option>
                  <option value="ADMIN">ADMIN (Full Store Supervision)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Terminal Quick PIN</label>
                <input
                  type="password"
                  maxLength={6}
                  placeholder="e.g. 1234"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold shadow-sm transition"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
