export type UserRole = 'admin' | 'director' | 'cashier' | 'secretary';

export type Currency = 'CDF' | 'USD' | 'EUR';

export interface School {
  id: string;
  name: string;
  code?: string;
  address: string;
  phone: string;
  email: string;
  currency: Currency;
  exchangeRateUSD?: number; // Taux de change officiel : 1 USD = X CDF (ex: 2850)
  schoolYear: string;
  matriculePrefix: string;
  city: string;
  province?: string;
  country: string;
  enrollmentStartMonth?: string; // Ex: 'Juillet'
  enrollmentEndMonth?: string; // Ex: 'Septembre'
  schoolYearStartMonth?: string; // Ex: 'Septembre'
  schoolYearEndMonth?: string; // Ex: 'Juillet'
  logoUrl?: string;
  status?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  id: string;
  schoolId: string;
  email: string;
  displayName: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
}

export interface SectionItem {
  id: string;
  schoolId: string;
  name: string; // Ex: 'Maternelle', 'Primaire', 'Éducation de Base', 'Secondaire', 'Technique'
  code?: string;
  description?: string;
  order?: number;
  active: boolean;
  createdAt: string;
}

export interface ClassItem {
  id: string;
  schoolId: string;
  name: string;
  section: string; // ex: 'Secondaire', 'Primaire', etc.
  level: string; // ex: '1ère', '2ème', '3ème', '4ème', '7ème', etc.
  optionId?: string;
  optionName?: string;
  monthlyFee: number;
  active: boolean;
  createdAt: string;
}

export interface OptionItem {
  id: string;
  schoolId: string;
  name: string;
  description?: string;
  section: string;
  active: boolean;
  createdAt?: string;
}

export type StudentStatus = 'active' | 'transferred' | 'archived' | 'suspended';

export interface StudentFinancialSituation {
  scope: 'month' | 'year';
  month?: string; // Ex: 'Septembre', 'Octobre', etc. ou vide si 'year'
  situation: 'in_order' | 'exempted' | 'scholarship' | 'extended_deadline' | 'dispute' | 'social_case' | 'standard';
  label: string; // Ex: 'Bourse d'Excellence 100%', 'Exonération Administrative', etc.
  motif: string; // Justification obligatoire de l'Administrateur Général
  discountPercentage?: number; // Ex: 100% ou 50%
  updatedBy: string;
  updatedByName?: string;
  updatedAt: string;
}

export interface Student {
  id: string;
  schoolId: string;
  matricule: string;
  firstName: string;
  lastName: string;
  gender: 'M' | 'F';
  dateOfBirth?: string;
  placeOfBirth?: string;
  section?: string; // Maternelle, Primaire, Éducation de Base, Secondaire
  classId: string;
  className?: string;
  optionId?: string;
  optionName?: string;
  parentName: string;
  parentPhone: string;
  parentEmail?: string;
  address?: string;
  enrollmentDate: string;
  status: StudentStatus;
  financialSituation?: StudentFinancialSituation;
  photoUrl?: string;
  creditAdvance: number; // Solde créditeur / avance utilisable
  createdAt: string;
}

export type FeeFrequency = 'once' | 'monthly' | 'termly' | 'annual';

export type FeeCategory =
  | 'Minerval'
  | "Frais de l'Etat"
  | "Frais d'Examen d'État & Jury"
  | "Frais d'Inscription & Réinscription"
  | 'Frais Travaux Pratiques & Laboratoire'
  | 'Autre';

export interface FeeType {
  id: string;
  schoolId: string;
  name: string;
  category?: FeeCategory;
  section?: string; // Maternelle, Primaire, Éducation de Base, Secondaire
  promotion?: string; // 1ère, 2ème, 3ème, etc.
  optionId?: string; // Pour les options du secondaire
  optionName?: string;
  classId?: string; // Classe spécifique ou toutes
  className?: string;
  description?: string;
  amount: number;
  frequency: FeeFrequency;
  active: boolean;
  createdAt: string;
}

export type ChargeStatus = 'pending' | 'partial' | 'paid' | 'overdue' | 'cancelled';

export interface StudentCharge {
  id: string;
  schoolId: string;
  studentId: string;
  studentName?: string;
  matricule?: string;
  classId?: string;
  feeTypeId: string;
  feeTypeName?: string;
  category?: FeeCategory;
  applicableMonth?: string; // Ex: 'Septembre', 'Octobre', etc.
  schoolYear: string;
  label: string;
  dueDate: string;
  amountDue: number;
  discountAmount: number;
  netAmount: number; // amountDue - discountAmount
  paidAmount: number;
  status: ChargeStatus;
  createdAt: string;
}

export type PaymentMethod = 'cash' | 'mobile_money' | 'bank_transfer' | 'check' | 'card' | 'advance' | 'other';
export type PaymentStatus = 'posted' | 'voided' | 'refunded';

export interface PaymentAllocation {
  id: string;
  schoolId: string;
  paymentId: string;
  studentChargeId: string;
  feeLabel?: string;
  studentId: string;
  amount: number;
  createdAt: string;
}

export interface Payment {
  id: string;
  schoolId: string;
  studentId: string;
  studentName?: string;
  matricule?: string;
  classId?: string;
  className?: string;
  amount: number;
  directAmountPaid?: number; // Montant reçu en espèces/banque lors de l'opération
  advanceDeducted?: number; // Montant prélevé sur l'avance préalable de l'élève
  paymentDate: string;
  targetMonth?: string; // Le mois concerné par le versement
  paymentMethod: PaymentMethod;
  receiptNumber: string;
  note?: string;
  createdBy: string;
  createdByName: string;
  status: PaymentStatus;
  voidReason?: string;
  voidedBy?: string;
  voidedAt?: string;
  refundAmount?: number;
  refundReason?: string;
  refundedBy?: string;
  refundedAt?: string;
  idempotencyKey?: string;
  allocations?: PaymentAllocation[];
  createdAt: string;
}

export interface Receipt {
  id: string;
  schoolId: string;
  receiptNumber: string;
  paymentId: string;
  studentId: string;
  studentName: string;
  matricule: string;
  className: string;
  amount: number;
  amountInWords: string;
  currency: string;
  targetMonth?: string;
  paymentMethod: string;
  cashierName: string;
  note?: string;
  allocationsSummary?: { label: string; amount: number }[];
  issuedAt: string;
}

export type CashOperationType = 'opening' | 'inflow' | 'outflow' | 'closing';

export interface CashOperation {
  id: string;
  schoolId: string;
  date: string;
  type: CashOperationType;
  amount: number;
  paymentMethod?: string;
  referenceId?: string;
  performedBy: string;
  performedByName: string;
  balanceAfter: number;
  physicalCash?: number;
  cashDifference?: number;
  notes?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  schoolId: string;
  userId: string;
  userEmail: string;
  action: string;
  entity?: string;
  entityType?: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown> | string;
  timestamp?: string;
  createdAt: string;
}

export interface StudentFinancialSummary {
  student: Student;
  totalBilled: number;
  totalDiscounts: number;
  totalNet: number;
  totalPaid: number;
  totalRemaining: number;
  creditAdvance: number;
  charges: StudentCharge[];
  payments: Payment[];
}
