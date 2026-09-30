/**
 * Règles académiques du système éducatif (spécifique RDC / Humanités & Secondaire)
 * Règle : Les choix des options commencent STRICTEMENT à partir de :
 * 1ère, 2è, 3è et 4è section Secondaire.
 */

export const SECONDARY_OPTION_LEVELS = [
  '1ère',
  '1ere',
  '1ère Secondaire',
  '1er',
  '1',
  '2è',
  '2ème',
  '2eme',
  '2è Secondaire',
  '2',
  '3è',
  '3ème',
  '3eme',
  '3è Secondaire',
  '3',
  '4è',
  '4ème',
  '4eme',
  '4è Secondaire',
  '4',
];

export const NON_OPTION_LEVELS = [
  'Crèche',
  'Petite Section',
  'Moyenne Section',
  'Grande Section',
  '1ère Primaire',
  '2ème Primaire',
  '3ème Primaire',
  '4ème Primaire',
  '5ème Primaire',
  '6ème Primaire',
  '7ème de Base',
  '8ème de Base',
  '7ème',
  '8ème',
];

/**
 * Vérifie si une section est de niveau secondaire / humanités
 */
export function isSecondarySection(sectionName?: string): boolean {
  if (!sectionName) return false;
  const s = sectionName.trim().toLowerCase();
  return (
    s.includes('secondaire') ||
    s.includes('humanit') ||
    s.includes('technique') ||
    s.includes('professionnel')
  );
}

/**
 * Vérifie si le niveau fait partie de 1ère, 2è, 3è ou 4è
 */
export function isSecondaryOptionLevel(level?: string): boolean {
  if (!level) return false;
  const clean = level.trim().toLowerCase();
  
  // Exclure explicitement le primaire et l'éducation de base (7è, 8è)
  if (
    clean.includes('primaire') ||
    clean.includes('base') ||
    clean.includes('7') ||
    clean.includes('8') ||
    clean.includes('maternelle') ||
    clean.includes('crèche')
  ) {
    return false;
  }

  return (
    clean.startsWith('1') ||
    clean.startsWith('2') ||
    clean.startsWith('3') ||
    clean.startsWith('4') ||
    clean.includes('1ère') ||
    clean.includes('2è') ||
    clean.includes('3è') ||
    clean.includes('4è')
  );
}

/**
 * Détermine si une classe ou un niveau permet le choix d'une option.
 * Condition stricte : Doit être en section Secondaire ET au niveau 1ère, 2è, 3è ou 4è.
 */
export function canSelectOption(section?: string, level?: string, className?: string): boolean {
  // Si le nom de la classe contient 7ème ou 8ème, primaire ou maternelle -> NON
  const fullText = `${section || ''} ${level || ''} ${className || ''}`.toLowerCase();
  if (
    fullText.includes('7è') ||
    fullText.includes('7ème') ||
    fullText.includes('8è') ||
    fullText.includes('8ème') ||
    fullText.includes('primaire') ||
    fullText.includes('maternelle') ||
    fullText.includes('base')
  ) {
    return false;
  }

  // Si la section est secondaire/humanités/technique
  const isSec = isSecondarySection(section) || fullText.includes('secondaire') || fullText.includes('humanit');
  if (!isSec) return false;

  // Doit être 1ère, 2è, 3è ou 4è
  return isSecondaryOptionLevel(level) || isSecondaryOptionLevel(className);
}

export const DEFAULT_ACADEMIC_SECTIONS = [
  {
    name: 'Maternelle',
    code: 'MAT',
    description: 'Cycle préscolaire (Petite, Moyenne et Grande sections)',
    order: 1,
  },
  {
    name: 'Primaire',
    code: 'PRIM',
    description: 'Enseignement primaire fondamental (1ère à 6ème année primaire)',
    order: 2,
  },
  {
    name: 'Éducation de Base',
    code: 'EDB',
    description: 'Cycle terminal de l\'éducation de base (7ème et 8ème années - Tronc commun)',
    order: 3,
  },
  {
    name: 'Secondaire',
    code: 'SEC',
    description: 'Humanités Générales & Techniques (1ère, 2è, 3è et 4è - Choix des options/filières)',
    order: 4,
  },
  {
    name: 'Technique & Professionnelle',
    code: 'TECH',
    description: 'Sections techniques, commerciales et professionnelles (avec options)',
    order: 5,
  },
];

// Mois de l'année civile
export const MONTHS_OF_YEAR = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
] as const;

// Ordre chronologique de l'année scolaire standard en RDC (de Septembre à Juillet)
export const ACADEMIC_YEAR_MONTHS = [
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
] as const;

// Promotions usuelles
export const PROMOTIONS_LIST = [
  'Petite Section',
  'Moyenne Section',
  'Grande Section',
  '1ère Année',
  '2ème Année',
  '3ème Année',
  '4ème Année',
  '5ème Année',
  '6ème Année',
  '7ème Année (7è EB)',
  '8ème Année (8è EB)',
  '1ère Secondaire',
  '2ème Secondaire',
  '3ème Secondaire',
  '4ème Secondaire (Terminale)',
];

