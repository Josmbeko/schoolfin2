import React, { useRef, useState } from 'react';
import { X, Printer, Download, CheckCircle2 } from 'lucide-react';
import { Receipt, School } from '../../types';
import { formatCurrency, formatDateTime } from '../../utils/formatters';

interface ReceiptModalProps {
  receipt: Receipt | null;
  school: School | null;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ receipt, school, onClose }) => {
  const [printFormat, setPrintFormat] = useState<'a4' | 'thermal'>('a4');
  const printRef = useRef<HTMLDivElement>(null);

  if (!receipt) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[94vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Controls Bar (hidden during printing) */}
        <div className="no-print bg-slate-900 text-white px-4 sm:px-6 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="font-semibold text-xs sm:text-sm">Reçu Officiel d'Encaissement</h3>
              <p className="text-[11px] text-slate-400">{receipt.receiptNumber}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Format toggle */}
            <div className="flex bg-slate-800 p-0.5 rounded-lg text-xs font-medium">
              <button
                type="button"
                onClick={() => setPrintFormat('a4')}
                className={`px-2.5 sm:px-3 py-1 rounded transition-colors text-xs ${printFormat === 'a4' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-300 hover:text-white'}`}
              >
                A4
              </button>
              <button
                type="button"
                onClick={() => setPrintFormat('thermal')}
                className={`px-2.5 sm:px-3 py-1 rounded transition-colors text-xs ${printFormat === 'thermal' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-300 hover:text-white'}`}
              >
                80mm
              </button>
            </div>

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Imprimer
            </button>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Content */}
        <div className="p-4 sm:p-8 overflow-y-auto flex-1 bg-slate-50 flex justify-center">
          <div
            ref={printRef}
            className={`printable-area bg-white text-slate-900 border border-slate-200 shadow-sm p-8 transition-all ${
              printFormat === 'thermal' ? 'max-w-sm text-xs font-mono' : 'max-w-xl w-full text-sm'
            }`}
          >
            {/* School Header */}
            <div className="text-center border-b border-slate-200 pb-4 mb-5">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-900 text-white font-bold text-xl mb-2">
                {school?.name?.charAt(0) || 'E'}
              </div>
              <h2 className="text-lg font-bold tracking-tight text-slate-900 uppercase">
                {school?.name || 'Établissement Scolaire'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {school?.address ? `${school.address} · ` : ''}
                {[school?.city, school?.province, school?.country].filter(Boolean).join(' – ')}
              </p>
              <p className="text-xs text-slate-500">
                Tél : {school?.phone || '+243 00 000 0000'} · Email : {school?.email || 'contact@ecole.cd'}
              </p>
            </div>

            {/* Receipt Title & Meta */}
            <div className="flex justify-between items-start mb-6">
              <div>
                <span className="text-xs font-semibold tracking-wider uppercase text-indigo-700">
                  REÇU DE PAIEMENT
                </span>
                <p className="text-base font-bold text-slate-900">{receipt.receiptNumber}</p>
              </div>
              <div className="text-right text-xs text-slate-500">
                <p>Date : <strong className="text-slate-800">{formatDateTime(receipt.issuedAt)}</strong></p>
                <p>Année Scolaire : <strong className="text-slate-800">{school?.schoolYear || '2026-2027'}</strong></p>
              </div>
            </div>

            {/* Student Info Box */}
            <div className="bg-slate-50 rounded-lg p-3.5 mb-5 border border-slate-200/80">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500">Élève :</span>{' '}
                  <strong className="text-slate-900 uppercase">{receipt.studentName}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Matricule :</span>{' '}
                  <strong className="text-slate-900 font-mono">{receipt.matricule}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Classe :</span>{' '}
                  <strong className="text-slate-900">{receipt.className}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Mode :</span>{' '}
                  <strong className="text-slate-900">{receipt.paymentMethod}</strong>
                </div>
                {receipt.targetMonth && (
                  <div className="col-span-2 pt-1 border-t border-slate-200/60 flex items-center justify-between">
                    <span className="text-slate-500">Mois / Objet Concerné :</span>{' '}
                    <strong className="text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200/60">
                      {receipt.targetMonth}
                    </strong>
                  </div>
                )}
              </div>
            </div>

            {/* Allocation Details */}
            <table className="w-full text-left mb-6 border-collapse">
              <thead>
                <tr className="border-b border-slate-300 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-2">Frais Scolaire</th>
                  <th className="py-2 text-right">Montant Encaissé</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {receipt.allocationsSummary && receipt.allocationsSummary.length > 0 ? (
                  receipt.allocationsSummary.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-2.5 font-medium text-slate-800">{item.label}</td>
                      <td className="py-2.5 text-right font-semibold text-slate-900">
                        {formatCurrency(item.amount, receipt.currency)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="py-2.5 text-slate-800 font-medium">Frais Scolaires</td>
                    <td className="py-2.5 text-right font-semibold text-slate-900">
                      {formatCurrency(receipt.amount, receipt.currency)}
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-900 font-bold text-sm">
                  <td className="py-3 uppercase text-slate-900">TOTAL PAYÉ :</td>
                  <td className="py-3 text-right text-indigo-700 text-base">
                    {formatCurrency(receipt.amount, receipt.currency)}
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* Amount In Words */}
            <div className="bg-slate-100/70 p-3 rounded text-xs mb-6 border border-slate-200">
              <span className="text-slate-500 block mb-0.5 font-medium">Montant en toutes lettres :</span>
              <p className="font-semibold text-slate-800 italic">
                « {receipt.amountInWords} »
              </p>
            </div>

            {receipt.note && (
              <p className="text-xs text-slate-500 mb-6 italic">Note : {receipt.note}</p>
            )}

            {/* Signature and Stamp Zone */}
            <div className="grid grid-cols-2 gap-8 pt-4 border-t border-dashed border-slate-300 text-xs text-center mt-6">
              <div>
                <p className="text-slate-500 mb-8">Signature de l'Élève ou Parent</p>
                <div className="border-b border-slate-300 w-3/4 mx-auto"></div>
              </div>
              <div>
                <p className="text-slate-500 mb-2">Caissier / Direction</p>
                <p className="font-semibold text-slate-800">{receipt.cashierName}</p>
                <div className="mt-4 inline-block border-2 border-slate-400 border-dashed rounded px-3 py-1 text-[10px] text-slate-500 uppercase tracking-widest">
                  Cachet & Signature
                </div>
              </div>
            </div>

            {/* Footer Notice */}
            <div className="text-center text-[10px] text-slate-400 mt-8 pt-3 border-t border-slate-100">
              Ce reçu constitue une preuve irréfutable de paiement. Tout duplicata doit porter la mention conforme.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
