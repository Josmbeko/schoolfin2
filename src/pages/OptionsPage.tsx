import React, { useState } from 'react';
import {
  Sparkles,
  Plus,
  Trash2,
  Edit3,
  Users,
  GraduationCap,
  Info,
  Layers,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { School, OptionItem, ClassItem, Student } from '../types';
import { SchoolService } from '../services/schoolService';
import { useAuth } from '../context/AuthContext';
import { canSelectOption } from '../utils/academic';

interface OptionsPageProps {
  school: School;
  options: OptionItem[];
  classes: ClassItem[];
  students: Student[];
  onRefreshData: () => Promise<void>;
}

export const OptionsPage: React.FC<OptionsPageProps> = ({
  school,
  options,
  classes,
  students,
  onRefreshData,
}) => {
  const { schoolId, currentUser, profile, role } = useAuth();
  const isAdmin = ['admin', 'director'].includes(role);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [optionToDelete, setOptionToDelete] = useState<OptionItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form State
  const [formData, setFormData] = useState<{
    id?: string;
    name: string;
    section: string;
    description: string;
  }>({
    name: '',
    section: 'Secondaire',
    description: '',
  });

  const handleOpenAddModal = () => {
    setFormData({
      name: '',
      section: 'Secondaire',
      description: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (opt: OptionItem) => {
    setFormData({
      id: opt.id,
      name: opt.name,
      section: opt.section,
      description: opt.description || '',
    });
    setIsModalOpen(true);
  };

  const handleSaveOption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    setSaving(true);
    try {
      await SchoolService.saveOption(
        schoolId,
        formData,
        currentUser?.uid || 'admin',
        currentUser?.email || profile?.email || 'admin@ecole.cd'
      );
      await onRefreshData();
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'enregistrement de l'option");
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!optionToDelete) return;

    setDeleting(true);
    try {
      await SchoolService.deleteOption(
        schoolId,
        optionToDelete.id,
        currentUser?.uid || 'admin',
        currentUser?.email || profile?.email || 'admin@ecole.cd'
      );
      await onRefreshData();
      setOptionToDelete(null);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la suppression de l'option");
    } finally {
      setDeleting(false);
    }
  };

  // Secondary classes eligible for options (1ère, 2è, 3è, 4è Secondaire)
  const eligibleClasses = classes.filter(c => canSelectOption(c.section, c.level, c.name));

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            Options & Filières Spécialisées
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Gestion des filières d'études (Scientifique, Commerciale, Littéraire, Technique...)
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Ajouter une Option
          </button>
        )}
      </div>

      {/* Regle Pédagogique Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 flex items-start gap-3">
        <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <strong className="block font-bold">Règle d'orientation académique :</strong>
          Les choix des options commencent strictement à partir de la <strong>1ère, 2è, 3è et 4è section Secondaire</strong> (Humanités). Les cycles Maternelle, Primaire et Éducation de Base (7è et 8è) suivent le programme de tronc commun général sans choix de filière.
        </div>
      </div>

      {/* Options Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {options.map(option => {
          // Count students enrolled in this option
          const optionStudents = students.filter(s => s.optionId === option.id);
          // Classes configured with this option
          const optionClasses = eligibleClasses.filter(
            c => c.optionId === option.id || c.name.toLowerCase().includes(option.name.toLowerCase())
          );

          return (
            <div
              key={option.id}
              className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded">
                      {option.section || 'Secondaire'}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 mt-1.5">{option.name}</h3>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold text-[10px]">
                    1ère - 4è Sec.
                  </span>
                </div>

                <p className="text-xs text-slate-500 mt-2.5 min-h-[36px] line-clamp-2">
                  {option.description || "Formation générale et technique orientée vers les épreuves du Diplôme d'État."}
                </p>

                {/* Metrics */}
                <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[11px] text-slate-500 block">Élèves inscrits</span>
                    <strong className="text-sm font-bold text-slate-900 flex items-center gap-1 mt-0.5">
                      <Users className="w-3.5 h-3.5 text-indigo-600" />
                      {optionStudents.length} élèves
                    </strong>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[11px] text-slate-500 block">Classes associées</span>
                    <strong className="text-sm font-bold text-slate-900 flex items-center gap-1 mt-0.5">
                      <GraduationCap className="w-3.5 h-3.5 text-slate-700" />
                      {optionClasses.length} classes
                    </strong>
                  </div>
                </div>

                {optionClasses.length > 0 && (
                  <div className="mt-3">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
                      Classes en Secondaire :
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {optionClasses.map(c => (
                        <span
                          key={c.id}
                          className="text-[11px] bg-indigo-50/70 text-indigo-800 px-2 py-0.5 rounded font-medium border border-indigo-100"
                        >
                          {c.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              {isAdmin && (
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() => handleOpenEditModal(option)}
                    className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Modifier
                  </button>

                  <button
                    onClick={() => setOptionToDelete(option)}
                    className="inline-flex items-center gap-1 text-xs text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Supprimer
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal: Add/Edit Option */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                {formData.id ? "Modifier l'Option" : 'Nouvelle Option / Filière'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveOption} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Nom de l'Option / Filière *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Scientifique, Commerciale & Gestion, Littéraire..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Section Pédagogique *
                </label>
                <input
                  type="text"
                  required
                  value={formData.section}
                  onChange={e => setFormData({ ...formData, section: e.target.value })}
                  placeholder="Ex: Secondaire / Humanités"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs outline-none"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Les options s'appliquent en 1ère, 2è, 3è et 4è Secondaire.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Description Pédagogique
                </label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Matières dominantes, débouchés ou compétences visées..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs outline-none"
                ></textarea>
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
                  {saving ? 'Enregistrement...' : 'Enregistrer Option'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirm Delete */}
      {optionToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-rose-600 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Supprimer l'Option
              </h3>
              <button
                onClick={() => setOptionToDelete(null)}
                className="text-white/80 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-700 leading-relaxed">
                Êtes-vous certain de vouloir supprimer la filière{' '}
                <strong className="text-slate-900">"{optionToDelete.name}"</strong> ?
              </p>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setOptionToDelete(null)}
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
                  {deleting ? 'Suppression...' : 'Supprimer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
