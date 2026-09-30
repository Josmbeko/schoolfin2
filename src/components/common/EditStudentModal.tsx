import React, { useState } from 'react';
import {
  X,
  User,
  GraduationCap,
  Save,
  AlertCircle,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Building,
  CheckCircle,
  UserCheck,
} from 'lucide-react';
import { Student, School, ClassItem, OptionItem, SectionItem } from '../../types';
import { SchoolService } from '../../services/schoolService';
import { useAuth } from '../../context/AuthContext';
import { canSelectOption, DEFAULT_ACADEMIC_SECTIONS } from '../../utils/academic';

interface EditStudentModalProps {
  student: Student;
  school: School;
  classes: ClassItem[];
  options: OptionItem[];
  sections?: SectionItem[];
  onClose: () => void;
  onSuccess: (updatedStudent: Student) => void;
}

export const EditStudentModal: React.FC<EditStudentModalProps> = ({
  student,
  school,
  classes,
  options,
  sections = [],
  onClose,
  onSuccess,
}) => {
  const { schoolId, currentUser, profile, role } = useAuth();

  // Permission check : seuls l'Administrateur Général et le Secrétaire Administratif ont accès
  const hasPermission = ['admin', 'secretary'].includes(role);

  // Sections actives
  const activeSections = sections.length > 0 ? sections : DEFAULT_ACADEMIC_SECTIONS.map((s, idx) => ({
    id: `sec_${idx}`,
    schoolId: school.id,
    name: s.name,
    code: s.code,
    description: s.description,
    order: s.order,
    active: true,
    createdAt: '',
  }));

  // Initial form values pre-filled from student
  const [form, setForm] = useState({
    lastName: student.lastName || '',
    firstName: student.firstName || '',
    gender: student.gender || 'M',
    dateOfBirth: student.dateOfBirth || '',
    placeOfBirth: student.placeOfBirth || '',
    section: student.section || classes.find(c => c.id === student.classId)?.section || 'Secondaire',
    classId: student.classId || '',
    optionId: student.optionId || '',
    parentName: student.parentName || '',
    parentPhone: student.parentPhone || '',
    parentEmail: student.parentEmail || '',
    address: student.address || '',
  });

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Classes filtrées selon la section sélectionnée
  const filteredClasses = classes.filter(c => {
    if (!form.section) return true;
    return c.section?.toLowerCase() === form.section.toLowerCase();
  });

  // Déterminer la classe actuellement choisie
  const selectedClass = classes.find(c => c.id === form.classId);

  // Déterminer si la classe/section permet le choix d'une option
  const canChooseOption = canSelectOption(
    form.section,
    selectedClass?.level,
    selectedClass?.name
  );

  // Options filtrées pour la section
  const availableOptions = options.filter(opt => {
    if (!form.section) return true;
    return opt.section?.toLowerCase() === form.section.toLowerCase();
  });

  // Handler changement de section : filtre et réassigne classe et option
  const handleSectionChange = (newSection: string) => {
    const matchingClasses = classes.filter(
      c => c.section?.toLowerCase() === newSection.toLowerCase()
    );
    const newClassId = matchingClasses.length > 0 ? matchingClasses[0].id : '';
    const newClass = classes.find(c => c.id === newClassId);
    const optionAllowed = canSelectOption(newSection, newClass?.level, newClass?.name);

    setForm(prev => ({
      ...prev,
      section: newSection,
      classId: newClassId,
      optionId: optionAllowed ? prev.optionId : '',
    }));
  };

  // Handler changement de classe
  const handleClassChange = (newClassId: string) => {
    const targetClass = classes.find(c => c.id === newClassId);
    const optionAllowed = canSelectOption(form.section, targetClass?.level, targetClass?.name);

    setForm(prev => ({
      ...prev,
      classId: newClassId,
      optionId: optionAllowed ? prev.optionId : '',
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!hasPermission) {
      setErrorMessage("Action non autorisée. Seuls le Secrétaire Administratif et l'Administrateur Général peuvent modifier le dossier.");
      return;
    }

    if (!form.lastName.trim() || !form.firstName.trim()) {
      setErrorMessage("Le nom et le prénom de l'élève sont obligatoires.");
      return;
    }

    if (!form.classId) {
      setErrorMessage("La classe de l'élève est obligatoire.");
      return;
    }

    if (!form.parentName.trim() || !form.parentPhone.trim()) {
      setErrorMessage('Le nom et le numéro de téléphone du parent/responsable sont obligatoires.');
      return;
    }

    setSaving(true);
    try {
      const targetClass = classes.find(c => c.id === form.classId);
      const targetOption = options.find(o => o.id === form.optionId);

      const updatedPayload: Student = {
        ...student,
        lastName: form.lastName.trim().toUpperCase(),
        firstName: form.firstName.trim(),
        gender: form.gender as 'M' | 'F',
        dateOfBirth: form.dateOfBirth,
        placeOfBirth: form.placeOfBirth.trim(),
        section: form.section,
        classId: form.classId,
        className: targetClass?.name || student.className,
        optionId: canChooseOption ? (form.optionId || '') : '',
        optionName: canChooseOption ? (targetOption?.name || 'Générale') : 'Générale',
        parentName: form.parentName.trim(),
        parentPhone: form.parentPhone.trim(),
        parentEmail: form.parentEmail.trim(),
        address: form.address.trim(),
      };

      await SchoolService.saveStudent(
        schoolId,
        updatedPayload,
        currentUser?.uid || 'user_admin',
        currentUser?.email || profile?.email || 'admin@ecole.cd'
      );

      onSuccess(updatedPayload);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de la modification du dossier.';
      setErrorMessage(msg);
      setSaving(false);
    }
  };

  if (!hasPermission) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Accès Restreint</h3>
          <p className="text-xs text-slate-500">
            Seuls le <strong>Secrétaire Administratif</strong> et l'<strong>Administrateur Général</strong> ont le droit de modifier les coordonnées d'un élève.
          </p>
          <button
            onClick={onClose}
            className="w-full py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[94vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-5 sm:px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg text-white">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">
                Modifier les Coordonnées du Dossier
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                {student.lastName} {student.firstName} · Matricule : {student.matricule}
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

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-xs text-rose-800 font-medium">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 1. État Civil & Identité de l'Élève */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2 border-b border-slate-100 pb-1.5">
              <User className="w-4 h-4 text-indigo-600" />
              1. État Civil & Identité de l'Élève
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Nom & Post-nom *
                </label>
                <input
                  type="text"
                  required
                  value={form.lastName}
                  onChange={e => setForm({ ...form, lastName: e.target.value })}
                  placeholder="Ex: KABAMBA MUKENDI"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-600 uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Prénom *
                </label>
                <input
                  type="text"
                  required
                  value={form.firstName}
                  onChange={e => setForm({ ...form, firstName: e.target.value })}
                  placeholder="Ex: Jonathan"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Genre / Sexe *
                </label>
                <select
                  value={form.gender}
                  onChange={e => setForm({ ...form, gender: e.target.value as 'M' | 'F' })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-600"
                >
                  <option value="M">Masculin (M)</option>
                  <option value="F">Féminin (F)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Date de Naissance
                </label>
                <input
                  type="date"
                  value={form.dateOfBirth}
                  onChange={e => setForm({ ...form, dateOfBirth: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Lieu de Naissance
                </label>
                <input
                  type="text"
                  value={form.placeOfBirth}
                  onChange={e => setForm({ ...form, placeOfBirth: e.target.value })}
                  placeholder="Ex: Kinshasa"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>
            </div>
          </div>

          {/* 2. Cursus Pédagogique (Section, Classe & Option) */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2 border-b border-slate-100 pb-1.5">
              <GraduationCap className="w-4 h-4 text-indigo-600" />
              2. Affectation Scolaire & Cursus Pédagogique
            </h4>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Section Académique *
              </label>
              <select
                value={form.section}
                onChange={e => handleSectionChange(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-600"
              >
                {activeSections.map(sec => (
                  <option key={sec.id} value={sec.name}>
                    Section {sec.name} {sec.code ? `(${sec.code})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Classe d'Affectation *
                </label>
                <select
                  required
                  value={form.classId}
                  onChange={e => handleClassChange(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-600"
                >
                  <option value="">Sélectionner une classe...</option>
                  {filteredClasses.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.level ? `(${c.level})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1 flex items-center justify-between">
                  <span>Option / Filière</span>
                  {!canChooseOption && (
                    <span className="text-[10px] text-slate-400 font-normal lowercase">
                      (non requise)
                    </span>
                  )}
                </label>
                <select
                  disabled={!canChooseOption}
                  value={form.optionId}
                  onChange={e => setForm({ ...form, optionId: e.target.value })}
                  className={`w-full px-3 py-2 bg-white border rounded-lg text-xs font-medium outline-none ${
                    canChooseOption
                      ? 'border-slate-300 focus:ring-2 focus:ring-indigo-600 text-slate-900'
                      : 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <option value="">Sans Option / Tronc Commun</option>
                  {availableOptions.map(opt => (
                    <option key={opt.id} value={opt.id}>
                      {opt.name}
                    </option>
                  ))}
                </select>
                {canChooseOption ? (
                  <p className="text-[10px] text-indigo-600 mt-1">
                    Option autorisée pour le niveau {selectedClass?.level || 'Secondaire'}.
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-400 mt-1">
                    Les options sont strictement réservées aux classes de 1ère, 2è, 3è et 4è Secondaire.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* 3. Coordonnées du Parent / Tuteur Légal */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2 border-b border-slate-100 pb-1.5">
              <Phone className="w-4 h-4 text-indigo-600" />
              3. Coordonnées du Parent / Tuteur Légal
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Nom Complet du Parent / Responsable *
                </label>
                <input
                  type="text"
                  required
                  value={form.parentName}
                  onChange={e => setForm({ ...form, parentName: e.target.value })}
                  placeholder="Ex: M. Jean-Paul KABAMBA"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Téléphone du Responsable *
                </label>
                <input
                  type="text"
                  required
                  value={form.parentPhone}
                  onChange={e => setForm({ ...form, parentPhone: e.target.value })}
                  placeholder="Ex: +243 81 000 0000"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-medium text-slate-900 outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Email du Responsable
                </label>
                <input
                  type="email"
                  value={form.parentEmail}
                  onChange={e => setForm({ ...form, parentEmail: e.target.value })}
                  placeholder="Ex: parent@gmail.com"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Adresse de Résidence
                </label>
                <input
                  type="text"
                  value={form.address}
                  onChange={e => setForm({ ...form, address: e.target.value })}
                  placeholder="Ex: 14 Av. de la Paix, Gombe"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>
            </div>
          </div>

          {/* Modal Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Enregistrement...' : 'Enregistrer les Modifications'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
