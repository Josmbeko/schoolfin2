import React, { useState, useRef } from 'react';
import {
  Settings,
  School as SchoolIcon,
  Users,
  Save,
  CheckCircle,
  Shield,
  Calendar,
  Clock,
  Upload,
  Image as ImageIcon,
  Trash2,
  Sparkles,
  Link as LinkIcon,
  RefreshCw,
  DollarSign,
  Coins,
  ArrowRightLeft,
} from 'lucide-react';
import { School, UserProfile, UserRole, Currency } from '../types';
import { SchoolService } from '../services/schoolService';
import { useAuth } from '../context/AuthContext';
import { getRoleLabel } from '../utils/formatters';
import { MONTHS_OF_YEAR } from '../utils/academic';

// Emblèmes scolaires pré-conçus en SVG data URLs pour personnalisation instantanée
const PRESET_SCHOOL_LOGOS = [
  {
    name: 'Blason Royal Or & Saphir',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%231e3a8a"/><path d="M50 15 L78 28 L78 60 C78 75 50 88 50 88 C50 88 22 75 22 60 L22 28 Z" fill="%232563eb" stroke="%23fbbf24" stroke-width="4"/><path d="M36 44 L50 36 L64 44 L50 52 Z" fill="%23fbbf24"/><path d="M50 52 L50 68" stroke="%23fbbf24" stroke-width="3"/><circle cx="50" cy="35" r="4" fill="%23ffffff"/></svg>',
  },
  {
    name: 'Flambeau du Savoir',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%230f172a"/><circle cx="50" cy="50" r="38" fill="%231e293b" stroke="%23f59e0b" stroke-width="3"/><path d="M46 72 L54 72 L52 48 L48 48 Z" fill="%2394a3b8"/><path d="M50 25 C45 32 42 38 46 44 C49 48 55 48 56 42 C58 35 54 28 50 25 Z" fill="%23f97316"/><path d="M50 30 C47 34 46 38 49 42 C51 44 54 43 54 40 Z" fill="%23fde047"/></svg>',
  },
  {
    name: 'Livre Ouvert & Étoile',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%234338ca"/><path d="M20 65 C32 58 45 60 50 66 C55 60 68 58 80 65 L80 40 C68 33 55 35 50 41 C45 35 32 33 20 40 Z" fill="%23ffffff" stroke="%23e0e7ff" stroke-width="2"/><polygon points="50,18 53,26 62,26 55,31 58,40 50,34 42,40 45,31 38,26 47,26" fill="%23fbbf24"/></svg>',
  },
  {
    name: 'Écusson Émeraude Excellence',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%23064e3b"/><path d="M50 16 L76 28 C76 60 50 84 50 84 C50 84 24 60 24 28 Z" fill="%23059669" stroke="%2334d399" stroke-width="3"/><circle cx="50" cy="46" r="14" fill="%23ffffff"/><path d="M42 46 L48 52 L58 40" stroke="%23064e3b" stroke-width="4" fill="none" stroke-linecap="round"/></svg>',
  },
];

