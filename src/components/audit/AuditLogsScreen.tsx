import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { ShieldCheck, Search, Filter, Clock, User, Tag, Boxes, FileSpreadsheet } from 'lucide-react';

export const AuditLogsScreen: React.FC = () => {
  const { dbState } = useStore();
  const { auditLogs } = dbState;

  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      if (actionFilter !== 'all' && log.actionType !== actionFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          log.userName.toLowerCase().includes(q) ||
          log.details.toLowerCase().includes(q) ||
          log.entityId.toLowerCase().includes(q) ||
          log.actionType.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [auditLogs, actionFilter, searchQuery]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50">
      {/* Top Banner */}
      <div className="bg-white border-b border-slate-200 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-700" />
              <span>Immutable System Audit Trail</span>
            </h2>
            <p className="text-xs text-slate-500">
              Traceable logs of price updates, stock reconciliations, staff actions, and sensitive store events
            </p>
          </div>
          <div className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
            {auditLogs.length} Total Audit Records
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row gap-2 pt-1 border-t border-slate-100">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search audit trail by actor, entity, action, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none"
          >
            <option value="all">All Action Types</option>
            <option value="PRICE_CHANGE">Price Changes</option>
            <option value="STOCK_ADJUSTMENT">Stock Adjustments</option>
            <option value="STOCK_RECEIVE">Stock Deliveries</option>
            <option value="PRODUCT_CREATE">Product Creations</option>
            <option value="PRODUCT_UPDATE">Product Updates</option>
            <option value="STAFF_UPDATE">Staff Updates</option>
            <option value="SALE_COMPLETED">Sales Completed</option>
            <option value="SETTINGS_CHANGE">Settings Changes</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-6xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-3">Actor (Staff)</th>
                  <th className="py-3 px-3">Action Type</th>
                  <th className="py-3 px-3">Target Entity</th>
                  <th className="py-3 px-4">Event Details &amp; Values Changed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No audit log records match the search filter.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => {
                    const formattedDate = new Date(log.timestamp).toLocaleString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    });

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                          {formattedDate}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="font-bold text-slate-900">{log.userName}</span>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              log.actionType === 'PRICE_CHANGE'
                                ? 'bg-amber-100 text-amber-900'
                                : log.actionType === 'STOCK_ADJUSTMENT'
                                ? 'bg-rose-100 text-rose-900'
                                : log.actionType === 'SALE_COMPLETED'
                                ? 'bg-emerald-100 text-emerald-900'
                                : 'bg-blue-100 text-blue-900'
                            }`}
                          >
                            {log.actionType}
                          </span>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-slate-600 font-mono text-[11px]">
                          {log.entityType} ({log.entityId})
                        </td>
                        <td className="py-3 px-4 text-slate-700">
                          <p className="font-medium">{log.details}</p>
                          {(log.previousValue || log.newValue) && (
                            <div className="mt-1 flex items-center gap-2 text-[11px] font-mono text-slate-500">
                              {log.previousValue && (
                                <span className="line-through text-slate-400">
                                  {log.previousValue}
                                </span>
                              )}
                              {log.previousValue && log.newValue && <span>&rarr;</span>}
                              {log.newValue && (
                                <span className="font-bold text-emerald-800">{log.newValue}</span>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
