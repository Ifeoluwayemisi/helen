import React, { useState, useMemo } from "react";
import { useStore } from "../../context/StoreContext";
import { Sale, PaymentMethod } from "../../types";
import {
  Receipt,
  Search,
  Filter,
  Eye,
  Printer,
  Calendar,
  CreditCard,
  Banknote,
  Building2,
  CheckCircle,
  X,
  FileSpreadsheet,
} from "lucide-react";
import { ReceiptModal } from "../receipts/ReceiptModal";

export const SalesHistoryScreen: React.FC = () => {
  const {
    dbState,
    currentUser,
    serverUser,
    isServerAuthenticated,
    setActiveReceipt,
  } = useStore();
  const { sales, settings } = dbState;
  const viewer = isServerAuthenticated && serverUser ? serverUser : currentUser;

  const [searchQuery, setSearchQuery] = useState("");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<
    "all" | "today" | "yesterday" | "week"
  >("all");
  const [selectedSaleForDetails, setSelectedSaleForDetails] =
    useState<Sale | null>(null);

  // Cashier role restriction check (PRD Section 7: cashiers view own sales or approved scope)
  const isCashier = viewer.role === "CASHIER";
  const visibleSales = useMemo(() => {
    if (isCashier) {
      // Show sales completed by this cashier
      return sales.filter((s) => s.cashierId === viewer.id);
    }
    return sales;
  }, [sales, isCashier, viewer.id]);

  const filteredSales = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return visibleSales.filter((sale) => {
      // Payment filter
      if (methodFilter !== "all" && sale.paymentMethod !== methodFilter)
        return false;

      // Date filter
      const saleDate = sale.createdAt.slice(0, 10);
      if (dateFilter === "today" && saleDate !== todayStr) return false;
      if (dateFilter === "yesterday" && saleDate !== yesterdayStr) return false;
      if (dateFilter === "week" && new Date(sale.createdAt) < sevenDaysAgo)
        return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          sale.receiptNumber.toLowerCase().includes(q) ||
          sale.cashierName.toLowerCase().includes(q) ||
          (sale.paymentReference &&
            sale.paymentReference.toLowerCase().includes(q)) ||
          sale.items.some((i) => i.productName.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [visibleSales, methodFilter, dateFilter, searchQuery]);

  const totalRevenue = useMemo(() => {
    return filteredSales.reduce((sum, s) => sum + s.total, 0);
  }, [filteredSales]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50">
      {/* Top Banner */}
      <div className="bg-white border-b border-slate-200 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-emerald-700" />
              <span>Sales Transactions &amp; Receipts</span>
            </h2>
            <p className="text-xs text-slate-500">
              {isCashier
                ? `Showing transactions processed by ${viewer.name}`
                : "Central register of completed customer transactions and audit receipts"}
            </p>
          </div>

          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
            <span className="text-[11px] font-semibold text-emerald-800">
              Filtered Total:
            </span>
            <span className="text-sm font-extrabold text-emerald-950">
              {settings.currency}
              {totalRevenue.toLocaleString()}
            </span>
            <span className="text-xs text-emerald-700 font-medium">
              ({filteredSales.length}{" "}
              {filteredSales.length === 1 ? "sale" : "sales"})
            </span>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-col sm:flex-row gap-2 pt-1 border-t border-slate-100">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by receipt number (e.g. HS-20261012), item name, or cashier..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {/* Date filter pills */}
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl">
              <button
                onClick={() => setDateFilter("all")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                  dateFilter === "all"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600"
                }`}
              >
                All Time
              </button>
              <button
                onClick={() => setDateFilter("today")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                  dateFilter === "today"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600"
                }`}
              >
                Today
              </button>
              <button
                onClick={() => setDateFilter("yesterday")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                  dateFilter === "yesterday"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600"
                }`}
              >
                Yesterday
              </button>
              <button
                onClick={() => setDateFilter("week")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                  dateFilter === "week"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600"
                }`}
              >
                Last 7 Days
              </button>
            </div>

            {/* Payment method selector */}
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none"
            >
              <option value="all">All Payment Methods</option>
              <option value="CASH">Cash</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="POS_CARD">POS / Card</option>
            </select>
          </div>
        </div>
      </div>

      {/* Sales Table */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-5">
        <div className="max-w-6xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Receipt No &amp; Time</th>
                  <th className="py-3 px-3">Cashier</th>
                  <th className="py-3 px-3">Items Summary</th>
                  <th className="py-3 px-3">Payment</th>
                  <th className="py-3 px-3 text-right">Total Amount</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No matching sales records found.
                    </td>
                  </tr>
                ) : (
                  filteredSales.map((sale) => {
                    const formattedTime = new Date(
                      sale.createdAt,
                    ).toLocaleString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    });

                    return (
                      <tr
                        key={sale.id}
                        className="hover:bg-slate-50/70 transition"
                      >
                        <td className="py-3 px-4">
                          <div className="font-mono font-bold text-slate-900 text-xs">
                            {sale.receiptNumber}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {formattedTime}
                          </div>
                        </td>
                        <td className="py-3 px-3 font-medium text-slate-700">
                          {sale.cashierName}
                        </td>
                        <td className="py-3 px-3">
                          <div className="text-slate-800 line-clamp-1 max-w-xs">
                            {sale.items
                              .map(
                                (i) =>
                                  `${i.productName} (${i.quantity}${i.sellingUnitName ? ` ${i.sellingUnitName}` : ""})`,
                              )
                              .join(", ")}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {sale.items.reduce((acc, i) => acc + i.quantity, 0)}{" "}
                            selling units
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              sale.paymentMethod === "CASH"
                                ? "bg-emerald-100 text-emerald-800"
                                : sale.paymentMethod === "BANK_TRANSFER"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-purple-100 text-purple-800"
                            }`}
                          >
                            {sale.paymentMethod === "CASH" && (
                              <Banknote className="w-3 h-3" />
                            )}
                            {sale.paymentMethod === "BANK_TRANSFER" && (
                              <Building2 className="w-3 h-3" />
                            )}
                            {sale.paymentMethod === "POS_CARD" && (
                              <CreditCard className="w-3 h-3" />
                            )}
                            {sale.paymentMethod}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-extrabold text-slate-900 text-sm">
                          {settings.currency}
                          {sale.total.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setSelectedSaleForDetails(sale)}
                              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
                              title="View Sale Breakdown"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setActiveReceipt(sale)}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-bold transition flex items-center gap-1"
                              title="Reprint Receipt"
                            >
                              <Printer className="w-3 h-3" />
                              <span>Receipt</span>
                            </button>
                          </div>
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

      {/* MODAL: SALE DETAILS */}
      {selectedSaleForDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-auto">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold font-mono">
                  {selectedSaleForDetails.receiptNumber}
                </h3>
                <p className="text-xs text-slate-400">
                  {new Date(selectedSaleForDetails.createdAt).toLocaleString(
                    "en-GB",
                  )}
                </p>
              </div>
              <button
                onClick={() => setSelectedSaleForDetails(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-slate-500 block">Cashier</span>
                  <span className="font-bold text-slate-900">
                    {selectedSaleForDetails.cashierName}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Payment Method</span>
                  <span className="font-bold text-slate-900">
                    {selectedSaleForDetails.paymentMethod}
                  </span>
                </div>
                {selectedSaleForDetails.paymentReference && (
                  <div className="col-span-2 pt-1 border-t border-slate-200">
                    <span className="text-slate-500 block">
                      Payment Reference
                    </span>
                    <span className="font-mono text-slate-800">
                      {selectedSaleForDetails.paymentReference}
                    </span>
                  </div>
                )}
              </div>

              {/* Items List */}
              <div className="space-y-1.5">
                <div className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                  Purchased Items
                </div>
                <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto border border-slate-200 rounded-xl p-2 bg-white">
                  {selectedSaleForDetails.items.map((item) => (
                    <div
                      key={item.id}
                      className="py-2 flex justify-between items-center text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-900">
                          {item.productName}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {item.quantity} × {settings.currency}
                          {item.unitPrice.toLocaleString()}
                        </div>
                      </div>
                      <div className="font-bold text-slate-900">
                        {settings.currency}
                        {item.lineTotal.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Totals */}
              <div className="space-y-1.5 pt-2 border-t border-slate-200 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span>
                    {settings.currency}
                    {selectedSaleForDetails.subtotal.toLocaleString()}
                  </span>
                </div>
                {selectedSaleForDetails.discount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-semibold">
                    <span>Discount</span>
                    <span>
                      -{settings.currency}
                      {selectedSaleForDetails.discount.toLocaleString()}
                    </span>
                  </div>
                )}
                {selectedSaleForDetails.taxAmount > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>VAT</span>
                    <span>
                      {settings.currency}
                      {selectedSaleForDetails.taxAmount.toLocaleString()}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-extrabold text-slate-900 pt-1 border-t border-slate-200">
                  <span>Total Paid</span>
                  <span>
                    {settings.currency}
                    {selectedSaleForDetails.total.toLocaleString()}
                  </span>
                </div>
                {selectedSaleForDetails.paymentMethod === "CASH" &&
                  selectedSaleForDetails.changeAmount > 0 && (
                    <div className="flex justify-between text-emerald-800 font-bold">
                      <span>Change Returned</span>
                      <span>
                        {settings.currency}
                        {selectedSaleForDetails.changeAmount.toLocaleString()}
                      </span>
                    </div>
                  )}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex gap-2">
              <button
                onClick={() => setSelectedSaleForDetails(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const s = selectedSaleForDetails;
                  setSelectedSaleForDetails(null);
                  setActiveReceipt(s);
                }}
                className="flex-1 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-sm flex items-center justify-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Open Receipt Slip</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
