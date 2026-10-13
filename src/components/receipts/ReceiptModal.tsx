import React, { useRef } from "react";
import { Sale } from "../../types";
import { useStore } from "../../context/StoreContext";
import {
  Printer,
  X,
  Share2,
  Copy,
  Check,
  ShoppingBag,
  ArrowRight,
} from "lucide-react";
import confetti from "canvas-confetti";

interface ReceiptModalProps {
  sale: Sale | null;
  onClose: () => void;
  onNewSale?: () => void;
  isNewSaleCompleted?: boolean;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  sale,
  onClose,
  onNewSale,
  isNewSaleCompleted = false,
}) => {
  const { dbState, showToast } = useStore();
  const [copied, setCopied] = React.useState(false);
  const receiptPrintRef = useRef<HTMLDivElement>(null);

  // Trigger celebration confetti if this was just completed
  React.useEffect(() => {
    if (sale && isNewSaleCompleted) {
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.65 },
        });
      } catch {
        // ignore
      }
    }
  }, [sale, isNewSaleCompleted]);

  if (!sale) return null;

  const { settings } = dbState;
  const formattedDate = new Date(sale.createdAt).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const handlePrint = () => {
    window.print();
  };

  const generateReceiptText = () => {
    let text = `================================\n`;
    text += `         ${settings.storeName.toUpperCase()}\n`;
    text += `      ${settings.branchName}\n`;
    text += `   ${settings.address}\n`;
    text += `       Tel: ${settings.phone}\n`;
    text += `================================\n`;
    text += `Receipt No: ${sale.receiptNumber}\n`;
    text += `Date: ${formattedDate}\n`;
    text += `Cashier: ${sale.cashierName}\n`;
    text += `--------------------------------\n`;
    text += `ITEM            QTY  PRICE   TOTAL\n`;
    text += `--------------------------------\n`;
    sale.items.forEach((item) => {
      const quantityLabel =
        `${item.quantity} ${item.sellingUnitName || ""}`.trim();
      const line = `${item.productName.slice(0, 15).padEnd(16)} ${quantityLabel} x ${settings.currency}${item.unitPrice.toLocaleString().padStart(5)} = ${settings.currency}${item.lineTotal.toLocaleString()}\n`;
      text += line;
    });
    text += `--------------------------------\n`;
    text += `Subtotal:      ${settings.currency}${sale.subtotal.toLocaleString()}\n`;
    if (sale.discount > 0) {
      text += `Discount:     -${settings.currency}${sale.discount.toLocaleString()}\n`;
    }
    if (sale.taxAmount > 0) {
      text += `Tax / VAT:     ${settings.currency}${sale.taxAmount.toLocaleString()}\n`;
    }
    text += `TOTAL:         ${settings.currency}${sale.total.toLocaleString()}\n`;
    text += `--------------------------------\n`;
    text += `Payment:       ${sale.paymentMethod}\n`;
    text += `Amount Paid:   ${settings.currency}${sale.amountPaid.toLocaleString()}\n`;
    if (sale.changeAmount > 0) {
      text += `Change Given:  ${settings.currency}${sale.changeAmount.toLocaleString()}\n`;
    }
    if (sale.paymentReference) {
      text += `Ref:           ${sale.paymentReference}\n`;
    }
    text += `================================\n`;
    text += `${settings.receiptFooter}\n`;
    text += `================================\n`;
    return text;
  };

  const handleCopyText = async () => {
    try {
      const text = generateReceiptText();
      await navigator.clipboard.writeText(text);
      setCopied(true);
      showToast("Receipt text copied to clipboard for WhatsApp/SMS", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast("Could not copy to clipboard.", "error");
    }
  };

  const handleShare = async () => {
    const text = generateReceiptText();
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Receipt ${sale.receiptNumber} - ${settings.storeName}`,
          text: text,
        });
      } catch {
        // user cancelled share
      }
    } else {
      handleCopyText();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in print:p-0 print:bg-white print:fixed-none">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col my-auto border border-slate-200 print:shadow-none print:border-none print:max-w-full">
        {/* Modal Header (Hidden during physical print) */}
        <div className="flex items-center justify-between p-4 bg-emerald-800 text-white print:hidden">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-emerald-300" />
            <h3 className="text-base font-bold">Transaction Receipt</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Thermal Receipt Slip */}
        <div
          ref={receiptPrintRef}
          className="p-6 bg-white font-mono text-xs text-slate-800 space-y-4 print:p-0"
        >
          {/* Business Header */}
          <div className="text-center space-y-1 pb-3 border-b border-dashed border-slate-300">
            <h2 className="text-base font-extrabold uppercase tracking-tight text-slate-900 font-sans">
              {settings.storeName}
            </h2>
            <p className="text-[11px] text-slate-600 font-sans">
              {settings.branchName}
            </p>
            <p className="text-[10px] text-slate-500 font-sans">
              {settings.address}
            </p>
            <p className="text-[10px] text-slate-500 font-sans">
              Tel: {settings.phone}
            </p>
          </div>

          {/* Meta Info */}
          <div className="space-y-1 text-[11px] pb-3 border-b border-dashed border-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-500">Receipt No:</span>
              <span className="font-bold text-slate-900">
                {sale.receiptNumber}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Date/Time:</span>
              <span>{formattedDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Cashier:</span>
              <span className="font-medium text-slate-900">
                {sale.cashierName}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Status:</span>
              <span className="font-bold text-emerald-700 uppercase">
                Paid · {sale.paymentMethod}
              </span>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="space-y-2 pb-3 border-b border-dashed border-slate-300">
            <div className="grid grid-cols-12 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200 pb-1">
              <span className="col-span-6">Item</span>
              <span className="col-span-2 text-center">Qty</span>
              <span className="col-span-4 text-right">Total</span>
            </div>

            {sale.items.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-12 text-[11px] py-0.5 leading-snug"
              >
                <div className="col-span-6 font-sans">
                  <div className="font-medium text-slate-900 line-clamp-2">
                    {item.productName}
                  </div>
                  <div className="text-[9px] text-slate-500">
                    {settings.currency}
                    {item.unitPrice.toLocaleString()} /{" "}
                    {item.sellingUnitName || "unit"}
                  </div>
                </div>
                <div className="col-span-2 text-center self-start pt-0.5 font-bold">
                  {item.quantity} {item.sellingUnitName || ""}
                </div>
                <div className="col-span-4 text-right self-start pt-0.5 font-bold text-slate-900">
                  {settings.currency}
                  {item.lineTotal.toLocaleString()}
                </div>
              </div>
            ))}
          </div>

          {/* Totals & Calculations */}
          <div className="space-y-1.5 text-xs pb-3 border-b border-dashed border-slate-300">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span>
                {settings.currency}
                {sale.subtotal.toLocaleString()}
              </span>
            </div>

            {sale.discount > 0 && (
              <div className="flex justify-between text-emerald-700 font-semibold">
                <span>Discount Applied</span>
                <span>
                  -{settings.currency}
                  {sale.discount.toLocaleString()}
                </span>
              </div>
            )}

            {sale.taxAmount > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>VAT / Tax</span>
                <span>
                  {settings.currency}
                  {sale.taxAmount.toLocaleString()}
                </span>
              </div>
            )}

            <div className="flex justify-between text-base font-extrabold text-slate-900 pt-1 border-t border-slate-200">
              <span>TOTAL DUE</span>
              <span>
                {settings.currency}
                {sale.total.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Payment Breakdown */}
          <div className="space-y-1 text-[11px] pb-3 border-b border-dashed border-slate-300 bg-slate-50 p-2.5 rounded-lg">
            <div className="flex justify-between">
              <span className="text-slate-600">Payment Method:</span>
              <span className="font-bold text-slate-900">
                {sale.paymentMethod}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Amount Tendered:</span>
              <span className="font-semibold text-slate-900">
                {settings.currency}
                {sale.amountPaid.toLocaleString()}
              </span>
            </div>
            {sale.paymentMethod === "CASH" && (
              <div className="flex justify-between font-bold text-emerald-800">
                <span>Customer Change:</span>
                <span>
                  {settings.currency}
                  {sale.changeAmount.toLocaleString()}
                </span>
              </div>
            )}
            {sale.paymentReference && (
              <div className="flex justify-between text-[10px] text-slate-500 pt-0.5">
                <span>Payment Ref:</span>
                <span className="font-mono">{sale.paymentReference}</span>
              </div>
            )}
          </div>

          {/* Receipt Footer Message */}
          <div className="text-center space-y-1 pt-1 text-[10px] text-slate-500 font-sans">
            <p className="font-medium text-slate-700">
              {settings.receiptFooter}
            </p>
            <p className="text-[9px] text-slate-400">
              Powered by Hellen Store POS System
            </p>
          </div>
        </div>

        {/* Action Controls (Hidden on print) */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 space-y-2 print:hidden">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold shadow-sm transition active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Print Slip</span>
            </button>
            <button
              onClick={handleShare}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition active:scale-95"
            >
              <Share2 className="w-4 h-4 text-emerald-700" />
              <span>Share Slip</span>
            </button>
          </div>

          <button
            onClick={handleCopyText}
            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span>
              {copied ? "Copied Receipt Text!" : "Copy Text (WhatsApp/SMS)"}
            </span>
          </button>

          {onNewSale && (
            <button
              onClick={() => {
                onClose();
                onNewSale();
              }}
              className="w-full mt-2 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold shadow-md transition active:scale-95"
            >
              <span>Start New Sale</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
