import React, { useState, useEffect } from 'react';
import {
  X,
  CreditCard,
  Sparkles,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Lock,
  CheckCircle2,
  Calendar,
  Wallet,
  Coins,
  DollarSign,
  ArrowRightLeft,
  Plus,
  Trash2,
} from 'lucide-react';
import { Student, StudentCharge, PaymentMethod, Receipt, Payment, School, ClassItem, FeeType } from '../../types';
import { formatCurrency, getPaymentMethodLabel } from '../../utils/formatters';
import { SchoolService } from '../../services/schoolService';
import { useAuth } from '../../context/AuthContext';
import {
  isRegistrationFee,
  extractMonthFromCharge,
  getAcademicMonthIndex,
  checkChargePaymentEligibility,
  ACADEMIC_YEAR_MONTHS,
  MONTHS_OF_YEAR,
} from '../../utils/academic';

interface PaymentModalProps {
  student: Student;
  charges: StudentCharge[];
  currency: string;
  school?: School | null;
  classes?: ClassItem[];
  feeTypes?: FeeType[];
  onSuccess: (payment: Payment, receipt: Receipt) => void;
  onClose: () => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  student,
  charges,
  currency,
  school,
  classes = [],
  feeTypes = [],
  onSuccess,
  onClose,
}) => {
  const { schoolId, currentUser, profile, role } = useAuth();
  const [amount, setAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [note, setNote] = useState<string>('');
  const [targetMonth, setTargetMonth] = useState<string>('');
  const [allocations, setAllocations] = useState<{ [chargeId: string]: number }>({});
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Taux de change officiel configuré dans les paramètres (défaut : 2850 CDF)
  const exchangeRateUSD = Number(school?.exchangeRateUSD) || 2850;
  const [perceptionCurrency, setPerceptionCurrency] = useState<'CDF' | 'USD'>('CDF');
  const [usdInput, setUsdInput] = useState<number>(0);

  // Avance disponible sur le compte de l'élève
  const availableAdvance = student.creditAdvance || 0;
  const [useAdvanceDeduction, setUseAdvanceDeduction] = useState<boolean>(false);
  const [advanceDeductionAmount, setAdvanceDeductionAmount] = useState<number>(0);

  // Libellés additionnels pour affectation (mois futurs, examens, frais spécifiques)
  const [extraAllocations, setExtraAllocations] = useState<
    { id: string; label: string; amountDue: number; month?: string }[]
  >([]);
  const [selectedExtraToAdd, setSelectedExtraToAdd] = useState<string>('');

  // Filter charges that have a balance due
  const unpaidChargesRaw = charges.filter(c => c.status !== 'paid' && c.status !== 'cancelled');

  // Sort charges strictly by business priority:
  // 1. Frais d'inscription d'abord
  // 2. Frais mensuels ordonnés par mois académique (Septembre -> Juillet)
  // 3. Autres frais
  const sortedUnpaidCharges = [...unpaidChargesRaw].sort((a, b) => {
    const isRegA = isRegistrationFee(a);
    const isRegB = isRegistrationFee(b);
    if (isRegA && !isRegB) return -1;
    if (!isRegA && isRegB) return 1;

    const monthA = extractMonthFromCharge(a);
    const monthB = extractMonthFromCharge(b);
    const idxA = getAcademicMonthIndex(monthA);
    const idxB = getAcademicMonthIndex(monthB);

    if (idxA >= 0 && idxB >= 0) return idxA - idxB;
    if (idxA >= 0 && idxB < 0) return -1;
    if (idxA < 0 && idxB >= 0) return 1;

    return a.dueDate.localeCompare(b.dueDate);
  });

  // Check if student has pending registration fees
  const pendingRegistrationFee = sortedUnpaidCharges.find(c => isRegistrationFee(c));

  // Date du jour et mois en cours
  const today = new Date();
  const currentMonthName = MONTHS_OF_YEAR[today.getMonth()];
  const currentAcademicIdx = getAcademicMonthIndex(currentMonthName);

  // Déterminer les frais exigibles jusqu'au mois et à la date en cours
  const unpaidChargesDueNow = sortedUnpaidCharges.filter(charge => {
    const chargeMonth = extractMonthFromCharge(charge);
    const chargeMonthIdx = getAcademicMonthIndex(chargeMonth);
    if (chargeMonthIdx >= 0 && currentAcademicIdx >= 0) {
      return chargeMonthIdx <= currentAcademicIdx;
    }
    if (charge.dueDate) {
      const todayISO = today.toISOString().split('T')[0];
      return charge.dueDate <= todayISO;
    }
    return true; // Frais d'inscription ou annuel
  });

  // Règle 1 : Si un élève est en ordre avec tous les frais jusqu'au mois en cours
  const isStudentInOrderUpToCurrentMonth = unpaidChargesDueNow.length === 0;

  // Total restant dû sur les frais exigibles
  const totalDueRemaining = sortedUnpaidCharges.reduce(
    (sum, c) => sum + Math.max(0, c.netAmount - c.paidAmount),
    0
  );

  // Classe de l'élève pour le calcul du tarif officiel selon la promotion
  const studentClass = classes.find(c => c.id === student.classId);

  // Fonction pour déterminer le montant officiel conforme au libellé principal en fonction de la classe et promotion de l'élève
  const getTariffForPrincipalLabel = React.useCallback(
    (target: string): { amount: number; charge?: StudentCharge; label: string; isAdvance: boolean } => {
      if (!target || target === 'Avance sur frais scolaires') {
        return { amount: 0, label: 'Avance sur frais scolaires', isAdvance: true };
      }

      // 1. Chercher d'abord dans les charges impayées de l'élève
      const matchingUnpaid = sortedUnpaidCharges.find(c => {
        const cMonth = extractMonthFromCharge(c);
        if (cMonth && cMonth.toLowerCase() === target.toLowerCase()) return true;
        if (c.applicableMonth && c.applicableMonth.toLowerCase() === target.toLowerCase()) return true;
        if (isRegistrationFee(c) && (target.toLowerCase().includes('inscription') || target === "Frais d'Inscription")) return true;
        if (c.label.toLowerCase() === target.toLowerCase()) return true;
        if (c.label.toLowerCase().includes(target.toLowerCase())) return true;
        return false;
      });

      if (matchingUnpaid) {
        const remaining = Math.max(0, matchingUnpaid.netAmount - matchingUnpaid.paidAmount);
        const amt = remaining > 0 ? remaining : matchingUnpaid.netAmount;
        return { amount: amt, charge: matchingUnpaid, label: matchingUnpaid.label, isAdvance: false };
      }

      // 2. Chercher dans l'ensemble des charges générées pour l'élève (y compris soldées pour référence tarifaire)
      const matchingAll = charges.find(c => {
        const cMonth = extractMonthFromCharge(c);
        if (cMonth && cMonth.toLowerCase() === target.toLowerCase()) return true;
        if (c.applicableMonth && c.applicableMonth.toLowerCase() === target.toLowerCase()) return true;
        if (isRegistrationFee(c) && (target.toLowerCase().includes('inscription') || target === "Frais d'Inscription")) return true;
        if (c.label.toLowerCase() === target.toLowerCase()) return true;
        if (c.label.toLowerCase().includes(target.toLowerCase())) return true;
        return false;
      });

      if (matchingAll) {
        return { amount: matchingAll.netAmount, charge: matchingAll, label: matchingAll.label, isAdvance: false };
      }

      // 3. Chercher dans les FeeTypes configurés de l'école (spécifiques à la classe ou globaux)
      if (feeTypes && feeTypes.length > 0) {
        const matchingFee = feeTypes.find(f => {
          if (f.classId && f.classId !== student.classId) return false;
          if (f.name.toLowerCase() === target.toLowerCase()) return true;
          if (f.name.toLowerCase().includes(target.toLowerCase()) || target.toLowerCase().includes(f.name.toLowerCase())) return true;
          return false;
        });
        if (matchingFee && matchingFee.amount > 0) {
          return { amount: matchingFee.amount, label: matchingFee.name, isAdvance: false };
        }
      }

      // 4. Si c'est un mois académique, utiliser le tarif mensuel officiel (Minerval) de la classe & promotion de l'élève
      const isMonth = ACADEMIC_YEAR_MONTHS.some(m => m.toLowerCase() === target.toLowerCase());
      if (isMonth && studentClass?.monthlyFee && studentClass.monthlyFee > 0) {
        return { amount: studentClass.monthlyFee, label: `Minerval - ${target}`, isAdvance: false };
      }

      return { amount: 0, label: target, isAdvance: false };
    },
    [sortedUnpaidCharges, charges, studentClass, feeTypes, student.classId]
  );

  // Changement du libellé principal
  const handleTargetMonthChange = (newTarget: string) => {
    setTargetMonth(newTarget);
  };

  // Ajout manuel d'une affectation sur un autre libellé (mois futur ou frais spécifique)
  const handleAddExtraAllocation = (labelToAdd: string) => {
    if (!labelToAdd) return;
    const tariff = getTariffForPrincipalLabel(labelToAdd);
    const amt = tariff.amount > 0 ? tariff.amount : (studentClass?.monthlyFee || 0);
    const extraId = `extra_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newExtra = {
      id: extraId,
      label: tariff.label || labelToAdd,
      amountDue: amt,
    };
    setExtraAllocations(prev => [...prev, newExtra]);

    // Allouer automatiquement le montant disponible restant si possible
    const currentTotalAlloc = Object.values(allocations).reduce((sum, v) => sum + (Number(v) || 0), 0);
    const remainingAvail = Math.max(0, effectiveTotalAvailable - currentTotalAlloc);
    const allocAmt = Math.min(amt, remainingAvail);
    if (allocAmt > 0) {
      setAllocations(prev => ({ ...prev, [extraId]: allocAmt }));
    }
  };

  // Suppression d'une affectation supplémentaire
  const handleRemoveExtraAllocation = (id: string) => {
    setExtraAllocations(prev => prev.filter(e => e.id !== id));
    setAllocations(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  // Determine default target month on load
  useEffect(() => {
    let initialTarget = '';

    if (pendingRegistrationFee) {
      initialTarget = "Frais d'Inscription";
    } else if (sortedUnpaidCharges.length > 0) {
      const firstMonthly = sortedUnpaidCharges.find(c => extractMonthFromCharge(c) !== null);
      if (firstMonthly) {
        initialTarget = extractMonthFromCharge(firstMonthly) || '';
      } else {
        initialTarget = sortedUnpaidCharges[0].label;
      }
    } else {
      initialTarget = 'Avance sur frais scolaires';
    }

    setTargetMonth(initialTarget);
  }, [charges]);

  // Compute eligibility map for each charge
  const eligibilityMap = React.useMemo(() => {
    const map: { [chargeId: string]: { eligible: boolean; lockReason?: string } } = {};
    for (const c of sortedUnpaidCharges) {
      map[c.id] = checkChargePaymentEligibility(c.id, charges);
    }
    return map;
  }, [sortedUnpaidCharges, charges]);

  // Auto-distribute payment across eligible charges in strict prerequisite order
  const handleAutoDistribute = (totalToDistribute: number) => {
    let remaining = totalToDistribute;
    const newAllocations: { [chargeId: string]: number } = {};

    // Clone simulated state to handle progressive unlocking in auto-distribute
    const simulatedPaid: { [id: string]: number } = {};
    sortedUnpaidCharges.forEach(c => {
      simulatedPaid[c.id] = c.paidAmount;
    });

    for (const c of sortedUnpaidCharges) {
      // Check eligibility using current simulated paid amounts
      const simulatedChargesList = charges.map(ch => ({
        ...ch,
        paidAmount: simulatedPaid[ch.id] !== undefined ? simulatedPaid[ch.id] : ch.paidAmount,
      }));

      const check = checkChargePaymentEligibility(c.id, simulatedChargesList);
      if (!check.eligible) {
        newAllocations[c.id] = 0;
        continue;
      }

      const dueOnFee = Math.max(0, c.netAmount - simulatedPaid[c.id]);
      if (remaining <= 0) {
        newAllocations[c.id] = 0;
      } else if (remaining >= dueOnFee) {
        newAllocations[c.id] = dueOnFee;
        simulatedPaid[c.id] += dueOnFee;
        remaining -= dueOnFee;
      } else {
        newAllocations[c.id] = remaining;
        simulatedPaid[c.id] += remaining;
        remaining = 0;
      }
    }

    setAllocations(newAllocations);
  };

  const effectiveTotalAvailable = amount + (useAdvanceDeduction ? advanceDeductionAmount : 0);

  const handleAmountChange = (val: number) => {
    setAmount(val);
    const totalAvail = val + (useAdvanceDeduction ? advanceDeductionAmount : 0);
    // Si l'élève est en ordre jusqu'au mois en cours et qu'aucune allocation n'a encore été choisie,
    // on laisse l'utilisateur choisir soit d'affecter aux mois suivants, soit de conserver en avance
    if (!isStudentInOrderUpToCurrentMonth || Object.keys(allocations).length > 0) {
      handleAutoDistribute(totalAvail);
    }
  };

  const handleManualAllocationChange = (chargeId: string, allocVal: number) => {
    const check = eligibilityMap[chargeId];
    if (check && !check.eligible) {
      setErrorMessage(check.lockReason || 'Ce frais est actuellement verrouillé par les règles académiques.');
      return;
    }
    setErrorMessage(null);
    setAllocations(prev => ({
      ...prev,
      [chargeId]: allocVal,
    }));
  };

  // Raccourci pour allouer le maximum possible à un frais spécifique selon son libellé
  const handleAllocateMaxToCharge = (chargeId: string) => {
    const chg = sortedUnpaidCharges.find(c => c.id === chargeId);
    const extra = extraAllocations.find(e => e.id === chargeId);
    const remainingOnCharge = chg
      ? Math.max(0, chg.netAmount - chg.paidAmount)
      : extra
      ? extra.amountDue
      : 0;
    if (remainingOnCharge <= 0) return;
    const currentAlloc = allocations[chargeId] || 0;
    const currentTotalAlloc = Object.values(allocations).reduce((sum, v) => sum + (Number(v) || 0), 0);
    const availableForThis = Math.max(0, effectiveTotalAvailable - (currentTotalAlloc - currentAlloc));
    const targetAlloc = Math.min(remainingOnCharge, availableForThis);
    handleManualAllocationChange(chargeId, targetAlloc);
  };

  const totalAllocated = Object.values(allocations).reduce((sum, v) => sum + (Number(v) || 0), 0);
  const advanceAmount = Math.max(0, effectiveTotalAvailable - totalAllocated);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const deduction = useAdvanceDeduction ? advanceDeductionAmount : 0;
    if (amount <= 0 && deduction <= 0) {
      setErrorMessage("Veuillez entrer un montant perçu ou définir un montant prélevé sur l'avance de l'élève.");
      return;
    }

    if (totalAllocated > effectiveTotalAvailable) {
      setErrorMessage('La somme des affectations dépasse le montant total disponible (versement + avance).');
      return;
    }

    // Verify all allocations respect eligibility & constraints
    for (const [chargeId, alloc] of Object.entries(allocations)) {
      if (alloc <= 0) continue;
      const chg = sortedUnpaidCharges.find(c => c.id === chargeId);
      if (chg) {
        const check = eligibilityMap[chg.id];
        if (check && !check.eligible) {
          setErrorMessage(check.lockReason || `Impossible de payer "${chg.label}".`);
          return;
        }

        const remainingOnCharge = Math.max(0, chg.netAmount - chg.paidAmount);
        if (alloc > remainingOnCharge) {
          setErrorMessage(`L'affectation pour "${chg.label}" (${alloc}) dépasse le reste dû (${remainingOnCharge}).`);
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      const activeAllocations = Object.entries(allocations)
        .filter(([, val]) => val > 0)
        .map(([chargeId, val]) => {
          const chg = sortedUnpaidCharges.find(c => c.id === chargeId);
          const extra = extraAllocations.find(e => e.id === chargeId);
          return {
            chargeId,
            amount: val,
            label: chg?.label || extra?.label || targetMonth || 'Frais scolaire',
          };
        });

      // Si aucune affectation explicite dans la grille mais un libellé principal spécifique (autre qu'avance générale)
      if (activeAllocations.length === 0 && targetMonth && targetMonth !== 'Avance sur frais scolaires') {
        const tariff = getTariffForPrincipalLabel(targetMonth);
        activeAllocations.push({
          chargeId: tariff.charge?.id || `extra_${student.id}_${Date.now()}`,
          amount: effectiveTotalAvailable,
          label: tariff.label || targetMonth,
        });
      }

      // Si le versement direct est à 0 et que tout provient de l'avance
      const finalPaymentMethod: PaymentMethod =
        amount === 0 && deduction > 0 ? 'advance' : paymentMethod;

      // Construction de la note avec traçabilité USD et Déduction Avance
      const noteParts: string[] = [];
      if (note.trim()) noteParts.push(note.trim());
      if (perceptionCurrency === 'USD' && usdInput > 0) {
        noteParts.push(`Perception : $${usdInput} USD (Taux officiel : ${exchangeRateUSD.toLocaleString('fr-FR')} CDF/USD)`);
      }
      if (deduction > 0) {
        noteParts.push(`Déduction de ${formatCurrency(deduction, currency)} sur l'avance préalable de l'élève`);
      }
      const finalNote = noteParts.join(' · ');

      const finalTargetMonth = isStudentInOrderUpToCurrentMonth && activeAllocations.length === 0
        ? 'Avance sur frais scolaires'
        : targetMonth;

      const { payment, receipt } = await SchoolService.recordPayment(
        schoolId,
        student,
        amount,
        finalPaymentMethod,
        activeAllocations,
        finalNote,
        currency,
        currentUser?.uid || 'user_cashier',
        currentUser?.email || profile?.email || 'caissier@ecole.cd',
        profile?.displayName || 'Caissier Principal',
        finalTargetMonth,
        deduction
      );

      onSuccess(payment, receipt);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Une erreur est survenue lors du paiement.';
      setErrorMessage(msg);
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-4 sm:px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <CreditCard className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-semibold">Enregistrer un Paiement d'Élève</h3>
              <p className="text-xs text-slate-400">
                {student.lastName} {student.firstName} · Matricule : {student.matricule} · {student.className}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1">
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-3 text-xs text-rose-800 font-medium">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Registration fee priority alert */}
          {pendingRegistrationFee && (
            <div className="p-3.5 bg-amber-50 border border-amber-300/80 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Règle de Priorité : Frais d'Inscription Obligatoires</strong>
                <span>
                  Cet élève doit obligatoirement solder ses <strong>frais d'inscription</strong> (
                  {formatCurrency(Math.max(0, pendingRegistrationFee.netAmount - pendingRegistrationFee.paidAmount), currency)} restants)
                  avant de pouvoir régler les mois suivants (Minerval, frais mensuels).
                </span>
              </div>
            </div>
          )}

          {/* Alerte / Règle 1 : Si un élève est en ordre avec tous les frais jusqu'au mois en cours */}
          {isStudentInOrderUpToCurrentMonth && (
            <div className="p-4 bg-gradient-to-r from-indigo-50 via-slate-50 to-emerald-50 border border-indigo-200 rounded-xl space-y-2.5 text-xs text-indigo-950">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <strong className="font-bold text-indigo-950 text-xs sm:text-sm">
                      Élève en règle avec tous les frais échus à ce jour ({currentMonthName})
                    </strong>
                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 border border-indigo-300 rounded font-semibold text-[10px]">
                      Encaissement & Affectation Disponibles
                    </span>
                  </div>
                  <p className="text-slate-600 text-[11px] mt-0.5">
                    Cet élève n'a aucun litige pour la période en cours. Vous pouvez encaisser tout nouveau paiement et affecter une partie ou la totalité de la somme aux frais scolaires à venir (selon leur libellé : mois suivants, examens, etc.), ou la conserver en avance sur solde.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1.5 border-t border-indigo-100">
                <span className="text-[11px] font-semibold text-slate-700">Actions rapides d'affectation :</span>
                <button
                  type="button"
                  onClick={() => handleAutoDistribute(effectiveTotalAvailable)}
                  className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold px-3 py-1.5 rounded-lg shadow-2xs transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  Affecter aux frais à venir selon libellé
                </button>
                <button
                  type="button"
                  onClick={() => setAllocations({})}
                  className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-[11px] font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  <Wallet className="w-3 h-3 text-emerald-600" />
                  Conserver 100% en avance libre
                </button>
              </div>
            </div>
          )}

          {/* Règle 4 : Le caissier a le droit d'encaisser un paiement en déduisant sur l'avance d'un élève si possible */}
          {availableAdvance > 0 && (
            <div className="p-4 bg-emerald-50/90 border border-emerald-300 rounded-xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-emerald-700 shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-emerald-950">
                      Avance disponible sur le compte de l'élève :
                    </span>
                    <span className="ml-2 px-2 py-0.5 bg-emerald-200/70 border border-emerald-300 rounded-md font-mono text-xs font-extrabold text-emerald-900">
                      {formatCurrency(availableAdvance, currency)}
                    </span>
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs font-bold text-emerald-900 cursor-pointer select-none bg-white sm:bg-transparent p-2 sm:p-0 rounded-lg border sm:border-0 border-emerald-200">
                  <input
                    type="checkbox"
                    checked={useAdvanceDeduction}
                    onChange={e => {
                      const checked = e.target.checked;
                      setUseAdvanceDeduction(checked);
                      if (checked) {
                        const suggested = Math.min(
                          availableAdvance,
                          totalDueRemaining > 0 ? totalDueRemaining : availableAdvance
                        );
                        setAdvanceDeductionAmount(suggested);
                        handleAutoDistribute(amount + suggested);
                        if (amount === 0) setPaymentMethod('advance');
                      } else {
                        setAdvanceDeductionAmount(0);
                        handleAutoDistribute(amount);
                        if (paymentMethod === 'advance') setPaymentMethod('cash');
                      }
                    }}
                    className="w-4 h-4 text-emerald-600 rounded border-emerald-400 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span>Déduire sur l'avance de l'élève</span>
                </label>
              </div>

              {useAdvanceDeduction && (
                <div className="pt-2.5 border-t border-emerald-200/80 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-[11px] font-semibold text-emerald-900 uppercase mb-1">
                      Montant prélevé sur l'avance ({currency}) :
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max={availableAdvance}
                        step="any"
                        value={advanceDeductionAmount || ''}
                        onChange={e => {
                          const val = Math.min(availableAdvance, Math.max(0, parseFloat(e.target.value) || 0));
                          setAdvanceDeductionAmount(val);
                          handleAutoDistribute(amount + val);
                          if (amount === 0 && val > 0) setPaymentMethod('advance');
                        }}
                        className="w-40 px-3 py-1.5 bg-white border border-emerald-300 rounded-lg text-xs font-bold font-mono text-emerald-950 outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const full = availableAdvance;
                          setAdvanceDeductionAmount(full);
                          handleAutoDistribute(amount + full);
                          if (amount === 0) setPaymentMethod('advance');
                        }}
                        className="text-[11px] font-semibold text-emerald-800 bg-white hover:bg-emerald-100 px-2.5 py-1.5 rounded-lg border border-emerald-300 cursor-pointer transition-colors"
                      >
                        Utiliser tout ({formatCurrency(availableAdvance, currency)})
                      </button>
                    </div>
                  </div>

                  <div className="text-[11px] text-emerald-800 bg-white/80 p-2 rounded-lg border border-emerald-200">
                    Nouveau solde d'avance restant :{' '}
                    <strong className="font-mono text-emerald-900">
                      {formatCurrency(Math.max(0, availableAdvance - advanceDeductionAmount), currency)}
                    </strong>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Module de Perception Multi-Devises (USD ⇄ CDF) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-2">
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Perception Multi-Devises (Dollars USD ⇄ Francs CDF)
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[11px] text-slate-500 font-medium">Taux officiel configuré :</span>
                <span className="font-mono font-bold text-emerald-800 bg-emerald-100/80 border border-emerald-300 px-2 py-0.5 rounded-md">
                  1 USD = {exchangeRateUSD.toLocaleString('fr-FR')} CDF
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPerceptionCurrency('CDF')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  perceptionCurrency === 'CDF'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                <span>Perception en Francs (CDF)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPerceptionCurrency('USD');
                  if (amount > 0 && usdInput === 0) {
                    setUsdInput(parseFloat((amount / exchangeRateUSD).toFixed(2)));
                  }
                }}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  perceptionCurrency === 'USD'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>Perception en Dollars (USD $)</span>
              </button>
            </div>

            {/* Détail si perception en USD avec conversion directe en CDF */}
            {perceptionCurrency === 'USD' && (
              <div className="p-3 bg-emerald-50/90 border border-emerald-300 rounded-xl space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1">
                    <label className="block text-[11px] font-bold text-emerald-950 uppercase mb-1">
                      Billet(s) Reçu(s) en Dollars (USD $) :
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">$</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={usdInput || ''}
                        onChange={e => {
                          const val = Math.max(0, parseFloat(e.target.value) || 0);
                          setUsdInput(val);
                          const conv = Math.round(val * exchangeRateUSD);
                          handleAmountChange(conv);
                        }}
                        placeholder="Ex: 50"
                        className="w-full pl-7 pr-3 py-2 bg-white border border-emerald-300 rounded-lg text-sm font-extrabold font-mono text-emerald-950 outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                  </div>

                  <div className="sm:text-right bg-white p-2.5 rounded-lg border border-emerald-200 shadow-2xs">
                    <span className="text-[10px] text-slate-500 font-semibold uppercase block">
                      Équivalent Encaissé en Caisse ({currency}) :
                    </span>
                    <span className="text-base font-extrabold font-mono text-indigo-900">
                      {formatCurrency(Math.round(usdInput * exchangeRateUSD), currency)}
                    </span>
                    <span className="block text-[10px] text-emerald-700 font-medium">
                      ({usdInput} $ × {exchangeRateUSD.toLocaleString('fr-FR')} CDF)
                    </span>
                  </div>
                </div>

                {/* Coupures rapides en dollars */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-emerald-200/60">
                  <span className="text-[10px] font-semibold text-emerald-900 uppercase">Coupures USD usuelles :</span>
                  {[10, 20, 50, 100].map(bill => (
                    <button
                      key={bill}
                      type="button"
                      onClick={() => {
                        setUsdInput(bill);
                        const conv = Math.round(bill * exchangeRateUSD);
                        handleAmountChange(conv);
                      }}
                      className="px-2 py-0.5 bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded text-xs font-bold font-mono transition-colors cursor-pointer"
                    >
                      ${bill}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Payment Amount, Month Concerned & Method */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Montant Encaissé ({currency}) {useAdvanceDeduction ? '(Facultatif si 100% avance)' : '*'}
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={amount || ''}
                onChange={e => {
                  const val = Math.max(0, parseFloat(e.target.value) || 0);
                  handleAmountChange(val);
                  if (perceptionCurrency === 'USD') {
                    setUsdInput(parseFloat((val / exchangeRateUSD).toFixed(2)));
                  }
                  if (val === 0 && useAdvanceDeduction && advanceDeductionAmount > 0) {
                    setPaymentMethod('advance');
                  } else if (val > 0 && paymentMethod === 'advance') {
                    setPaymentMethod('cash');
                  }
                }}
                placeholder={useAdvanceDeduction && advanceDeductionAmount > 0 ? '0 (Réglé par avance)' : 'Ex: 85000'}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-base font-bold text-slate-900 focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none"
              />
              {amount > 0 && (
                <p className="text-[10px] text-slate-500 font-medium mt-1">
                  ≈ ${(amount / exchangeRateUSD).toFixed(2)} USD (Taux : 1 USD = {exchangeRateUSD.toLocaleString('fr-FR')} CDF)
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Mois / Libellé Principal *
              </label>
              <div className="relative">
                <select
                  value={targetMonth}
                  onChange={e => handleTargetMonthChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-indigo-900 focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none"
                >
                  <option value="Avance sur frais scolaires">Avance sur frais scolaires</option>
                  <optgroup label="Minerval / Frais Mensuels">
                    {ACADEMIC_YEAR_MONTHS.map(m => (
                      <option key={`m_${m}`} value={m}>
                        Minerval - {m} {studentClass?.monthlyFee ? `(${formatCurrency(studentClass.monthlyFee, currency)})` : ''}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Autres Frais & Examens">
                    <option value="Frais d'Inscription">Frais d'Inscription & Réinscription</option>
                    <option value="Frais d'Examen d'État & Jury">Frais d'Examen d'État & Jury</option>
                    <option value="Frais Travaux Pratiques & Labo">Frais Laboratoire & TP</option>
                    <option value="Frais de l'Etat">Frais de l'État</option>
                    {feeTypes?.filter(f => !(ACADEMIC_YEAR_MONTHS as readonly string[]).includes(f.name) && f.name !== "Frais d'Inscription").map(f => (
                      <option key={`ft_${f.id}`} value={f.name}>
                        {f.name} ({formatCurrency(f.amount, currency)})
                      </option>
                    ))}
                    <option value="Paiement Global">Paiement Global / Multiples</option>
                  </optgroup>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Mode de Paiement *
              </label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none"
              >
                {useAdvanceDeduction && (
                  <option value="advance">{getPaymentMethodLabel('advance')}</option>
                )}
                <option value="cash">{getPaymentMethodLabel('cash')}</option>
                <option value="mobile_money">{getPaymentMethodLabel('mobile_money')}</option>
                <option value="bank_transfer">{getPaymentMethodLabel('bank_transfer')}</option>
                <option value="check">{getPaymentMethodLabel('check')}</option>
                <option value="card">{getPaymentMethodLabel('card')}</option>
              </select>
            </div>
          </div>

          {/* Fee Allocations Breakdown Table */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Affectation aux Frais ({sortedUnpaidCharges.length + extraAllocations.length} ligne(s))
              </span>
              <button
                type="button"
                onClick={() => handleAutoDistribute(effectiveTotalAvailable)}
                className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Ventilation Intelligente (Inscription & Séquence)
              </button>
            </div>

            {/* Quick Add Extra Allocation according to Libellé */}
            <div className="mb-2.5 p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                Affecter à un autre libellé au choix :
              </span>
              <div className="flex items-center gap-2">
                <select
                  value={selectedExtraToAdd}
                  onChange={e => setSelectedExtraToAdd(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 outline-none flex-1 sm:w-64"
                >
                  <option value="">-- Choisir un libellé à affecter --</option>
                  <optgroup label="Mois Académiques">
                    {ACADEMIC_YEAR_MONTHS.map(m => (
                      <option key={`add_${m}`} value={m}>
                        Minerval - {m} {studentClass?.monthlyFee ? `(${formatCurrency(studentClass.monthlyFee, currency)})` : ''}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Autres Frais Réglementaires">
                    <option value="Frais d'Examen d'État & Jury">Frais d'Examen d'État & Jury</option>
                    <option value="Frais Travaux Pratiques & Labo">Frais Laboratoire & TP</option>
                    <option value="Frais de l'Etat">Frais de l'État</option>
                    {feeTypes?.filter(f => !(ACADEMIC_YEAR_MONTHS as readonly string[]).includes(f.name) && f.name !== "Frais d'Inscription").map(f => (
                      <option key={`add_ft_${f.id}`} value={f.name}>
                        {f.name} ({formatCurrency(f.amount, currency)})
                      </option>
                    ))}
                  </optgroup>
                </select>
                <button
                  type="button"
                  disabled={!selectedExtraToAdd}
                  onClick={() => {
                    if (selectedExtraToAdd) {
                      handleAddExtraAllocation(selectedExtraToAdd);
                      setSelectedExtraToAdd('');
                    }
                  }}
                  className="inline-flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-2xs transition-colors shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Ajouter
                </button>
              </div>
            </div>

            {sortedUnpaidCharges.length === 0 && extraAllocations.length === 0 ? (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-3">
                <div className="flex items-center gap-2 font-medium text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Cet élève est en règle pour tous ses frais facturés jusqu'à ce jour !</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Vous pouvez conserver tout montant versé en <strong>avance sur son compte</strong>, ou bien{' '}
                  <strong>affecter une partie ou la totalité</strong> de cette somme à d'autres frais selon leur libellé (Mois suivants, examens, etc.).
                </p>
                <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-slate-200/80">
                  <span className="text-[11px] font-semibold text-slate-700">Raccourcis rapides :</span>
                  {ACADEMIC_YEAR_MONTHS.slice(Math.max(0, currentAcademicIdx + 1), Math.max(3, currentAcademicIdx + 4)).map(m => (
                    <button
                      key={`quick_${m}`}
                      type="button"
                      onClick={() => handleAddExtraAllocation(m)}
                      className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md font-semibold text-[11px] shadow-2xs transition-colors cursor-pointer"
                    >
                      + {m} {studentClass?.monthlyFee ? `(${formatCurrency(studentClass.monthlyFee, currency)})` : ''}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">Frais / Statut</th>
                      <th className="py-2.5 px-2 text-right">Net Dû</th>
                      <th className="py-2.5 px-2 text-right">Reste à Payer</th>
                      <th className="py-2.5 px-3 text-right">Montant Alloué</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {/* Charges régulières impayées */}
                    {sortedUnpaidCharges.map(charge => {
                      const remaining = Math.max(0, charge.netAmount - charge.paidAmount);
                      const currentAlloc = allocations[charge.id] || 0;
                      const eligibility = eligibilityMap[charge.id] || { eligible: true };
                      const isLocked = !eligibility.eligible;
                      const isReg = isRegistrationFee(charge);
                      const chargeMonth = extractMonthFromCharge(charge);

                      return (
                        <tr
                          key={charge.id}
                          className={`transition-colors ${
                            isLocked ? 'bg-slate-50/80 text-slate-400' : 'hover:bg-indigo-50/30'
                          }`}
                        >
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5">
                              {isLocked ? (
                                <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              )}
                              <span className={`font-semibold ${isLocked ? 'text-slate-600' : 'text-slate-900'}`}>
                                {charge.label}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 mt-0.5">
                              {isReg && (
                                <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                                  Prioritaire
                                </span>
                              )}
                              {chargeMonth && (
                                <span className="text-[10px] font-medium text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200/60">
                                  Mois : {chargeMonth}
                                </span>
                              )}
                              <span className="text-[11px] text-slate-400">Échéance : {charge.dueDate}</span>
                            </div>

                            {isLocked && eligibility.lockReason && (
                              <p className="text-[10px] text-amber-700 font-medium mt-1 leading-tight">
                                🔒 {eligibility.lockReason}
                              </p>
                            )}
                          </td>

                          <td className="py-2.5 px-2 text-right text-slate-600">
                            {formatCurrency(charge.netAmount, currency)}
                          </td>

                          <td className="py-2.5 px-2 text-right font-bold text-rose-600">
                            {formatCurrency(remaining, currency)}
                          </td>

                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <input
                                type="number"
                                min="0"
                                max={remaining}
                                step="any"
                                disabled={isLocked}
                                value={currentAlloc || ''}
                                onChange={e =>
                                  handleManualAllocationChange(charge.id, parseFloat(e.target.value) || 0)
                                }
                                placeholder="0"
                                className={`w-24 text-right px-2 py-1.5 border rounded-lg font-bold text-xs outline-none transition-colors ${
                                  isLocked
                                    ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                                    : 'bg-white border-slate-300 text-slate-900 focus:ring-2 focus:ring-indigo-600'
                                }`}
                              />
                              {!isLocked && remaining > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleAllocateMaxToCharge(charge.id)}
                                  className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-1.5 py-1.5 rounded transition-colors cursor-pointer shrink-0"
                                  title={`Allouer le montant restant pour ${charge.label}`}
                                >
                                  Tout Allouer
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {/* Lignes d'affectations supplémentaires choisies selon libellé */}
                    {extraAllocations.map(extra => {
                      const currentAlloc = allocations[extra.id] || 0;
                      return (
                        <tr
                          key={extra.id}
                          className="bg-indigo-50/20 hover:bg-indigo-50/40 transition-colors"
                        >
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                              <span className="font-semibold text-slate-900">{extra.label}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded border border-indigo-200">
                                Affectation Anticipée selon Libellé
                              </span>
                              <span className="text-[10px] text-slate-500">
                                Tarif officiel promotion : {formatCurrency(extra.amountDue, currency)}
                              </span>
                            </div>
                          </td>

                          <td className="py-2.5 px-2 text-right text-slate-600">
                            {formatCurrency(extra.amountDue, currency)}
                          </td>

                          <td className="py-2.5 px-2 text-right font-bold text-indigo-700">
                            {formatCurrency(extra.amountDue, currency)}
                          </td>

                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <input
                                type="number"
                                min="0"
                                max={extra.amountDue}
                                step="any"
                                value={currentAlloc || ''}
                                onChange={e =>
                                  handleManualAllocationChange(extra.id, parseFloat(e.target.value) || 0)
                                }
                                placeholder="0"
                                className="w-24 text-right px-2 py-1.5 border border-indigo-300 rounded-lg font-bold text-xs bg-white text-indigo-950 focus:ring-2 focus:ring-indigo-600 outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleAllocateMaxToCharge(extra.id)}
                                className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-1.5 py-1.5 rounded transition-colors cursor-pointer shrink-0"
                                title={`Allouer le montant total pour ${extra.label}`}
                              >
                                Tout Allouer
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveExtraAllocation(extra.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer shrink-0"
                                title="Retirer cette affectation"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Allocation summary row */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-slate-500">Total Affecté aux frais :</span>{' '}
              <strong className="text-slate-800 font-bold">{formatCurrency(totalAllocated, currency)}</strong>
            </div>
            {advanceAmount > 0 && (
              <div className="text-right space-y-1">
                <span className="text-indigo-600 font-medium">Surplus / Avance reportée :</span>{' '}
                <strong className="text-emerald-600 font-bold">+{formatCurrency(advanceAmount, currency)}</strong>
              </div>
            )}
          </div>

          {/* Note / Reference */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Note interne ou Référence bordereau (facultatif)
            </label>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Ex: N° Bordereau Rawbank 492819 / Reçu caisse"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          {/* Modal Footer */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            >
              Annuler
            </button>

            <button
              type="submit"
              disabled={submitting || (amount <= 0 && (!useAdvanceDeduction || advanceDeductionAmount <= 0))}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              {submitting ? 'Validation & Émission du reçu...' : 'Valider & Émettre le Reçu'}
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
