import React, { useState } from 'react';
import {
  GraduationCap,
  Plus,
  Edit3,
  Trash2,
  Users,
  Search,
  Filter,
  DollarSign,
  AlertTriangle,
  Info,
  CheckCircle,
} from 'lucide-react';
import { ClassItem, OptionItem, SectionItem, Student, School } from '../types';
import { formatCurrency } from '../utils/formatters';
import { SchoolService } from '../services/schoolService';
import { useAuth } from '../context/AuthContext';
import { canSelectOption } from '../utils/academic';

interface ClassesPageProps {
  school: School;
  classes: ClassItem[];
  sections: SectionItem[];
  options: OptionItem[];
  students: Student[];
  onRefreshData: () => Promise<void>;
}

export const ClassesPage: React.FC<ClassesPageProps> = ({
  school,
  classes,
  sections,
  options,
  students,
  onRefreshData,
}) => {
  const { schoolId, currentUser, profile, role } = useAuth();
  const isAdmin = ['admin', 'director'].includes(role);
  const currency = school.currency || 'CDF';

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSectionFilter, setSelectedSectionFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [classToDelete, setClassToDelete] = useState<ClassItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form State
  const [formData, setFormData] = useState<{
    id?: string;
    name: string;
    section: string;
    level: string;
    optionId: string;
    monthlyFee: number;
  }>({
    name: '',
    section: 'Secondaire',
    level: '1ère',
    optionId: '',
    monthlyFee: 85000,
  });

  const isFormEligibleForOption = canSelectOption(
    formData.section,
    formData.level,
    formData.name
  );

  const handleOpenAddModal = () => {
    setFormData({
      name: '',
      section: sections[0]?.name || 'Secondaire',
      level: '1ère',
      optionId: '',
      monthlyFee: 85000,
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (c: ClassItem) => {
    setFormData({
      id: c.id,
      name: c.name,
      section: c.section,
      level: c.level,
      optionId: c.optionId || '',
      monthlyFee: c.monthlyFee,
    });
    setIsModalOpen(true);
  };

  const handleSaveClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    setSaving(true);
    try {
      const selectedOption = isFormEligibleForOption
        ? options.find(o => o.id === formData.optionId)
        : null;

      await SchoolService.saveClass(
        schoolId,
        {
          id: formData.id,
          name: formData.name.trim(),
          section: formData.section.trim(),
          level: formData.level.trim(),
          optionId: isFormEligibleForOption ? formData.optionId : '',
          optionName: selectedOption ? selectedOption.name : '',
          monthlyFee: Number(formData.monthlyFee) || 0,
        },
        currentUser?.uid || 'admin',
        currentUser?.email || profile?.email || 'admin@ecole.cd'
      );

      await onRefreshData();
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'enregistrement de la classe");
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!classToDelete) return;

    setDeleting(true);
    try {
      await SchoolService.deleteClass(
        schoolId,
        classToDelete.id,
        currentUser?.uid || 'admin',
        currentUser?.email || profile?.email || 'admin@ecole.cd'
      );
      await onRefreshData();
      setClassToDelete(null);
    } catch (err) {
      console.error(err);
      alert('Erreur lors de la suppression de la classe');
    } finally {
      setDeleting(false);
    }
  };

  // Filtered classes
  const filteredClasses = classes.filter(c => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.section.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.optionName && c.optionName.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesSection =
      selectedSectionFilter === 'all' ||
      c.section.toLowerCase() === selectedSectionFilter.toLowerCase();

    return matchesSearch && matchesSection;
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-indigo-600" />
            Gestion des Classes Scolaires
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {classes.length} classes configurées · {students.length} élèves répartis
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Ajouter une Classe
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Rechercher une classe, filière..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <label className="text-xs font-semibold text-slate-500">Section :</label>
          <select
            value={selectedSectionFilter}
            onChange={e => setSelectedSectionFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 outline-none"
          >
            <option value="all">Toutes les sections</option>
            {sections.map(s => (
              <option key={s.id} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Classes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredClasses.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-400 bg-white border border-slate-200 rounded-xl">
            Aucune classe ne correspond à vos filtres.
          </div>
        ) : (
          filteredClasses.map(c => {
            const classStudents = students.filter(s => s.classId === c.id);
            const hasOption = Boolean(c.optionName || c.optionId);
            const isSecondaryEligible = canSelectOption(c.section, c.level, c.name);

            return (
              <div
                key={c.id}
                className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wider">
                        {c.section}
                      </span>
                      <h3 className="text-base font-bold text-slate-900 mt-0.5">{c.name}</h3>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                      Niveau {c.level}
                    </span>
                  </div>

                  {/* Option Badge */}
                  <div className="mt-2.5">
                    {hasOption ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                        Option : {c.optionName}
                      </span>
                    ) : isSecondaryEligible ? (
                      <span className="text-[11px] text-slate-400 italic">
                        Option non définie
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded">
                        Tronc commun
                      </span>
                    )}
                  </div>

                  {/* Class Info */}
                  <div className="mt-4 space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Effectif de la classe :</span>
                      <strong className="text-slate-800 font-semibold">
                        {classStudents.length} élèves inscrits
                      </strong>
                    </div>

                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">Minerval mensuel :</span>
                      <strong className="text-indigo-700 font-bold">
                        {formatCurrency(c.monthlyFee, currency)}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                {isAdmin && (
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <button
                      onClick={() => handleOpenEditModal(c)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Modifier
                    </button>

                    <button
                      onClick={() => setClassToDelete(c)}
                      className="text-xs text-rose-600 hover:text-rose-800 font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Supprimer
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Add/Edit Class */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-indigo-400" />
                {formData.id ? 'Modifier la Classe' : 'Nouvelle Classe'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveClass} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Nom complet de la Classe *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: 1ère Scientifique A, 3ème Commerciale..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-600 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Section *
                  </label>
                  <select
                    required
                    value={formData.section}
                    onChange={e => setFormData({ ...formData, section: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-600"
                  >
                    {sections.map(sec => (
                      <option key={sec.id} value={sec.name}>
                        {sec.name}
                      </option>
                    ))}
                    {sections.length === 0 && (
                      <>
                        <option value="Secondaire">Secondaire</option>
                        <option value="Primaire">Primaire</option>
                        <option value="Éducation de Base">Éducation de Base</option>
                        <option value="Maternelle">Maternelle</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Niveau *
                  </label>
                  <select
                    required
                    value={formData.level}
                    onChange={e => setFormData({ ...formData, level: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-600 font-medium"
                  >
                    <optgroup label="Secondaire / Humanités (Options admises)">
                      <option value="1ère">1ère Secondaire</option>
                      <option value="2è">2è Secondaire</option>
                      <option value="3è">3è Secondaire</option>
                      <option value="4è">4è Secondaire</option>
                    </optgroup>
                    <optgroup label="Éducation de Base (Tronc commun)">
                      <option value="7ème">7ème de Base</option>
                      <option value="8ème">8ème de Base</option>
                    </optgroup>
                    <optgroup label="Primaire & Maternelle">
                      <option value="1ère Primaire">1ère Primaire</option>
                      <option value="2ème Primaire">2ème Primaire</option>
                      <option value="3ème Primaire">3ème Primaire</option>
                      <option value="4ème Primaire">4ème Primaire</option>
                      <option value="5ème Primaire">5ème Primaire</option>
                      <option value="6ème Primaire">6ème Primaire</option>
                      <option value="Maternelle">Maternelle</option>
                    </optgroup>
                  </select>
                </div>
              </div>

              {/* Option Selection with Strict Educational Rule */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Option / Filière
                </label>
                {isFormEligibleForOption ? (
                  <div>
                    <select
                      value={formData.optionId}
                      onChange={e => setFormData({ ...formData, optionId: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-indigo-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-600 font-medium"
                    >
                      <option value="">Sélectionner une option (facultatif)</option>
                      {options.map(opt => (
                        <option key={opt.id} value={opt.id}>
                          {opt.name} ({opt.section})
                        </option>
                      ))}
                    </select>
                    <span className="text-[10px] text-emerald-600 font-medium mt-1 block">
                      ✓ Classe de Secondaire ({formData.level}) éligible au choix des filières d'études.
                    </span>
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-500">
                    <span className="font-semibold block text-slate-700">Tronc commun :</span>
                    Les choix des options commencent strictement à partir de <strong>1ère, 2è, 3è et 4è section Secondaire</strong>.
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Minerval Mensuel de Référence ({currency})
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={formData.monthlyFee}
                  onChange={e =>
                    setFormData({ ...formData, monthlyFee: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirm Delete */}
      {classToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-rose-600 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Supprimer la Classe
              </h3>
              <button
                onClick={() => setClassToDelete(null)}
                className="text-white/80 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-700 leading-relaxed">
                Êtes-vous certain de vouloir supprimer la classe{' '}
                <strong className="text-slate-900">"{classToDelete.name}"</strong> ?
              </p>

              {students.some(s => s.classId === classToDelete.id) && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                  ⚠️ <strong>Attention :</strong> {students.filter(s => s.classId === classToDelete.id).length} élèves sont actuellement inscrits dans cette classe.
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setClassToDelete(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleConfirmDelete}
                  className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  {deleting ? 'Suppression...' : 'Supprimer Définitivement'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