// Catégories officielles de frais demandées
export const STANDARD_FEE_CATEGORIES = [
  'Minerval',
  "Frais de l'Etat",
  "Frais d'Examen d'État & Jury",
  "Frais d'Inscription & Réinscription",
  'Frais Travaux Pratiques & Laboratoire',
  'Autre',
] as const;

/**
 * Détecte si un frais correspond aux Frais d'Inscription
 */
export function isRegistrationFee(fee: { label?: string; feeTypeName?: string; category?: string; name?: string }): boolean {
  if (fee.category === "Frais d'Inscription & Réinscription") return true;
  const str = `${fee.label || ''} ${fee.feeTypeName || ''} ${fee.name || ''} ${fee.category || ''}`.toLowerCase();
  return str.includes('inscription') || str.includes('réinscription') || str.includes('reinscription');
}

/**
 * Extrait le nom du mois à partir du libellé d'un frais ou de sa date
 */
export function extractMonthFromCharge(charge: { label?: string; dueDate?: string; applicableMonth?: string }): string | null {
  if (charge.applicableMonth && charge.applicableMonth.trim()) {
    return charge.applicableMonth.trim();
  }

  const label = (charge.label || '').toLowerCase();
  for (const m of ACADEMIC_YEAR_MONTHS) {
    if (label.includes(m.toLowerCase())) {
      return m;
    }
  }

  // Si non trouvé par libellé, tente d'extraire depuis dueDate (YYYY-MM-DD)
  if (charge.dueDate) {
    const parts = charge.dueDate.split('-');
    if (parts.length >= 2) {
      const monthIdx = parseInt(parts[1], 10) - 1;
      if (monthIdx >= 0 && monthIdx < MONTHS_OF_YEAR.length) {
        return MONTHS_OF_YEAR[monthIdx];
      }
    }
  }

  return null;
}

/**
 * Obtient l'index chronologique académique d'un mois (0 pour Septembre, 1 pour Octobre, etc.)
 */
export function getAcademicMonthIndex(monthName?: string | null): number {
  if (!monthName) return -1;
  const clean = monthName.trim().toLowerCase();
  return ACADEMIC_YEAR_MONTHS.findIndex(m => m.toLowerCase() === clean);
}

/**
 * Valide les restrictions de paiement :
 * 1. Commencer par les frais d'inscription (doivent être 100% payés).
 * 2. Restriction de payer le mois prochain sans avoir complètement fini le mois précédent.
 */
export function checkChargePaymentEligibility(
  targetChargeId: string,
  allCharges: {
    id: string;
    label: string;
    feeTypeName?: string;
    category?: string;
    applicableMonth?: string;
    dueDate?: string;
    netAmount: number;
    paidAmount: number;
    status: string;
  }[]
): { eligible: boolean; lockReason?: string } {
  const target = allCharges.find(c => c.id === targetChargeId);
  if (!target) return { eligible: true };

  const isTargetRegistration = isRegistrationFee(target);

  // 1. RÈGLE 1 : Si ce n'est PAS un frais d'inscription, vérifier s'il existe des frais d'inscription impayés
  if (!isTargetRegistration) {
    const unpaidRegistration = allCharges.find(
      c => isRegistrationFee(c) && c.paidAmount < c.netAmount && c.status !== 'cancelled'
    );
    if (unpaidRegistration) {
      const rest = Math.max(0, unpaidRegistration.netAmount - unpaidRegistration.paidAmount);
      return {
        eligible: false,
        lockReason: `Priorité réglementaire : Les frais d'inscription ("${unpaidRegistration.label}", reste ${rest.toLocaleString('fr-FR')}) doivent être intégralement soldés avant tout autre paiement.`,
      };
    }
  }

  // 2. RÈGLE 2 : Restriction séquentielle des mois (Minerval / Frais mensuels)
  const targetMonth = extractMonthFromCharge(target);
  const targetMonthIndex = getAcademicMonthIndex(targetMonth);

  if (targetMonthIndex > 0) {
    // Il s'agit d'un mois postérieur au 1er mois (ex: Octobre index 1, Novembre index 2...)
    // Trouver toutes les charges mensuelles antérieures pour cet élève
    const priorMonthlyCharges = allCharges.filter(c => {
      if (c.id === target.id) return false;
      if (c.status === 'cancelled') return false;
      const m = extractMonthFromCharge(c);
      const idx = getAcademicMonthIndex(m);
      return idx >= 0 && idx < targetMonthIndex;
    });

    // Trier par ordre chronologique
    priorMonthlyCharges.sort((a, b) => {
      const idxA = getAcademicMonthIndex(extractMonthFromCharge(a));
      const idxB = getAcademicMonthIndex(extractMonthFromCharge(b));
      return idxA - idxB;
    });

    for (const prior of priorMonthlyCharges) {
      if (prior.paidAmount < prior.netAmount) {
        const priorMonth = extractMonthFromCharge(prior) || prior.label;
        const rest = Math.max(0, prior.netAmount - prior.paidAmount);
        return {
          eligible: false,
          lockReason: `Restriction mensuelle : Impossible de régler ${targetMonth} tant que le mois précédent (${priorMonth}) n'est pas intégralement soldé (Reste à payer : ${rest.toLocaleString('fr-FR')}).`,
        };
      }
    }
  }

  return { eligible: true };
}
