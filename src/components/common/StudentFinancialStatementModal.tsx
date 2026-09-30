import React, { useRef, useState } from 'react';
import {
  X,
  Printer,
  FileText,
  CheckCircle,
  AlertCircle,
  Clock,
  Download,
  Calendar,
  DollarSign,
  User,
  School as SchoolIcon,
  CreditCard,
  ShieldCheck,
  Tag,
} from 'lucide-react';
import { Student, StudentCharge, Payment, School, ClassItem } from '../../types';
import { formatCurrency, formatDate, formatDateTime, getPaymentMethodLabel } from '../../utils/formatters';
import {
  ACADEMIC_YEAR_MONTHS,
  extractMonthFromCharge,
  getAcademicMonthIndex,
  MONTHS_OF_YEAR,
  isRegistrationFee,
} from '../../utils/academic';

interface StudentFinancialStatementModalProps {
  student: Student;
  school: School;
  charges: StudentCharge[];
  payments: Payment[];
  onClose: () => void;
  onOpenPaymentModal?: (student: Student) => void;
}

export const StudentFinancialStatementModal: React.FC<StudentFinancialStatementModalProps> = ({
  student,
  school,
  charges,
  payments,
  onClose,
  onOpenPaymentModal,
}) => {
  const currency = school.currency || 'CDF';
  const today = new Date().toISOString().split('T')[0];
  const printRef = useRef<HTMLDivElement>(null);

  // Déterminer le mois actuel
  const now = new Date();
  const currentCalendarMonth = MONTHS_OF_YEAR[now.getMonth()] || 'Septembre';
  const [selectedCutoffMonth, setSelectedCutoffMonth] = useState<string>(currentCalendarMonth);
  const [scopeFilter, setScopeFilter] = useState<'current_to_date' | 'all_year'>('current_to_date');

  const cutoffMonthIndex = getAcademicMonthIndex(selectedCutoffMonth);

  // Filtrer les charges pour cet élève
  const studentCharges = charges.filter(c => c.studentId === student.id && c.status !== 'cancelled');
  const studentPayments = payments.filter(p => p.studentId === student.id && p.status === 'posted');

  // Séparer les charges échues jusqu'à la date / mois en cours vs les échéances ultérieures
  const chargesUpToCurrent = studentCharges.filter(c => {
    if (scopeFilter === 'all_year') return true;

    // Frais d'inscription : toujours échu à date
    if (isRegistrationFee(c)) return true;

    // Vérifier selon le mois concerné
    const chgMonth = extractMonthFromCharge(c);
    if (chgMonth) {
      const chgIdx = getAcademicMonthIndex(chgMonth);
      if (chgIdx >= 0 && cutoffMonthIndex >= 0) {
        return chgIdx <= cutoffMonthIndex;
      }
    }

    // Sinon vérifier selon dueDate
    if (c.dueDate) {
      return c.dueDate <= today;
    }

    return true;
  });

  const futureCharges = studentCharges.filter(c => !chargesUpToCurrent.some(cur => cur.id === c.id));

  // Calculs financiers pour les frais à date
  const totalDueUpToDate = chargesUpToCurrent.reduce((acc, c) => acc + c.netAmount, 0);
  const totalPaidUpToDate = chargesUpToCurrent.reduce((acc, c) => acc + c.paidAmount, 0);
  const remainingDueUpToDate = Math.max(0, totalDueUpToDate - totalPaidUpToDate);

  // Détermination de la situation globale de l'élève à date :
  // "Non en règle" si litiges / frais non entièrement payés sans aucun versement
  // "Partielle" si des frais ont été payés en partie
  // "En règle" si 100% payé
  let overallSituation: 'in_order' | 'partial' | 'not_in_order' = 'in_order';
  if (remainingDueUpToDate > 0) {
    if (totalPaidUpToDate > 0) {
      overallSituation = 'partial';
    } else {
      overallSituation = 'not_in_order';
    }
  }

  // Détermination du statut spécifique de chaque frais individuel selon la consigne :
  // - "Non en règle" pour les frais non entièrement payés sans acompte
  // - "Partielle" pour les frais payés en partie
  // - "En règle" pour les frais soldés
  const getFeeStatusLabel = (netAmount: number, paidAmount: number) => {
    if (paidAmount >= netAmount) {
      return {
        label: 'En règle',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dotClass: 'bg-emerald-500',
      };
    }
    if (paidAmount > 0 && paidAmount < netAmount) {
      return {
        label: 'Partielle',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
        dotClass: 'bg-amber-500',
      };
    }
    return {
      label: 'Non en règle',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
      dotClass: 'bg-rose-500',
    };
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[95vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
        {/* Controls Bar (no-print) */}
        <div className="no-print bg-slate-900 text-white px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-xs sm:text-sm">
                Fiche Individuelle de Situation Financière & Frais
              </h3>
              <p className="text-[11px] text-slate-400">
                {student.lastName} {student.firstName} · Matricule : {student.matricule}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Toggle */}
            <div className="flex bg-slate-800 p-0.5 rounded-lg text-xs font-medium">
              <button
                type="button"
                onClick={() => setScopeFilter('current_to_date')}
                className={`px-3 py-1 rounded transition-colors ${
                  scopeFilter === 'current_to_date' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-300 hover:text-white'
                }`}
              >
                Jusqu'au mois en cours ({selectedCutoffMonth})
              </button>
              <button
                type="button"
                onClick={() => setScopeFilter('all_year')}
                className={`px-3 py-1 rounded transition-colors ${
                  scopeFilter === 'all_year' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-300 hover:text-white'
                }`}
              >
                Année complète
              </button>
            </div>

            {/* Print Button */}
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Imprimer / PDF
            </button>

            {/* Direct Pay button if balance exists */}
            {remainingDueUpToDate > 0 && onOpenPaymentModal && (
              <button
                onClick={() => {
                  onClose();
                  onOpenPaymentModal(student);
                }}
                className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                <CreditCard className="w-3.5 h-3.5" />
                Encaisser
              </button>
            )}

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Container */}
        <div className="p-3 sm:p-8 overflow-y-auto flex-1 bg-slate-100/70 flex justify-center">
          <div
            ref={printRef}
            className="printable-area bg-white text-slate-900 border border-slate-200 rounded-xl shadow-sm p-6 sm:p-10 max-w-3xl w-full text-xs space-y-6"
          >
            {/* Header Officiel de l'Établissement */}
            <div className="border-b-2 border-slate-900 pb-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  {school.logoUrl ? (
                    <img
                      src={school.logoUrl}
                      alt={school.name}
                      className="w-16 h-16 rounded-xl object-contain bg-white p-1 border border-slate-200 shadow-xs"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-2xl shadow-xs">
                      {school.name ? school.name.charAt(0) : 'E'}
                    </div>
                  )}

                  <div>
                    <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-widest block">
                      République Démocratique du Congo · Ministère de l'Éducation
                    </span>
                    <h1 className="text-base sm:text-lg font-black uppercase text-slate-900 tracking-tight leading-tight">
                      {school.name || 'Établissement Scolaire'}
                    </h1>
                    <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                      {school.address ? `${school.address} · ` : ''}
                      {[school.city, school.province, school.country].filter(Boolean).join(' – ')}
                    </p>
                    <p className="text-[11px] text-slate-500 font-mono">
                      Tél : {school.phone || 'Non renseigné'} · Email : {school.email || 'Non renseigné'}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="inline-block px-2.5 py-1 rounded bg-slate-100 font-mono font-bold text-[11px] text-slate-800 border border-slate-200">
                    Année : {school.schoolYear}
                  </span>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Édité le {formatDate(today)}
                  </p>
                </div>
              </div>

              {/* Titre Principal de la Fiche */}
              <div className="mt-5 text-center bg-slate-50 border border-slate-200 py-2.5 px-4 rounded-xl">
                <h2 className="text-sm sm:text-base font-black uppercase tracking-wider text-slate-900">
                  Fiche Individuelle de Situation Financière & Frais Scolaires
                </h2>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Situation arrêtée à la date du <strong>{formatDate(today)}</strong> (Mois de référence :{' '}
                  <strong>{selectedCutoffMonth} {school.schoolYear}</strong>)
                </p>
              </div>
            </div>

            {/* Identité de l'Élève */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/70 border border-slate-200 rounded-xl p-4 text-xs">
              <div className="space-y-1.5">
                <div>
                  <span className="text-slate-500">Nom & Prénom de l'Élève :</span>{' '}
                  <strong className="text-slate-900 uppercase font-bold text-sm block sm:inline">
                    {student.lastName} {student.firstName}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500">Matricule Scolaire :</span>{' '}
                  <strong className="font-mono font-bold text-indigo-700">{student.matricule}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Genre :</span>{' '}
                  <span className="font-medium text-slate-800">{student.gender === 'M' ? 'Masculin' : 'Féminin'}</span>
                  {student.dateOfBirth && (
                    <span className="text-slate-500 ml-2">
                      · Né(e) le : <strong className="text-slate-800">{formatDate(student.dateOfBirth)}</strong>
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <div>
                  <span className="text-slate-500">Section Académique :</span>{' '}
                  <strong className="text-indigo-900 font-bold px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200">
                    {student.section || 'Générale'}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500">Classe :</span>{' '}
                  <strong className="text-slate-900 font-semibold">{student.className || '-'}</strong>
                  {student.optionName && (
                    <span className="text-slate-600 block text-[11px]">Option : {student.optionName}</span>
                  )}
                </div>
                <div>
                  <span className="text-slate-500">Parent / Tuteur :</span>{' '}
                  <strong className="text-slate-800">{student.parentName || '-'}</strong> ({student.parentPhone || '-'})
                </div>
              </div>
            </div>

            {/* Bandeau de Situation Globale à ce Jour */}
            <div
              className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                overallSituation === 'in_order'
                  ? 'bg-emerald-50/80 border-emerald-300 text-emerald-900'
                  : overallSituation === 'partial'
                  ? 'bg-amber-50/80 border-amber-300 text-amber-900'
                  : 'bg-rose-50/80 border-rose-300 text-rose-900'
              }`}
            >
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75">
                  Statut Réglementaire Global (à date du {selectedCutoffMonth})
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  {overallSituation === 'in_order' ? (
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <AlertCircle
                      className={`w-5 h-5 ${
                        overallSituation === 'partial' ? 'text-amber-600' : 'text-rose-600'
                      }`}
                    />
                  )}
                  <span className="text-base font-black uppercase tracking-tight">
                    {overallSituation === 'in_order'
                      ? 'ÉLÈVE EN RÈGLE AVEC LES FRAIS SCOLAIRES'
                      : overallSituation === 'partial'
                      ? 'SITUATION PARTIELLE (ACOMPTES VERSÉS / SOLDE EN ATTENTE)'
                      : 'NON EN RÈGLE AVEC LES FRAIS SCOLAIRES'}
                  </span>
                </div>
                <p className="text-[11px] mt-1 opacity-90 leading-tight">
                  {overallSituation === 'in_order'
                    ? 'Tous les frais scolaires et obligations prévus jusqu’à la date et le mois en cours sont intégralement soldés.'
                    : overallSituation === 'partial'
                    ? 'L’élève a effectué des versements partiels. Le solde restant doit être régularisé conformément au calendrier.'
                    : 'L’élève présente des frais échus impayés ou des litiges à ce jour. Régularisation immédiate exigée.'}
                </p>
              </div>

              {/* Résumé chiffré */}
              <div className="flex items-center gap-4 bg-white/90 p-3 rounded-lg border border-slate-200/80 shrink-0 text-right">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-semibold">Exigible à date</span>
                  <strong className="text-xs font-bold text-slate-900">
                    {formatCurrency(totalDueUpToDate, currency)}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-semibold">Total Payé</span>
                  <strong className="text-xs font-bold text-emerald-700">
                    {formatCurrency(totalPaidUpToDate, currency)}
                  </strong>
                </div>
                <div className="border-l border-slate-200 pl-3">
                  <span className="text-[10px] text-slate-500 block uppercase font-semibold">Solde Dû</span>
                  <strong
                    className={`text-sm font-black ${
                      remainingDueUpToDate > 0 ? 'text-rose-600' : 'text-emerald-700'
                    }`}
                  >
                    {formatCurrency(remainingDueUpToDate, currency)}
                  </strong>
                </div>
              </div>
            </div>

            {/* Tableau 1 : Frais Exigibles jusqu'à la Date et le Mois en Cours */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-indigo-600" />
                  1. État Détaillé des Frais dus jusqu'à la Date et le Mois en Cours ({selectedCutoffMonth})
                </h3>
                <span className="text-[11px] text-slate-500">
                  {chargesUpToCurrent.length} obligation(s) exigible(s)
                </span>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead className="bg-slate-100 text-slate-600 uppercase tracking-wider font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Frais Scolaire</th>
                      <th className="py-2.5 px-2.5">Période / Mois</th>
                      <th className="py-2.5 px-2.5">Échéance</th>
                      <th className="py-2.5 px-2.5 text-right">Net Dû</th>
                      <th className="py-2.5 px-2.5 text-right">Montant Payé</th>
                      <th className="py-2.5 px-2.5 text-right">Reste à Payer</th>
                      <th className="py-2.5 px-3 text-center">Situation Réglementaire</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {chargesUpToCurrent.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-slate-400">
                          Aucun frais facturé pour cette période.
                        </td>
                      </tr>
                    ) : (
                      chargesUpToCurrent.map(c => {
                        const remaining = Math.max(0, c.netAmount - c.paidAmount);
                        const statusMeta = getFeeStatusLabel(c.netAmount, c.paidAmount);
                        const monthLabel = extractMonthFromCharge(c) || c.applicableMonth || '-';

                        return (
                          <tr key={c.id} className="hover:bg-slate-50/70">
                            <td className="py-2 px-3 font-semibold text-slate-900">
                              {c.label}
                            </td>
                            <td className="py-2 px-2.5 text-slate-700 font-medium">
                              {monthLabel}
                            </td>
                            <td className="py-2 px-2.5 text-slate-500 font-mono text-[10px]">
                              {formatDate(c.dueDate)}
                            </td>
                            <td className="py-2 px-2.5 text-right font-bold text-slate-900">
                              {formatCurrency(c.netAmount, currency)}
                            </td>
                            <td className="py-2 px-2.5 text-right text-emerald-700 font-semibold">
                              {formatCurrency(c.paidAmount, currency)}
                            </td>
                            <td className="py-2 px-2.5 text-right font-bold text-rose-600">
                              {formatCurrency(remaining, currency)}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold text-[10px] border ${statusMeta.badgeClass}`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotClass}`}></span>
                                {statusMeta.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {/* Total Footer */}
                  <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900">
                    <tr>
                      <td colSpan={3} className="py-2 px-3 uppercase text-[10px]">
                        Total des Frais à Date ({selectedCutoffMonth})
                      </td>
                      <td className="py-2 px-2.5 text-right">{formatCurrency(totalDueUpToDate, currency)}</td>
                      <td className="py-2 px-2.5 text-right text-emerald-700">
                        {formatCurrency(totalPaidUpToDate, currency)}
                      </td>
                      <td className="py-2 px-2.5 text-right text-rose-600">
                        {formatCurrency(remainingDueUpToDate, currency)}
                      </td>
                      <td className="py-2 px-3 text-center text-[10px] uppercase text-slate-600">
                        {overallSituation === 'in_order' ? 'Soldé 100%' : 'Litige / Reliquat'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Tableau 2 : Échéances Ultérieures (Mois suivants de l'année scolaire) */}
            {futureCharges.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-700 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    2. Échéances Ultérieures (Frais des mois postérieurs à {selectedCutoffMonth})
                  </h3>
                  <span className="text-[10px] text-slate-400">Pour information et prévision budgétaire</span>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">Frais à Venir</th>
                        <th className="py-2 px-2.5">Mois</th>
                        <th className="py-2 px-2.5">Date Échéance</th>
                        <th className="py-2 px-2.5 text-right">Montant Exigible</th>
                        <th className="py-2 px-2.5 text-right">Montant Anticipé</th>
                        <th className="py-2 px-3 text-center">État d'Avancement</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {futureCharges.map(fc => {
                        const m = extractMonthFromCharge(fc) || fc.applicableMonth || '-';
                        return (
                          <tr key={fc.id} className="text-slate-600 hover:bg-slate-50/50">
                            <td className="py-1.5 px-3 font-medium text-slate-800">{fc.label}</td>
                            <td className="py-1.5 px-2.5 font-medium">{m}</td>
                            <td className="py-1.5 px-2.5 font-mono text-[10px] text-slate-400">
                              {formatDate(fc.dueDate)}
                            </td>
                            <td className="py-1.5 px-2.5 text-right font-medium text-slate-800">
                              {formatCurrency(fc.netAmount, currency)}
                            </td>
                            <td className="py-1.5 px-2.5 text-right text-emerald-600">
                              {fc.paidAmount > 0 ? formatCurrency(fc.paidAmount, currency) : '-'}
                            </td>
                            <td className="py-1.5 px-3 text-center text-[10px]">
                              {fc.paidAmount >= fc.netAmount ? (
                                <span className="text-emerald-700 font-bold">Payé d'avance</span>
                              ) : fc.paidAmount > 0 ? (
                                <span className="text-amber-700 font-medium">Acompte versé</span>
                              ) : (
                                <span className="text-slate-400">Non échu</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tableau 3 : Versements & Reçus Réalisés par l'Élève */}
            {studentPayments.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-bold text-slate-700 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                  3. Historique des Règlements Effectués au Guichet
                </h3>

                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">N° Reçu</th>
                        <th className="py-2 px-2.5">Date</th>
                        <th className="py-2 px-2.5">Mode</th>
                        <th className="py-2 px-2.5">Mois Concerné</th>
                        <th className="py-2 px-2.5">Caissier / Agent</th>
                        <th className="py-2 px-3 text-right">Montant Versé</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {studentPayments.map(p => (
                        <tr key={p.id}>
                          <td className="py-1.5 px-3 font-mono font-bold text-indigo-700">{p.receiptNumber}</td>
                          <td className="py-1.5 px-2.5 text-slate-600">{formatDate(p.paymentDate)}</td>
                          <td className="py-1.5 px-2.5 text-slate-700">{getPaymentMethodLabel(p.paymentMethod)}</td>
                          <td className="py-1.5 px-2.5 font-medium text-slate-800">{p.targetMonth || '-'}</td>
                          <td className="py-1.5 px-2.5 text-slate-500">{p.createdByName}</td>
                          <td className="py-1.5 px-3 text-right font-bold text-emerald-700">
                            {formatCurrency(p.amount, currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Certification & Signatures Officielles */}
            <div className="pt-6 border-t border-slate-300">
              <div className="text-[11px] text-slate-500 italic mb-6">
                Attestation officielle délivrée pour servir et valoir ce que de droit en matière de scolarité, délibération, inscription et réadmission.
              </div>

              <div className="grid grid-cols-3 gap-6 text-center text-xs">
                <div className="space-y-16">
                  <span className="font-bold text-slate-800 uppercase block text-[10px] tracking-wider">
                    Le Responsable / Parent
                  </span>
                  <div className="border-t border-dashed border-slate-400 pt-1 text-[10px] text-slate-400">
                    Signature du Parent
                  </div>
                </div>

                <div className="space-y-16">
                  <span className="font-bold text-slate-800 uppercase block text-[10px] tracking-wider">
                    Le Caissier / Comptable
                  </span>
                  <div className="border-t border-dashed border-slate-400 pt-1 text-[10px] text-slate-400">
                    Visa & Emargement
                  </div>
                </div>

                <div className="space-y-16">
                  <span className="font-bold text-slate-800 uppercase block text-[10px] tracking-wider">
                    La Direction / Sceau de l'École
                  </span>
                  <div className="border-t border-dashed border-slate-400 pt-1 text-[10px] text-slate-400">
                    Sceau officiel & Signature
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
