import React, { useState } from 'react';
import {
  ShieldAlert,
  Calendar,
  AlertCircle,
  CheckCircle,
  FileText,
  Percent,
  X,
  Info,
  Sliders,
} from 'lucide-react';
import { Student, School } from '../../types';
import { SchoolService } from '../../services/schoolService';
import { useAuth } from '../../context/AuthContext';
import { ACADEMIC_YEAR_MONTHS } from '../../utils/academic';

interface StudentSituationModalProps {
  student: Student;
  school: School;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

export const StudentSituationModal: React.FC<StudentSituationModalProps> = ({
  student,
  school,
  onClose,
  onSuccess,
}) => {
  const { schoolId, currentUser, profile, role } = useAuth();

  const [scope, setScope] = useState<'month' | 'year'>(
    student.financialSituation?.scope || 'month'
  );
  const [selectedMonth, setSelectedMonth] = useState<string>(
    student.financialSituation?.month || ACADEMIC_YEAR_MONTHS[0] || 'Septembre'
  );
  const [situationType, setSituationType] = useState<
    'in_order' | 'exempted' | 'scholarship' | 'extended_deadline' | 'social_case' | 'standard'
  >(
    (student.financialSituation?.situation as any) || 'in_order'
  );
  const [discountPct, setDiscountPct] = useState<number>(
    student.financialSituation?.discountPercentage || 100
  );
  const [motif, setMotif] = useState<string>(
    student.financialSituation?.motif || ''
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Vérification de permission stricte : Administrateur Général uniquement
  const isAdmin = role === 'admin';

  const situationOptions = [
    {
      id: 'in_order',
      title: 'En Règle / Régularisé',
      desc: 'Valider administrativement les frais dus (solde considéré comme acquitté)',
      badge: 'Régularisation',
      color: 'emerald',
    },
    {
      id: 'exempted',
      title: 'Exonération Totale (100%)',
      desc: 'Prise en charge intégrale par la direction générale ou convention',
      badge: 'Exonération 100%',
      color: 'indigo',
    },
    {
      id: 'scholarship',
      title: 'Bourse Scolaire / Réduction',
      desc: 'Application d’un abattement en pourcentage sur les obligations de frais',
      badge: 'Bourse',
      color: 'amber',
    },
    {
      id: 'extended_deadline',
      title: 'Moratoire / Délai Prolongé',
      desc: 'Délai de paiement exceptionnel accordé aux parents sans pénalité',
      badge: 'Délai accordé',
      color: 'blue',
    },
    {
      id: 'social_case',
      title: 'Cas Social Établi',
      desc: 'Allègement pour circonstances exceptionnelles certifiées par le comité',
      badge: 'Cas Social',
      color: 'purple',
    },
    {
      id: 'standard',
      title: 'Rétablir le Barème Standard',
      desc: 'Annuler les dérogations administratives et restaurer les montants initiaux',
      badge: 'Standard',
      color: 'slate',
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setError('Seul l’Administrateur Général dispose de l’habilitation pour modifier la situation.');
      return;
    }

    if (!motif.trim()) {
      setError('Le motif administratif est strictement obligatoire.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const selectedOption = situationOptions.find(o => o.id === situationType);
      const label =
        situationType === 'scholarship'
          ? `Bourse d'Études (${discountPct}%)`
          : selectedOption?.title || 'Modification administrative';

      await SchoolService.updateStudentFinancialSituation(
        schoolId,
        student.id,
        {
          scope,
          month: scope === 'month' ? selectedMonth : undefined,
          situation: situationType,
          label,
          motif: motif.trim(),
          discountPercentage: situationType === 'scholarship' ? discountPct : situationType === 'exempted' ? 100 : undefined,
        },
        currentUser?.uid || 'admin',
        currentUser?.email || profile?.email || 'admin@ecole.cd',
        profile?.displayName || currentUser?.displayName || 'Administrateur Général'
      );

      await onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Erreur lors de la modification de la situation.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center text-indigo-300">
              <ShieldAlert className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold tracking-tight">
                  Modifier la Situation de l'Élève
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase tracking-wider">
                  Admin Général
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Dossier de <strong className="text-white uppercase">{student.lastName} {student.firstName}</strong> ({student.matricule})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {!isAdmin && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>
                Attention : Cette action est réservée exclusivement au rôle <strong>Administrateur Général</strong>.
              </span>
            </div>
          )}

          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Student Banner */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
            <div>
              <span className="text-slate-500 block text-[11px] font-medium">Classe & Section</span>
              <strong className="text-slate-800 font-semibold">
                {student.className || 'Non assignée'}
              </strong>
              {student.section && (
                <span className="ml-2 px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-semibold border border-blue-200">
                  {student.section}
                </span>
              )}
            </div>
            <div>
              <span className="text-slate-500 block text-[11px] font-medium">Situation actuelle</span>
              <span className="font-semibold text-indigo-700">
                {student.financialSituation?.label || 'Barème Standard régulier'}
              </span>
            </div>
          </div>

          {/* 1. Scope Selection (Mois précis vs Toute l'année) */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
              1. Périmètre de la Décision *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <label
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  scope === 'month'
                    ? 'bg-indigo-50/70 border-indigo-400 text-indigo-900 shadow-xs'
                    : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="scope"
                  value="month"
                  checked={scope === 'month'}
                  onChange={() => setScope('month')}
                  className="mt-0.5 text-indigo-600 focus:ring-indigo-600"
                />
                <div>
                  <span className="text-xs font-bold block">Pour un mois précis</span>
                  <span className="text-[11px] text-slate-500">
                    S'applique exclusivement aux frais du mois sélectionné
                  </span>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  scope === 'year'
                    ? 'bg-indigo-50/70 border-indigo-400 text-indigo-900 shadow-xs'
                    : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="scope"
                  value="year"
                  checked={scope === 'year'}
                  onChange={() => setScope('year')}
                  className="mt-0.5 text-indigo-600 focus:ring-indigo-600"
                />
                <div>
                  <span className="text-xs font-bold block">Pour toute l'année</span>
                  <span className="text-[11px] text-slate-500">
                    S'applique à la totalité de l'année scolaire ({school.schoolYear || '2026-2027'})
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Month selector if scope === 'month' */}
          {scope === 'month' && (
            <div className="p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-2 animate-in fade-in">
              <label className="block text-xs font-semibold text-indigo-950">
                Sélectionner le mois concerné *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ACADEMIC_YEAR_MONTHS.map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setSelectedMonth(m)}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg border text-center transition-all cursor-pointer ${
                      selectedMonth.toLowerCase() === m.toLowerCase()
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 2. Situation Type */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
              2. Nouvelle Situation Financière *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {situationOptions.map(opt => {
                const isSelected = situationType === opt.id;
                return (
                  <label
                    key={opt.id}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-indigo-50 border-indigo-500 text-slate-900 shadow-xs'
                        : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="situationType"
                      value={opt.id}
                      checked={isSelected}
                      onChange={() => setSituationType(opt.id as any)}
                      className="mt-0.5 text-indigo-600 focus:ring-indigo-600"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold">{opt.title}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                        {opt.desc}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Percentage slider if Scholarship */}
          {situationType === 'scholarship' && (
            <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-amber-900 uppercase">
                  Pourcentage de prise en charge / Réduction
                </label>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-200 text-amber-900">
                  {discountPct}%
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={discountPct}
                onChange={e => setDiscountPct(Number(e.target.value))}
                className="w-full accent-amber-600"
              />
              <div className="flex justify-between text-[10px] text-amber-800 font-medium">
                <span>10% (Partielle)</span>
                <span>50% (Demi-bourse)</span>
                <span>100% (Bourse intégrale)</span>
              </div>
            </div>
          )}

          {/* 3. Mandatory Reason / Motif */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                3. Motif Obligatoire de l'Administrateur Général *
              </label>
              <span className="text-[11px] text-rose-600 font-semibold">
                Mention obligatoire
              </span>
            </div>
            <textarea
              required
              rows={3}
              value={motif}
              onChange={e => setMotif(e.target.value)}
              placeholder="Préciser obligatoirement le motif administratif (ex: Décision du Conseil d'Administration n°14, Bourse d'excellence suite aux délibérations, Demande sociale accordée par la Direction Générale...)"
              className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-600 font-medium"
            />
            <p className="text-[11px] text-slate-500">
              Ce motif sera enregistré dans le registre officiel d'audit avec votre identifiant administrateur et la date d'application.
            </p>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-indigo-600" />
            <span>Mise à jour immédiate des obligations comptables</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={submitting || !isAdmin || !motif.trim()}
              onClick={handleSubmit}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Validation en cours...' : 'Appliquer la Situation'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
