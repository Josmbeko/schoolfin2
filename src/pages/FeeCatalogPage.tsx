import React, { useState } from 'react';
import {
  Plus,
  Layers,
  Edit3,
  Tag,
  Trash2,
  DollarSign,
  Check,
  X,
  Filter,
  Search,
  BookOpen,
  GraduationCap,
  Sparkles,
  School as SchoolIcon,
  HelpCircle,
  AlertTriangle,
} from 'lucide-react';
import { FeeType, FeeFrequency, FeeCategory, ClassItem, OptionItem, SectionItem, School } from '../types';
import { formatCurrency } from '../utils/formatters';
import { SchoolService } from '../services/schoolService';
import { useAuth } from '../context/AuthContext';
import { STANDARD_FEE_CATEGORIES, PROMOTIONS_LIST, canSelectOption, isSecondarySection } from '../utils/academic';

interface FeeCatalogPageProps {
  school: School;
  feeTypes: FeeType[];
  classes: ClassItem[];
  sections: SectionItem[];
  options: OptionItem[];
  onRefreshData: () => Promise<void>;
}

export const FeeCatalogPage: React.FC<FeeCatalogPageProps> = ({
  school,
  feeTypes,
  classes,
  sections,
  options,
  onRefreshData,
}) => {
  const { schoolId, currentUser, profile, role } = useAuth();
  const currency = school.currency || 'CDF';
  const isAdminGeneral = role === 'admin';

  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterSection, setFilterSection] = useState<string>('all');
  const [filterPromotion, setFilterPromotion] = useState<string>('all');
  const [filterOption, setFilterOption] = useState<string>('all');
  const [filterClass, setFilterClass] = useState<string>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feeToDelete, setFeeToDelete] = useState<FeeType | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [formData, setFormData] = useState<{
    id?: string;
    name: string;
    category: FeeCategory;
    section: string;
    promotion: string;
    optionId: string;
    optionName: string;
    classId: string;
    className: string;
    description: string;
    amount: number;
    frequency: FeeFrequency;
  }>({
    name: '',
    category: 'Minerval',
    section: '',
    promotion: '',
    optionId: '',
    optionName: '',
    classId: '',
    className: '',
    description: '',
    amount: 85000,
    frequency: 'monthly',
  });

  const getFrequencyLabel = (freq: FeeFrequency) => {
    switch (freq) {
      case 'monthly':
        return 'Mensuel';
      case 'termly':
        return 'Trimestriel';
      case 'annual':
        return 'Annuel';
      case 'once':
        return 'Unique';
      default:
        return freq;
    }
  };

  const getCategoryBadgeClass = (cat?: string) => {
    switch (cat) {
      case 'Minerval':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case "Frais d'Inscription & Réinscription":
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case "Frais d'Examen d'État & Jury":
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Frais Travaux Pratiques & Laboratoire':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case "Frais de l'Etat":
        return 'bg-slate-100 text-slate-800 border-slate-300';
      default:
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    }
  };

  // Dynamic classes for modal selection based on chosen section/option
  const availableClassesInModal = classes.filter(c => {
    if (formData.section && c.section !== formData.section) return false;
    if (formData.optionId && c.optionId !== formData.optionId) return false;
    if (formData.promotion && !c.name.toLowerCase().includes(formData.promotion.toLowerCase()) && !c.level.toLowerCase().includes(formData.promotion.toLowerCase())) return false;
    return true;
  });

  const handleOpenNewModal = () => {
    setFormData({
      name: '',
      category: 'Minerval',
      section: '',
      promotion: '',
      optionId: '',
      optionName: '',
      classId: '',
      className: '',
      description: '',
      amount: 85000,
      frequency: 'monthly',
    });
    setIsModalOpen(true);
  };

  const handleSaveFee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || formData.amount <= 0) return;

    setSaving(true);
    try {
      const selectedClass = classes.find(c => c.id === formData.classId);
      const selectedOption = options.find(o => o.id === formData.optionId);

      await SchoolService.saveFeeType(
        schoolId,
        {
          ...formData,
          className: selectedClass ? selectedClass.name : '',
          optionName: selectedOption ? selectedOption.name : '',
        },
        currentUser?.uid || 'admin',
        currentUser?.email || profile?.email || 'admin@ecole.cd'
      );
      await onRefreshData();
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('Erreur lors de la sauvegarde du frais');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDeleteFee = async () => {
    if (!feeToDelete) return;
    setDeleting(true);
    try {
      await SchoolService.deleteFeeType(
        schoolId,
        feeToDelete.id,
        currentUser?.uid || 'admin',
        currentUser?.email || profile?.email || 'admin@ecole.cd'
      );
      await onRefreshData();
      setFeeToDelete(null);
      if (formData.id === feeToDelete.id) {
        setIsModalOpen(false);
      }
    } catch (err) {
      console.error(err);
      alert('Erreur lors de la suppression du type de frais');
    } finally {
      setDeleting(false);
    }
  };

  // Filter list of fee types
  const filteredFeeTypes = feeTypes.filter(fee => {
    const matchesSearch =
      fee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (fee.description && fee.description.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory = filterCategory === 'all' || fee.category === filterCategory;
    const matchesSection = filterSection === 'all' || fee.section === filterSection;
    const matchesPromotion = filterPromotion === 'all' || fee.promotion === filterPromotion;
    const matchesOption = filterOption === 'all' || fee.optionId === filterOption;
    const matchesClass = filterClass === 'all' || fee.classId === filterClass;

    return matchesSearch && matchesCategory && matchesSection && matchesPromotion && matchesOption && matchesClass;
  });

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Catalogue & Grille des Frais Scolaires
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Paramétrage des frais par type, section, promotion, option (secondaire) et classe
          </p>
        </div>

        {['admin', 'director'].includes(role) && (
          <button
            onClick={handleOpenNewModal}
            className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nouveau Type de Frais
          </button>
        )}
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Rechercher un frais..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:bg-white focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Filter by Category */}
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none font-medium"
            >
              <option value="all">Tous les types de frais</option>
              {STANDARD_FEE_CATEGORIES.map(cat => (
                <option key={`fcat_${cat}`} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            {/* Filter by Section */}
            <select
              value={filterSection}
              onChange={e => setFilterSection(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none font-medium"
            >
              <option value="all">Toutes les sections</option>
              <option value="Maternelle">Maternelle</option>
              <option value="Primaire">Primaire</option>
              <option value="Éducation de Base">Éducation de Base</option>
              <option value="Secondaire">Secondaire</option>
            </select>

            {/* Filter by Option */}
            <select
              value={filterOption}
              onChange={e => setFilterOption(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none font-medium"
            >
              <option value="all">Toutes les options</option>
              {options.map(o => (
                <option key={`fopt_${o.id}`} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>

            {/* Filter by Class */}
            <select
              value={filterClass}
              onChange={e => setFilterClass(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none font-medium"
            >
              <option value="all">Toutes les classes</option>
              {classes.map(c => (
                <option key={`fcls_${c.id}`} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            {(filterCategory !== 'all' || filterSection !== 'all' || filterOption !== 'all' || filterClass !== 'all' || searchTerm) && (
              <button
                onClick={() => {
                  setFilterCategory('all');
                  setFilterSection('all');
                  setFilterPromotion('all');
                  setFilterOption('all');
                  setFilterClass('all');
                  setSearchTerm('');
                }}
                className="text-xs text-rose-600 hover:text-rose-800 font-medium px-2 py-1"
              >
                Réinitialiser
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Grid of Fees */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredFeeTypes.length === 0 ? (
          <div className="col-span-full bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500">
            <Layers className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700">Aucun frais ne correspond aux filtres sélectionnés</p>
            <p className="text-xs text-slate-400 mt-1">Modifiez vos critères ou créez un nouveau type de frais.</p>
          </div>
        ) : (
          filteredFeeTypes.map(fee => {
            const targetClass = classes.find(c => c.id === fee.classId);
            const targetOption = options.find(o => o.id === fee.optionId);

            return (
              <div
                key={fee.id}
                className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      {/* Type / Category Badge */}
                      <span
                        className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border mb-1.5 ${getCategoryBadgeClass(
                          fee.category
                        )}`}
                      >
                        {fee.category || 'Minerval'}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 leading-snug">{fee.name}</h3>
                      <span className="text-[11px] font-medium text-slate-500">
                        Périodicité : {getFrequencyLabel(fee.frequency)}
                      </span>
                    </div>

                    <span className="text-base font-extrabold text-slate-900 shrink-0">
                      {formatCurrency(fee.amount, currency)}
                    </span>
                  </div>

                  {fee.description && (
                    <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                      {fee.description}
                    </p>
                  )}

                  {/* Attributes Badges: Section, Promotion, Option, Classe */}
                  <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-1.5 text-[11px]">
                    {fee.section ? (
                      <span className="bg-indigo-50 text-indigo-800 font-semibold px-2 py-0.5 rounded border border-indigo-200/60">
                        Section : {fee.section}
                      </span>
                    ) : (
                      <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                        Toutes sections
                      </span>
                    )}

                    {fee.promotion && (
                      <span className="bg-amber-50 text-amber-800 font-semibold px-2 py-0.5 rounded border border-amber-200/60">
                        Promo : {fee.promotion}
                      </span>
                    )}

                    {(fee.optionName || targetOption) && (
                      <span className="bg-purple-50 text-purple-800 font-semibold px-2 py-0.5 rounded border border-purple-200/60">
                        Option : {fee.optionName || targetOption?.name}
                      </span>
                    )}

                    {targetClass ? (
                      <span className="bg-emerald-50 text-emerald-800 font-semibold px-2 py-0.5 rounded border border-emerald-200/60">
                        Classe : {targetClass.name}
                      </span>
                    ) : (
                      <span className="bg-slate-50 text-slate-600 px-2 py-0.5 rounded border border-slate-200/60">
                        Toutes les classes
                      </span>
                    )}
                  </div>
                </div>

                {['admin', 'director'].includes(role) && (
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-400">
                      {fee.active ? 'Actif dans le catalogue' : 'Inactif'}
                    </span>
                    <button
                      onClick={() => {
                        setFormData({
                          id: fee.id,
                          name: fee.name,
                          category: fee.category || 'Minerval',
                          section: fee.section || '',
                          promotion: fee.promotion || '',
                          optionId: fee.optionId || '',
                          optionName: fee.optionName || '',
                          classId: fee.classId || '',
                          className: fee.className || '',
                          description: fee.description || '',
                          amount: fee.amount,
                          frequency: fee.frequency,
                        });
                        setIsModalOpen(true);
                      }}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Modifier
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Create / Edit Fee Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-base font-semibold">
                  {formData.id ? 'Modifier le Type de Frais' : 'Nouveau Frais au Catalogue'}
                </h3>
                <p className="text-xs text-slate-400">
                  Paramétrage par type, section, promotion, option et classe
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveFee} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              {/* Type / Catégorie du frais */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                  Type de Frais Scolaire *
                </label>
                <select
                  required
                  value={formData.category}
                  onChange={e => {
                    const cat = e.target.value as FeeCategory;
                    setFormData(prev => ({
                      ...prev,
                      category: cat,
                      name: prev.name || cat,
                      frequency: cat === "Frais d'Inscription & Réinscription" || cat === "Frais d'Examen d'État & Jury" ? 'once' : prev.frequency,
                    }));
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-600"
                >
                  {STANDARD_FEE_CATEGORIES.map(cat => (
                    <option key={`mcat_${cat}`} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Intitulé du Frais */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Intitulé du Frais *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Minerval Mensuel / Frais de Laboratoire Chimie"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              {/* Section & Promotion */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Section
                  </label>
                  <select
                    value={formData.section}
                    onChange={e => {
                      const newSec = e.target.value;
                      setFormData(prev => ({
                        ...prev,
                        section: newSec,
                        // reset option if not secondary
                        optionId: newSec === 'Secondaire' ? prev.optionId : '',
                        classId: '',
                      }));
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-600"
                  >
                    <option value="">Toutes les sections</option>
                    <option value="Maternelle">Maternelle</option>
                    <option value="Primaire">Primaire</option>
                    <option value="Éducation de Base">Éducation de Base</option>
                    <option value="Secondaire">Secondaire</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Promotion / Niveau
                  </label>
                  <select
                    value={formData.promotion}
                    onChange={e => setFormData({ ...formData, promotion: e.target.value, classId: '' })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-600"
                  >
                    <option value="">Toutes les promotions</option>
                    {PROMOTIONS_LIST.map(p => (
                      <option key={`prm_${p}`} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Option (Secondaire) & Classe */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Option (Secondaire)
                  </label>
                  <select
                    value={formData.optionId}
                    disabled={formData.section !== '' && formData.section !== 'Secondaire'}
                    onChange={e => {
                      const opt = options.find(o => o.id === e.target.value);
                      setFormData(prev => ({
                        ...prev,
                        optionId: e.target.value,
                        optionName: opt ? opt.name : '',
                        classId: '',
                      }));
                    }}
                    className={`w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-600 ${
                      formData.section !== '' && formData.section !== 'Secondaire' ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''
                    }`}
                  >
                    <option value="">Toutes les options</option>
                    {options.map(o => (
                      <option key={`mod_opt_${o.id}`} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Classe Cible Spécifique
                  </label>
                  <select
                    value={formData.classId}
                    onChange={e => {
                      const cls = classes.find(c => c.id === e.target.value);
                      setFormData(prev => ({
                        ...prev,
                        classId: e.target.value,
                        className: cls ? cls.name : '',
                      }));
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-600"
                  >
                    <option value="">Toutes les classes</option>
                    {availableClassesInModal.map(c => (
                      <option key={`mcls_${c.id}`} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Montant & Périodicité */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Montant ({currency}) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    value={formData.amount}
                    onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Périodicité *
                  </label>
                  <select
                    value={formData.frequency}
                    onChange={e => setFormData({ ...formData, frequency: e.target.value as FeeFrequency })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-600"
                  >
                    <option value="monthly">Mensuel</option>
                    <option value="termly">Trimestriel</option>
                    <option value="annual">Annuel</option>
                    <option value="once">Unique</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Description / Justification
                </label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Précisions sur les modalités de ce frais pour les parents d'élèves..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs outline-none"
                ></textarea>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  {saving ? 'Enregistrement...' : 'Enregistrer le Frais'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
