import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import {
  Settings,
  Building,
  Phone,
  MapPin,
  Coins,
  FileText,
  Percent,
  Download,
  Upload,
  RotateCcw,
  Save,
  CheckCircle,
  AlertTriangle,
  Building2,
} from 'lucide-react';

export const SettingsScreen: React.FC = () => {
  const { dbState, updateSettings, exportDatabase, importDatabase, resetDatabase, currentUser } = useStore();
  const { settings } = dbState;

  const isAdmin = currentUser.role === 'ADMIN';

  // Local form state
  const [storeName, setStoreName] = useState(settings.storeName);
  const [branchName, setBranchName] = useState(settings.branchName);
  const [phone, setPhone] = useState(settings.phone);
  const [address, setAddress] = useState(settings.address);
  const [currency, setCurrency] = useState(settings.currency);
  const [receiptFooter, setReceiptFooter] = useState(settings.receiptFooter);
  const [taxRate, setTaxRate] = useState(String(settings.taxRate));
  const [enableTax, setEnableTax] = useState(settings.enableTax);
  const [bankName, setBankName] = useState(settings.bankDetails?.bankName || '');
  const [accountName, setAccountName] = useState(settings.bankDetails?.accountName || '');
  const [accountNumber, setAccountNumber] = useState(settings.bankDetails?.accountNumber || '');

  const [importJsonText, setImportJsonText] = useState('');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      storeName: storeName.trim(),
      branchName: branchName.trim(),
      phone: phone.trim(),
      address: address.trim(),
      currency: currency.trim() || '₦',
      receiptFooter: receiptFooter.trim(),
      taxRate: parseFloat(taxRate) || 0,
      enableTax,
      bankDetails: {
        bankName: bankName.trim(),
        accountName: accountName.trim(),
        accountNumber: accountNumber.trim(),
      },
    });
  };

  const handleDownloadBackup = () => {
    const jsonStr = exportDatabase();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hellen-store-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!importJsonText.trim()) return;
    try {
      importDatabase(importJsonText);
      setIsImportModalOpen(false);
      setImportJsonText('');
    } catch {
      // error handled in context
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50">
      {/* Top Banner */}
      <div className="bg-white border-b border-slate-200 p-4 space-y-1">
        <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
          <Settings className="w-5 h-5 text-emerald-700" />
          <span>Store Settings &amp; Business Configuration</span>
        </h2>
        <p className="text-xs text-slate-500">
          Supermarket branding, receipt slip header/footer, VAT rules, and local database backup
        </p>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Form */}
          <form onSubmit={handleSaveSettings} className="space-y-6">
            {/* 1. Store Identity */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
                <Building className="w-4 h-4 text-emerald-700" />
                <span>Store Identity &amp; Contact</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Store Name *</label>
                  <input
                    type="text"
                    required
                    disabled={!isAdmin}
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Branch Name</label>
                  <input
                    type="text"
                    disabled={!isAdmin}
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    disabled={!isAdmin}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Currency Symbol</label>
                  <input
                    type="text"
                    disabled={!isAdmin}
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:bg-slate-100"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Store Physical Address</label>
                  <input
                    type="text"
                    disabled={!isAdmin}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:bg-slate-100"
                  />
                </div>
              </div>
            </div>

            {/* 2. Bank Details for Transfer Checkout */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
                <Building2 className="w-4 h-4 text-emerald-700" />
                <span>Store Bank Account (For Customer Bank Transfers)</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Bank Name</label>
                  <input
                    type="text"
                    disabled={!isAdmin}
                    placeholder="e.g. GTBank / Access"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Account Name</label>
                  <input
                    type="text"
                    disabled={!isAdmin}
                    placeholder="e.g. Hellen Store Ent."
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Account Number</label>
                  <input
                    type="text"
                    disabled={!isAdmin}
                    placeholder="e.g. 0123456789"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className="w-full px-3 py-2 font-mono font-bold rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:bg-slate-100"
                  />
                </div>
              </div>
            </div>

            {/* 3. Receipts & Tax */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
                <FileText className="w-4 h-4 text-emerald-700" />
                <span>Receipt Slip Message &amp; Tax Configuration</span>
              </h3>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Receipt Footer Note &amp; Exchange Policy
                  </label>
                  <textarea
                    rows={2}
                    disabled={!isAdmin}
                    value={receiptFooter}
                    onChange={(e) => setReceiptFooter(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:bg-slate-100"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="enableTax"
                      disabled={!isAdmin}
                      checked={enableTax}
                      onChange={(e) => setEnableTax(e.target.checked)}
                      className="w-4 h-4 text-emerald-700 rounded-md focus:ring-emerald-600"
                    />
                    <label htmlFor="enableTax" className="font-bold text-slate-800 cursor-pointer">
                      Enable VAT / Sales Tax on Checkout
                    </label>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Tax / VAT Rate (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      disabled={!isAdmin || !enableTax}
                      value={taxRate}
                      onChange={(e) => setTaxRate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:bg-slate-100"
                    />
                  </div>
                </div>
              </div>
            </div>

            {isAdmin && (
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-extrabold shadow-sm transition active:scale-95 flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Configuration</span>
                </button>
              </div>
            )}
          </form>

          {/* 4. Data Management & Disaster Recovery (JSON Backup / Restore) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
              <Download className="w-4 h-4 text-emerald-700" />
              <span>Data Management, Backups &amp; Reset</span>
            </h3>
            <p className="text-xs text-slate-500">
              Export your full store records (products, sales receipts, stock movements, and audit logs) as a portable JSON file.
            </p>

            <div className="flex flex-wrap gap-3 pt-1">
              <button
                type="button"
                onClick={handleDownloadBackup}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition shadow-2xs"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>Download Database JSON Backup</span>
              </button>

              {isAdmin && (
                <>
                  <button
                    type="button"
                    onClick={() => setIsImportModalOpen(true)}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition shadow-2xs"
                  >
                    <Upload className="w-4 h-4 text-blue-600" />
                    <span>Restore From JSON</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Reset database to default demonstration products and transactions?')) {
                        resetDatabase();
                      }
                    }}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold transition"
                  >
                    <RotateCcw className="w-4 h-4 text-rose-600" />
                    <span>Reset to Demo Data</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: IMPORT JSON BACKUP */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Upload className="w-4 h-4 text-emerald-400" />
                <span>Restore Database From JSON</span>
              </h3>
              <button onClick={() => setIsImportModalOpen(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleImportSubmit} className="p-5 space-y-3.5 text-xs">
              <p className="text-slate-600">
                Paste the contents of your exported Hellen Store JSON file below:
              </p>

              <textarea
                rows={8}
                required
                placeholder="Paste JSON here..."
                value={importJsonText}
                onChange={(e) => setImportJsonText(e.target.value)}
                className="w-full p-3 font-mono text-[11px] rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="flex-1 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold shadow-sm"
                >
                  Confirm Restore
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
