import React, { useRef, useState } from 'react';
import {
  Printer,
  X,
  AlertCircle,
  CheckCircle,
  Clock,
  Calendar,
  DollarSign,
  User,
  GraduationCap,
  Building,
  Phone,
  Mail,
  ShieldCheck,
  AlertTriangle,
  FileText,
  BadgeAlert,
} from 'lucide-react';
import { Student, School, StudentCharge, Payment } from '../../types';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { extractMonthFromCharge, getAcademicMonthIndex, ACADEMIC_YEAR_MONTHS, MONTHS_OF_YEAR } from '../../utils/academic';

interface StudentSituationStatementModalProps {
  student: Student;
  school: School;
  charges: StudentCharge[];
  payments: Payment[];
  onClose: () => void;
}

export const StudentSituationStatementModal: React.FC<StudentSituationStatementModalProps> = ({
  student,
  school,
  charges,
  payments,
  onClose,
}) => {
  const printRef = useRef<HTMLDivElement>(null);
  const [periodFilter, setPeriodFilter] = useState<'current_date' | 'full_year'>('current_date');

  // Date du jour et mois en cours
  const today = new Date();
  const todayFormatted = today.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const currentMonthName = MONTHS_OF_YEAR[today.getMonth()];
  const currentAcademicMonthIdx = getAcademicMonthIndex(currentMonthName);

  // Filtrer les charges de cet élève
  const studentCharges = charges.filter(
    c => c.studentId === student.id && c.status !== 'cancelled'
  );

  // Filtrer les paiements de cet élève
  const studentPayments = payments.filter(
    p => p.studentId === student.id && p.status !== 'voided'
  );

  // Déterminer pour chaque charge si elle est échue / exigible jusqu'à la date et le mois en cours
  const evaluatedCharges = studentCharges.map(charge => {
    const chargeMonth = extractMonthFromCharge(charge);
    const chargeMonthIdx = getAcademicMonthIndex(chargeMonth);

    // Déterminer si le frais est dû à la date/mois en cours
    let isDueUpToCurrentDate = true;

    if (chargeMonthIdx >= 0 && currentAcademicMonthIdx >= 0) {
      // Frais lié à un mois : échu si son mois est antérieur ou égal au mois en cours
      isDueUpToCurrentDate = chargeMonthIdx <= currentAcademicMonthIdx;
    } else if (charge.dueDate) {
      // Comparer avec la date du jour
      const todayISO = today.toISOString().split('T')[0];
      isDueUpToCurrentDate = charge.dueDate <= todayISO;
    } else {
      // Par défaut (ex: inscription, frais généraux annuels), considéré exigible dès le début
      isDueUpToCurrentDate = true;
    }

    const net = charge.netAmount ?? (charge.amountDue - (charge.discountAmount || 0));
    const paid = charge.paidAmount || 0;
    const remaining = Math.max(0, net - paid);

    // Statut selon la règle utilisateur stricte :
    // "Un élève qui a encore des litiges jusqu'à la date en cours,
    //  sa situation doit être "non en règle" pour les frais non entièrement payé et "Partielle" pour les frais payés en partie"
    let statusLabel: 'En règle' | 'Partielle' | 'Non en règle';
    let statusColor: string;
    let statusBg: string;

    if (remaining === 0 || paid >= net) {
      statusLabel = 'En règle';
      statusColor = 'text-emerald-700 border-emerald-300';
      statusBg = 'bg-emerald-50';
    } else if (paid > 0 && remaining > 0) {
      statusLabel = 'Partielle';
      statusColor = 'text-amber-700 border-amber-300';
      statusBg = 'bg-amber-50';
    } else {
      statusLabel = 'Non en règle';
      statusColor = 'text-rose-700 border-rose-300';
      statusBg = 'bg-rose-50';
    }

    return {
      ...charge,
      chargeMonth,
      chargeMonthIdx,
      isDueUpToCurrentDate,
      net,
      paid,
      remaining,
      statusLabel,
      statusColor,
      statusBg,
    };
  });

  // Charges filtrées selon la vue : Échues à ce jour VS Toute l'année
  const displayCharges = periodFilter === 'current_date'
    ? evaluatedCharges.filter(c => c.isDueUpToCurrentDate)
    : evaluatedCharges;

  // Séparation Frais Payés vs Frais Non Entièrement Payés (Litiges)
  const paidCharges = displayCharges.filter(c => c.statusLabel === 'En règle');
  const unpaidOrPartialCharges = displayCharges.filter(c => c.statusLabel !== 'En règle');

  // Totaux financiers pour les frais exigibles jusqu'à ce jour
  const chargesDueNow = evaluatedCharges.filter(c => c.isDueUpToCurrentDate);
  const totalDueNow = chargesDueNow.reduce((sum, c) => sum + c.net, 0);
  const totalPaidNow = chargesDueNow.reduce((sum, c) => sum + c.paid, 0);
  const totalRemainingNow = chargesDueNow.reduce((sum, c) => sum + c.remaining, 0);

  // Situation Générale Globale de l'élève jusqu'à la date en cours
  // Règle :
  // - Si aucun litige (tous soldés) : "En règle"
  // - S'il y a des litiges : si au moins un est payé 0 -> "Non en règle", sinon si tous ont un acompte -> "Partielle"
  let globalStudentStatus: 'EN RÈGLE' | 'PARTIELLE' | 'NON EN RÈGLE';
  let globalStatusColor: string;
  let globalStatusBadge: string;
  let globalStatusDescription: string;

  const litigesDue = chargesDueNow.filter(c => c.remaining > 0);
  if (litigesDue.length === 0) {
    globalStudentStatus = 'EN RÈGLE';
    globalStatusColor = 'text-emerald-700 bg-emerald-50 border-emerald-300';
    globalStatusBadge = 'bg-emerald-600 text-white';
    globalStatusDescription = "L'élève est parfaitement en règle pour tous les frais scolaires exigibles jusqu'à ce jour.";
  } else {
    const hasCompletelyUnpaid = litigesDue.some(c => c.paid === 0);
    if (hasCompletelyUnpaid) {
      globalStudentStatus = 'NON EN RÈGLE';
      globalStatusColor = 'text-rose-700 bg-rose-50 border-rose-300';
      globalStatusBadge = 'bg-rose-600 text-white';
      globalStatusDescription = `L'élève présente ${litigesDue.length} obligation(s) en litige avec des frais non réglés jusqu'au mois de ${currentMonthName}.`;
    } else {
      globalStudentStatus = 'PARTIELLE';
      globalStatusColor = 'text-amber-800 bg-amber-50 border-amber-300';
      globalStatusBadge = 'bg-amber-600 text-white';
      globalStatusDescription = `L'élève a effectué des paiements partiels sur les frais exigibles. Des reliquats restent à solder.`;
    }
  }

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[96vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Controls Toolbar (hidden during print) */}
        <div className="no-print bg-slate-900 text-white px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">
                Fiche de Situation Financière & Scolaire
              </h3>
              <p className="text-[11px] text-slate-400">
                {student.lastName} {student.firstName} ({student.matricule}) · Situation arrêtée au {todayFormatted}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* View filter */}
            <div className="flex bg-slate-800 p-0.5 rounded-lg text-xs font-medium">
              <button
                type="button"
                onClick={() => setPeriodFilter('current_date')}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  periodFilter === 'current_date'
                    ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Jusqu'au mois en cours ({currentMonthName})
              </button>
              <button
                type="button"
                onClick={() => setPeriodFilter('full_year')}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  periodFilter === 'full_year'
                    ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Toute l'année scolaire
              </button>
            </div>

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Imprimer la Fiche
            </button>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="p-4 sm:p-8 overflow-y-auto flex-1 bg-slate-100 flex justify-center">
          <div
            ref={printRef}
            className="printable-area bg-white text-slate-900 border border-slate-200 shadow-sm p-6 sm:p-10 max-w-3xl w-full text-xs space-y-6"
          >
            {/* 1. Official School Header */}
            <div className="border-b-2 border-slate-900 pb-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {school.logoUrl ? (
                    <img
                      src={school.logoUrl}
                      alt={school.name}
                      className="w-16 h-16 object-contain rounded-lg border border-slate-200 p-1"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-2xl">
                      {school.name?.charAt(0) || 'E'}
                    </div>
                  )}
                  <div>
                    <h1 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight">
                      {school.name || 'Établissement Scolaire'}
                    </h1>
                    <p className="text-[11px] text-slate-600 font-medium">
                      {[school.address, school.city, school.province, school.country].filter(Boolean).join(' · ')}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Tél : {school.phone || 'Non renseigné'} · Email : {school.email || 'Non renseigné'}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="inline-block px-2.5 py-1 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded font-bold text-[11px] uppercase">
                    Année : {school.schoolYear || '2026-2027'}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    Édité le : <strong>{todayFormatted}</strong>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    Réf : FICHE-{student.matricule}-{Date.now().toString().slice(-5)}
                  </div>
                </div>
              </div>

              {/* Document Banner */}
              <div className="mt-4 pt-3 border-t border-slate-200 text-center">
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900 uppercase tracking-wide">
                  FICHE DE SITUATION FINANCIÈRE & ADMINISTRATIVE DE L'ÉLÈVE
                </h2>
                <p className="text-[11px] font-semibold text-indigo-700 mt-0.5">
                  Situation arrêtée au {todayFormatted} — Mois de référence : <strong>{currentMonthName}</strong>
                </p>
              </div>
            </div>

            {/* 2. Student Identity & Administrative Card */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                  Identité de l'Élève
                </span>
                <div className="text-sm font-bold text-slate-900 mt-0.5">
                  {student.lastName} {student.firstName}
                </div>
                <div className="text-[11px] text-slate-600 font-mono">
                  Matricule : <strong className="text-indigo-700">{student.matricule}</strong>
                </div>
                <div className="text-[11px] text-slate-500">
                  Sexe : {student.gender === 'F' ? 'Féminin' : 'Masculin'}
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                  Cursus Pédagogique
                </span>
                <div className="text-xs font-semibold text-slate-800 mt-0.5">
                  Classe : <strong>{student.className}</strong>
                </div>
                <div className="text-[11px] text-slate-600">
                  Section : <strong className="text-slate-800">{student.section || 'Non renseignée'}</strong>
                </div>
                {student.optionName && student.optionName !== 'Générale' && (
                  <div className="text-[11px] text-slate-600">
                    Option : <strong>{student.optionName}</strong>
                  </div>
                )}
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                  Parent / Responsable
                </span>
                <div className="text-xs font-semibold text-slate-800 mt-0.5">
                  {student.parentName || 'Non précisé'}
                </div>
                <div className="text-[11px] text-slate-600 font-mono">
                  Tél : {student.parentPhone || 'Non précisé'}
                </div>
                {student.parentEmail && (
                  <div className="text-[11px] text-slate-500 truncate">
                    {student.parentEmail}
                  </div>
                )}
              </div>
            </div>

            {/* Special Administrative Status Banner if set by General Admin */}
            {student.financialSituation && (
              <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-lg flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div className="text-[11px]">
                  <span className="font-bold text-indigo-900">
                    Statut Particulier Accordé par la Direction :{' '}
                  </span>
                  <span className="font-semibold text-indigo-800">
                    {student.financialSituation.situation === 'exempted' && 'Exonération Administrative'}
                    {student.financialSituation.situation === 'scholarship' && `Bourse d'Étude (${student.financialSituation.discountPercentage || 0}%)`}
                    {student.financialSituation.situation === 'in_order' && 'Régularisation Exceptionnelle en Règle'}
                    {student.financialSituation.situation === 'social_case' && 'Prise en Charge Sociale'}
                    {student.financialSituation.situation === 'standard' && 'Régime Standard'}
                  </span>
                  {student.financialSituation.scope === 'month' && (
                    <span className="ml-1 text-slate-600">
                      (Mois : {student.financialSituation.month})
                    </span>
                  )}
                  {student.financialSituation.motif && (
                    <p className="text-slate-600 mt-0.5 italic">
                      Motif officiel : « {student.financialSituation.motif} »
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* 3. Global Financial Situation Status Banner */}
            <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${globalStatusColor}`}>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    Situation Générale au {todayFormatted} :
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider ${globalStatusBadge}`}>
                    {globalStudentStatus}
                  </span>
                </div>
                <p className="text-xs font-medium text-slate-700">
                  {globalStatusDescription}
                </p>
              </div>

              <div className="flex items-center gap-4 text-right shrink-0 border-t sm:border-t-0 sm:border-l border-slate-300 pt-2 sm:pt-0 sm:pl-4">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">Exigible à ce jour</div>
                  <div className="text-xs font-bold font-mono text-slate-900">
                    {formatCurrency(totalDueNow, school.currency)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">Déjà Payé</div>
                  <div className="text-xs font-bold font-mono text-emerald-700">
                    {formatCurrency(totalPaidNow, school.currency)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">Litiges / Reste Dû</div>
                  <div className={`text-xs font-bold font-mono ${totalRemainingNow > 0 ? 'text-rose-700 font-extrabold' : 'text-slate-700'}`}>
                    {formatCurrency(totalRemainingNow, school.currency)}
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Table: Frais Non Entièrement Payés (Litiges / Dettes à solder jusqu'à ce jour) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  1. Frais Restants à Payer ou en Litige (Arrêtés à la date et au mois en cours)
                </h3>
                <span className="text-[11px] font-semibold text-slate-500">
                  {unpaidOrPartialCharges.length} ligne(s)
                </span>
              </div>

              {unpaidOrPartialCharges.length === 0 ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-medium flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>Aucun litige financier à ce jour. Tous les frais exigibles jusqu'au mois de {currentMonthName} sont intégralement payés !</span>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200">
                        <th className="py-2 px-3">Frais / Libellé</th>
                        <th className="py-2 px-2">Mois / Échéance</th>
                        <th className="py-2 px-2 text-right">Montant Dû</th>
                        <th className="py-2 px-2 text-right">Déjà Versé</th>
                        <th className="py-2 px-2 text-right">Reste à Payer</th>
                        <th className="py-2 px-3 text-center">Situation de l'Élève</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {unpaidOrPartialCharges.map(charge => (
                        <tr key={`unpaid_${charge.id}`} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3">
                            <div className="font-semibold text-slate-900">{charge.label}</div>
                            {charge.category && (
                              <span className="text-[10px] text-slate-400">{charge.category}</span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-slate-600">
                            {charge.chargeMonth || charge.dueDate || 'Annuel'}
                          </td>
                          <td className="py-2 px-2 text-right font-mono font-semibold text-slate-800">
                            {formatCurrency(charge.net, school.currency)}
                          </td>
                          <td className="py-2 px-2 text-right font-mono text-emerald-700">
                            {formatCurrency(charge.paid, school.currency)}
                          </td>
                          <td className="py-2 px-2 text-right font-mono font-bold text-rose-600">
                            {formatCurrency(charge.remaining, school.currency)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${charge.statusBg} ${charge.statusColor}`}>
                              {charge.statusLabel}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 font-bold border-t border-slate-200 text-slate-900">
                        <td colSpan={4} className="py-2 px-3 text-right uppercase text-[10px]">
                          Total des Litiges & Dettes à solder à ce jour :
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-rose-700 text-xs">
                          {formatCurrency(
                            unpaidOrPartialCharges.reduce((s, c) => s + c.remaining, 0),
                            school.currency
                          )}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* 5. Table: Frais Soldés et Entièrement Payés */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  2. Frais Entièrement Soldés & En Règle
                </h3>
                <span className="text-[11px] font-semibold text-slate-500">
                  {paidCharges.length} ligne(s)
                </span>
              </div>

              {paidCharges.length === 0 ? (
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 text-[11px] italic">
                  Aucun frais complètement soldé répertorié pour cette période.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200">
                        <th className="py-2 px-3">Frais / Libellé</th>
                        <th className="py-2 px-2">Mois / Échéance</th>
                        <th className="py-2 px-2 text-right">Montant Facturé</th>
                        <th className="py-2 px-2 text-right">Montant Réglé</th>
                        <th className="py-2 px-2 text-right">Reste</th>
                        <th className="py-2 px-3 text-center">Situation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {paidCharges.map(charge => (
                        <tr key={`paid_${charge.id}`} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3">
                            <div className="font-semibold text-slate-800">{charge.label}</div>
                            {charge.discountAmount && charge.discountAmount > 0 ? (
                              <span className="text-[10px] text-indigo-600">
                                Remise/Bourse : -{formatCurrency(charge.discountAmount, school.currency)}
                              </span>
                            ) : null}
                          </td>
                          <td className="py-2 px-2 text-slate-600">
                            {charge.chargeMonth || charge.dueDate || 'Annuel'}
                          </td>
                          <td className="py-2 px-2 text-right font-mono text-slate-700">
                            {formatCurrency(charge.net, school.currency)}
                          </td>
                          <td className="py-2 px-2 text-right font-mono font-semibold text-emerald-700">
                            {formatCurrency(charge.paid, school.currency)}
                          </td>
                          <td className="py-2 px-2 text-right font-mono text-slate-400">
                            0 {school.currency}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300">
                              En règle
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 font-bold border-t border-slate-200 text-slate-900">
                        <td colSpan={3} className="py-2 px-3 text-right uppercase text-[10px]">
                          Total des Frais Soldés :
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-emerald-700 text-xs">
                          {formatCurrency(
                            paidCharges.reduce((s, c) => s + c.paid, 0),
                            school.currency
                          )}
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* 6. Historique des versements enregistrés */}
            {studentPayments.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-600" />
                  3. Historique des Versements et Règlements Effectués
                </h3>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200">
                        <th className="py-1.5 px-3">Date & Heure</th>
                        <th className="py-1.5 px-2">Réf. Reçu</th>
                        <th className="py-1.5 px-2">Mode</th>
                        <th className="py-1.5 px-2">Caissier / Agent</th>
                        <th className="py-1.5 px-3 text-right">Montant Encaissé</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {studentPayments.map(p => (
                        <tr key={p.id} className="hover:bg-slate-50/50">
                          <td className="py-1.5 px-3 text-slate-600">
                            {formatDateTime(p.createdAt)}
                          </td>
                          <td className="py-1.5 px-2 font-mono font-semibold text-indigo-700">
                            {p.receiptNumber || 'REC-N/A'}
                          </td>
                          <td className="py-1.5 px-2 text-slate-600">
                            {p.paymentMethod === 'cash' && 'Espèces (Caisse)'}
                            {p.paymentMethod === 'bank_transfer' && 'Virement / Bordereau Banque'}
                            {p.paymentMethod === 'mobile_money' && 'Mobile Money'}
                            {p.paymentMethod === 'card' && 'Carte Bancaire'}
                            {p.paymentMethod === 'check' && 'Chèque Bancaire'}
                            {p.paymentMethod === 'advance' && "Déduction sur Avance de l'Élève"}
                            {p.paymentMethod === 'other' && 'Autre Mode'}
                          </td>
                          <td className="py-1.5 px-2 text-slate-500">
                            {p.createdByName || 'Caisse Centrale'}
                          </td>
                          <td className="py-1.5 px-3 text-right font-mono font-bold text-emerald-700">
                            {formatCurrency(p.amount, school.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 7. Signatures & Official Certification Block */}
            <div className="pt-6 border-t-2 border-slate-300 space-y-4">
              <p className="text-[10px] text-slate-500 italic text-center">
                « La présente fiche certifie avec exactitude l'état des obligations scolaires et des règlements de l'élève à la date indiquée ci-dessus. Tout versement ultérieur donne lieu à la délivrance immédiate d'un reçu d'encaissement numéroté. »
              </p>

              <div className="grid grid-cols-3 gap-6 pt-4 text-center">
                <div className="space-y-12">
                  <div className="text-[11px] font-bold text-slate-700 uppercase">
                    Le Parent / Tuteur Légal
                  </div>
                  <div className="border-t border-dashed border-slate-400 pt-1 text-[10px] text-slate-400">
                    (Nom et Signature avec mention "Lu et approuvé")
                  </div>
                </div>

                <div className="space-y-12">
                  <div className="text-[11px] font-bold text-slate-700 uppercase">
                    Le Comptable / Caissier
                  </div>
                  <div className="border-t border-dashed border-slate-400 pt-1 text-[10px] text-slate-400">
                    (Signature & Cachet Caisse)
                  </div>
                </div>

                <div className="space-y-12">
                  <div className="text-[11px] font-bold text-slate-700 uppercase">
                    Le Chef d'Établissement
                  </div>
                  <div className="border-t border-dashed border-slate-400 pt-1 text-[10px] text-slate-400">
                    (Sceau officiel de l'école & Signature)
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