interface SettingsPageProps {
  school: School;
  onRefreshData: () => Promise<void>;
  onNavigateToUsers?: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ school, onRefreshData, onNavigateToUsers }) => {
  const { schoolId, currentUser, profile } = useAuth();

  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: school.name || '',
    code: school.code || '',
    logoUrl: school.logoUrl || '',
    address: school.address || '',
    city: school.city || 'Kinshasa',
    province: school.province || 'Kinshasa',
    country: school.country || 'République Démocratique du Congo',
    phone: school.phone || '',
    email: school.email || '',
    currency: school.currency || 'CDF',
    exchangeRateUSD: Number(school.exchangeRateUSD) || 2850,
    schoolYear: school.schoolYear || '2026-2027',
    enrollmentStartMonth: school.enrollmentStartMonth || 'Juillet',
    enrollmentEndMonth: school.enrollmentEndMonth || 'Septembre',
    schoolYearStartMonth: school.schoolYearStartMonth || 'Septembre',
    schoolYearEndMonth: school.schoolYearEndMonth || 'Juillet',
  });

  // États pour le simulateur de conversion en temps réel dans les paramètres
  const [calcUSD, setCalcUSD] = useState<number>(50);
  const [calcCDF, setCalcCDF] = useState<number>(142500);

  // Gestion du chargement de fichier logo avec redimensionnement automatique en canvas
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);

    if (!file.type.startsWith('image/')) {
      setUploadError('Veuillez sélectionner un fichier image valide (PNG, JPG, SVG ou WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Le fichier est trop volumineux (maximum 5 Mo).');
      return;
    }

    const reader = new FileReader();
    reader.onload = event => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 256;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/png', 0.9);
          setForm(prev => ({ ...prev, logoUrl: dataUrl }));
        }
      };
      img.onerror = () => {
        setUploadError('Impossible de charger cette image.');
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMessage(null);
    try {
      await SchoolService.updateSchoolSettings(
        schoolId,
        form,
        currentUser?.uid || 'admin',
        currentUser?.email || profile?.email || 'admin@ecole.cd'
      );
      await onRefreshData();
      setSuccessMessage('Paramètres et identité visuelle de l\'établissement mis à jour avec succès.');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">
          Configuration & Paramètres de l'Établissement
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Identité officielle de l'école, exercice scolaire en cours, devise monétaire et coordonnées
        </p>
      </div>

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      <form onSubmit={handleSaveSettings} className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <h3 className="text-sm font-bold text-slate-900">Identité Institutionnelle</h3>
          <p className="text-xs text-slate-500">Ces informations figurent sur les reçus officiels d'encaissement</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
              Nom Officiel de l'Établissement *
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
              Code Établissement (Abrégé) *
            </label>
            <input
              type="text"
              required
              value={form.code}
              onChange={e => setForm({ ...form, code: e.target.value })}
              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-medium text-slate-900 outline-none focus:ring-2 focus:ring-indigo-600 uppercase"
            />
          </div>
        </div>

        {/* Section Logo de l'École (affiché à côté du titre du logiciel) */}
        <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-indigo-600" />
                Logo & Emblème Officiel de l'Établissement
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Ce logo s'affiche à côté du nom de l'école dans l'en-tête (titre du logiciel), ainsi que sur les reçus officiels et fiches de situation
              </p>
            </div>
            {form.logoUrl && (
              <button
                type="button"
                onClick={() => setForm(prev => ({ ...prev, logoUrl: '' }))}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-1.5 rounded-lg border border-rose-200 transition-colors self-start sm:self-auto cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Supprimer le logo
              </button>
            )}
          </div>

          {/* Live Preview: Titre du Logiciel (Navbar Mock) */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Aperçu en direct dans le titre du logiciel (En-tête Navbar) :
            </div>
            <div className="flex items-center gap-3 bg-slate-900 text-white p-3 rounded-lg">
              {form.logoUrl ? (
                <img
                  src={form.logoUrl}
                  alt="Aperçu logo"
                  className="w-10 h-10 rounded-lg object-contain bg-white border border-slate-200 p-0.5 shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-sm shrink-0">
                  <SchoolIcon className="w-5 h-5" />
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h5 className="font-bold text-sm text-white truncate">
                    {form.name || 'Nom de l\'Établissement'}
                  </h5>
                  <span className="text-[10px] font-semibold text-indigo-300 bg-indigo-950/80 border border-indigo-700/60 px-1.5 py-0.5 rounded">
                    {form.schoolYear || '2026-2027'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate">
                  {[form.city, form.province, form.country].filter(Boolean).join(' – ')}
                </p>
              </div>
            </div>
          </div>

          {/* Upload and URL Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            {/* 1. Charger depuis le disque / appareil */}
            <div className="space-y-2">
              <label className="block text-[11px] font-semibold text-slate-700 uppercase">
                1. Charger une image (Fichier local)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 bg-white border border-dashed border-slate-300 hover:border-indigo-500 rounded-lg text-xs font-semibold text-slate-700 hover:text-indigo-600 hover:bg-indigo-50/30 transition-all cursor-pointer"
              >
                <Upload className="w-4 h-4 text-indigo-600" />
                Parcourir les fichiers (PNG, JPG, SVG, WebP)
              </button>
              {uploadError && (
                <p className="text-[11px] text-rose-600 font-medium">
                  {uploadError}
                </p>
              )}
            </div>

            {/* 2. Renseigner une URL d'image */}
            <div className="space-y-2">
              <label className="block text-[11px] font-semibold text-slate-700 uppercase">
                2. Ou coller l'URL d'une image web
              </label>
              <div className="relative">
                <input
                  type="url"
                  placeholder="https://exemple.cd/images/logo.png"
                  value={form.logoUrl.startsWith('data:') ? '' : form.logoUrl}
                  onChange={e => setForm(prev => ({ ...prev, logoUrl: e.target.value }))}
                  className="w-full pl-8 pr-3.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-600"
                />
                <LinkIcon className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              </div>
            </div>
          </div>

          {/* 3. Galerie de Blasons Scolaires Pré-définis */}
          <div className="pt-2 border-t border-slate-200/70">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-amber-500" />
                Ou choisissez un emblème officiel prédéfini :
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {PRESET_SCHOOL_LOGOS.map((preset, idx) => (
                <button
                  key={`preset_${idx}`}
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, logoUrl: preset.url }))}
                  className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all cursor-pointer ${
                    form.logoUrl === preset.url
                      ? 'bg-indigo-50 border-indigo-600 ring-2 ring-indigo-600/20'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <img
                    src={preset.url}
                    alt={preset.name}
                    className="w-7 h-7 rounded object-contain shrink-0"
                  />
                  <span className="text-[11px] font-semibold text-slate-700 leading-tight truncate">
                    {preset.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
              Année Scolaire Active *
            </label>
            <input
              type="text"
              required
              value={form.schoolYear}
              onChange={e => setForm({ ...form, schoolYear: e.target.value })}
              placeholder="Ex: 2026-2027"
              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-indigo-700 outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
              Devise Monétaire Principale *
            </label>
            <select
              value={form.currency}
              onChange={e => setForm({ ...form, currency: e.target.value as Currency })}
              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-600"
            >
              <option value="CDF">Franc Congolais (CDF)</option>
              <option value="USD">Dollar Américain (USD)</option>
              <option value="XOF">Franc CFA (XOF)</option>
              <option value="EUR">Euro (€)</option>
            </select>
          </div>
        </div>

        {/* Zone Taux de Dollars (USD) et Conversion Directe en Francs (CDF) */}
        <div className="bg-gradient-to-br from-emerald-50/60 via-slate-50 to-indigo-50/40 p-5 rounded-2xl border border-emerald-200/80 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-200/60 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Coins className="w-4 h-4 text-emerald-600" />
                Taux Officiel du Dollar (USD) & Conversion Directe en Francs (CDF)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Définissez le taux de change applicable pour la perception des frais en Dollars (USD) et leur encaissement en Francs (CDF) pour tous les frais confondus.
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100/80 text-emerald-800 border border-emerald-300/80 rounded-full text-xs font-bold font-mono">
              <span>1 USD =</span>
              <span className="text-emerald-950 font-extrabold">{Number(form.exchangeRateUSD || 2850).toLocaleString('fr-FR')} CDF</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Définition du taux */}
            <div className="lg:col-span-5 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  Valeur de 1 Dollar Américain (USD) en Francs (CDF) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={form.exchangeRateUSD || ''}
                    onChange={e => {
                      const val = Math.max(1, parseFloat(e.target.value) || 0);
                      setForm({ ...form, exchangeRateUSD: val });
                      setCalcCDF(Math.round(calcUSD * val));
                    }}
                    placeholder="Ex: 2850"
                    className="w-full pl-3.5 pr-14 py-2.5 bg-white border border-slate-300 rounded-xl text-base font-extrabold font-mono text-emerald-900 outline-none focus:ring-2 focus:ring-emerald-600 shadow-2xs"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    CDF
                  </span>
                </div>
              </div>

              {/* Raccourcis de taux courants du marché */}
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <span className="text-[11px] text-slate-500 font-medium">Taux courants :</span>
                {[2800, 2850, 2900, 2950].map(rate => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => {
                      setForm({ ...form, exchangeRateUSD: rate });
                      setCalcCDF(Math.round(calcUSD * rate));
                    }}
                    className={`text-[11px] font-mono px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
                      form.exchangeRateUSD === rate
                        ? 'bg-emerald-600 text-white border-emerald-600 font-bold shadow-2xs'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {rate.toLocaleString('fr-FR')} CDF
                  </button>
                ))}
              </div>

              <div className="p-2.5 bg-white/80 rounded-xl border border-slate-200/80 text-[11px] text-slate-600 space-y-1">
                <div className="font-semibold text-slate-800">Application immédiate au guichet :</div>
                <p>
                  Ce taux est directement injecté dans le module <strong>Encaisser un Paiement</strong> pour permettre au caissier de saisir le montant perçu en USD et d'obtenir en 1 clic son équivalent en Francs Congolais (CDF).
                </p>
              </div>
            </div>

            {/* Simulateur interactif de conversion en direct */}
            <div className="lg:col-span-7 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <ArrowRightLeft className="w-4 h-4 text-indigo-600" />
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                    Simulateur de Conversion Instantanée (USD ⇄ CDF)
                  </h4>
                </div>
                <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded">
                  Calcul en temps réel
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                {/* Entrée USD */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-600">
                    Montant en Dollars (USD $) :
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">$</span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={calcUSD || ''}
                      onChange={e => {
                        const usd = Math.max(0, parseFloat(e.target.value) || 0);
                        setCalcUSD(usd);
                        setCalcCDF(Math.round(usd * (form.exchangeRateUSD || 2850)));
                      }}
                      className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold font-mono text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-600"
                    />
                  </div>
                </div>

                {/* Résultat CDF */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-600">
                    Équivalent en Francs (CDF) :
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={calcCDF || ''}
                      onChange={e => {
                        const cdf = Math.max(0, parseFloat(e.target.value) || 0);
                        setCalcCDF(cdf);
                        const rate = form.exchangeRateUSD || 2850;
                        setCalcUSD(rate > 0 ? parseFloat((cdf / rate).toFixed(2)) : 0);
                      }}
                      className="w-full px-3 py-2 bg-emerald-50 border border-emerald-300 rounded-lg text-xs font-bold font-mono text-emerald-950 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-emerald-700">CDF</span>
                  </div>
                </div>
              </div>

              {/* Barème de conversion rapide des coupures usuelles */}
              <div className="pt-2 border-t border-slate-100">
                <div className="text-[10px] font-bold text-slate-500 uppercase mb-1.5">
                  Équivalences usuelles des billets au taux configuré ({Number(form.exchangeRateUSD || 2850).toLocaleString('fr-FR')} CDF) :
                </div>
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  {[10, 20, 50, 100].map(bill => (
                    <div
                      key={bill}
                      onClick={() => {
                        setCalcUSD(bill);
                        setCalcCDF(Math.round(bill * (form.exchangeRateUSD || 2850)));
                      }}
                      className="bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 p-1.5 rounded-lg cursor-pointer transition-colors"
                    >
                      <div className="font-extrabold text-indigo-700">${bill}</div>
                      <div className="text-[10px] font-mono text-slate-600">
                        {Math.round(bill * (form.exchangeRateUSD || 2850)).toLocaleString('fr-FR')} CDF
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section Calendrier & Échéances Scolaires */}
        <div className="border-t border-slate-100 pt-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-600" />
                Calendrier & Échéances de l'Année Scolaire
              </h3>
              <p className="text-xs text-slate-500">
                Définissez la période des inscriptions et les bornes temporelles de l'exercice académique
              </p>
            </div>
            <span className="text-[11px] font-semibold bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full border border-indigo-200">
              Exercice {form.schoolYear}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/70 p-4 rounded-xl border border-slate-200">
            {/* 1. Échéance des Inscriptions */}
            <div className="space-y-3 bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <Clock className="w-4 h-4 text-amber-600" />
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Échéance des Inscriptions
                </h4>
              </div>
              <p className="text-[11px] text-slate-500">
                Période officielle durant laquelle les inscriptions et réinscriptions sont ouvertes
              </p>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                    Début (Mois) *
                  </label>
                  <select
                    value={form.enrollmentStartMonth}
                    onChange={e => setForm({ ...form, enrollmentStartMonth: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-600"
                  >
                    {MONTHS_OF_YEAR.map(m => (
                      <option key={`ens_${m}`} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                    Fin (Mois) *
                  </label>
                  <select
                    value={form.enrollmentEndMonth}
                    onChange={e => setForm({ ...form, enrollmentEndMonth: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-600"
                  >
                    {MONTHS_OF_YEAR.map(m => (
                      <option key={`ene_${m}`} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="text-[11px] text-amber-800 bg-amber-50 px-2.5 py-1.5 rounded border border-amber-200/60 font-medium">
                Période : De <strong>{form.enrollmentStartMonth}</strong> à <strong>{form.enrollmentEndMonth}</strong>
              </div>
            </div>

            {/* 2. Année Scolaire (Période des cours) */}
            <div className="space-y-3 bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <Calendar className="w-4 h-4 text-indigo-600" />
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Année Scolaire (Session des cours)
                </h4>
              </div>
              <p className="text-[11px] text-slate-500">
                Période effective des cours et du minerval pour l'exercice en cours
              </p>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                    Début (Mois) *
                  </label>
                  <select
                    value={form.schoolYearStartMonth}
                    onChange={e => setForm({ ...form, schoolYearStartMonth: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-indigo-900 outline-none focus:ring-2 focus:ring-indigo-600"
                  >
                    {MONTHS_OF_YEAR.map(m => (
                      <option key={`sys_${m}`} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                    Fin (Mois) *
                  </label>
                  <select
                    value={form.schoolYearEndMonth}
                    onChange={e => setForm({ ...form, schoolYearEndMonth: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-indigo-900 outline-none focus:ring-2 focus:ring-indigo-600"
                  >
                    {MONTHS_OF_YEAR.map(m => (
                      <option key={`sye_${m}`} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="text-[11px] text-indigo-800 bg-indigo-50 px-2.5 py-1.5 rounded border border-indigo-200/60 font-medium">
                Période : De <strong>{form.schoolYearStartMonth}</strong> à <strong>{form.schoolYearEndMonth}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Section Localisation Géographique */}
        <div className="border-t border-slate-100 pt-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Localisation Géographique de l'Établissement</h3>
            <p className="text-xs text-slate-500">
              Ces informations remplacent la mention de titre par le format : « Ville – Province – Pays »
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                Ville / Commune *
              </label>
              <input
                type="text"
                required
                value={form.city}
                onChange={e => setForm({ ...form, city: e.target.value })}
                placeholder="Ex: Kinshasa, Lubumbashi, Goma"
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                Province *
              </label>
              <input
                type="text"
                required
                value={form.province}
                onChange={e => setForm({ ...form, province: e.target.value })}
                placeholder="Ex: Kinshasa, Haut-Katanga, Nord-Kivu"
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                Pays *
              </label>
              <input
                type="text"
                required
                value={form.country}
                onChange={e => setForm({ ...form, country: e.target.value })}
                placeholder="Ex: République Démocratique du Congo"
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>
          </div>

          {/* Live Preview of Header Display */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold text-slate-500 uppercase">
                Aperçu affiché dans l'en-tête (Navbar)
              </div>
              <div className="text-xs font-bold text-slate-800 mt-0.5">
                {[form.city, form.province, form.country].filter(Boolean).join(' – ') || 'Non défini'}
              </div>
            </div>
            <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60 px-2 py-1 rounded">
              Ville – Province – Pays
            </span>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-5">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Coordonnées de l'École</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                Adresse Physique
              </label>
              <input
                type="text"
                value={form.address}
                onChange={e => setForm({ ...form, address: e.target.value })}
                placeholder="Ex: Avenue de la Justice, Commune de Gombe"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                Téléphone de Contact
              </label>
              <input
                type="text"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="Ex: +243 81 000 0000"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                Email Officiel
              </label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="Ex: direction@ecole.cd"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs outline-none"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100">
          {onNavigateToUsers ? (
            <button
              type="button"
              onClick={onNavigateToUsers}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3.5 py-2 rounded-lg transition-colors cursor-pointer"
            >
              <Users className="w-4 h-4" />
              Gérer les Utilisateurs & Rôles
            </button>
          ) : <div />}

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Enregistrement...' : 'Enregistrer les Modifications'}
          </button>
        </div>
      </form>
    </div>
  );
};
