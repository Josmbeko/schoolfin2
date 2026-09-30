import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  runTransaction,
} from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../firebase/config';
import {
  School,
  UserProfile,
  UserRole,
  SectionItem,
  ClassItem,
  OptionItem,
  Student,
  FeeType,
  StudentCharge,
  Payment,
  PaymentAllocation,
  Receipt,
  CashOperation,
  AuditLog,
  PaymentMethod,
  StudentFinancialSituation,
} from '../types';
import { numberToWords } from '../utils/numberToWords';
import { DEFAULT_ACADEMIC_SECTIONS, extractMonthFromCharge, ACADEMIC_YEAR_MONTHS } from '../utils/academic';

export class SchoolService {
  // ------------------- SCHOOL SETTINGS -------------------
  static async getSchool(schoolId: string): Promise<School> {
    const p = `schools/${schoolId}`;
    try {
      const snap = await getDoc(doc(db, 'schools', schoolId));
      if (snap.exists()) {
        return snap.data() as School;
      }
      // Default initial school
      const defaultSchool: School = {
        id: schoolId,
        name: 'Collège Boboto',
        address: 'Avenue de la Justice, Commune de Gombe',
        city: 'Kinshasa',
        province: 'Kinshasa',
        country: 'République Démocratique du Congo',
        phone: '+243 81 500 2000',
        email: 'direction@college-boboto.cd',
        currency: 'CDF',
        schoolYear: '2026-2027',
        matriculePrefix: '2026',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'schools', schoolId), defaultSchool);
      return defaultSchool;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, p);
    }
  }

  static async updateSchoolSettings(
    schoolId: string,
    updates: Partial<School>,
    userId: string,
    userEmail: string
  ): Promise<void> {
    return this.updateSchool(schoolId, updates, userId, userEmail);
  }

  static async fetchAllSchoolData(schoolId: string) {
    const [
      school,
      sections,
      classes,
      options,
      feeTypes,
      students,
      charges,
      payments,
      cashOperations,
      auditLogs,
      users,
    ] = await Promise.all([
      this.getSchool(schoolId),
      this.getSections(schoolId),
      this.getClasses(schoolId),
      this.getOptions(schoolId),
      this.getFeeTypes(schoolId),
      this.getStudents(schoolId),
      this.getCharges(schoolId),
      this.getPayments(schoolId),
      this.getCashOperations(schoolId),
      this.getAuditLogs(schoolId),
      this.getUsers(schoolId),
    ]);

    return {
      school,
      sections,
      classes,
      options,
      feeTypes,
      students,
      charges,
      payments,
      cashOperations,
      auditLogs,
      users,
    };
  }

  static async updateSchool(schoolId: string, updates: Partial<School>, userId: string, userEmail: string): Promise<void> {
    const p = `schools/${schoolId}`;
    try {
      await updateDoc(doc(db, 'schools', schoolId), {
        ...updates,
        updatedAt: new Date().toISOString(),
      });
      await this.logAudit(schoolId, userId, userEmail, 'SETTINGS_UPDATED', 'School', schoolId, updates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, p);
    }
  }

  // ------------------- SECTIONS PÉDAGOGIQUES -------------------
  static async getSections(schoolId: string): Promise<SectionItem[]> {
    const p = `schools/${schoolId}/sections`;
    try {
      const q = query(collection(db, 'schools', schoolId, 'sections'), orderBy('order', 'asc'));
      const snap = await getDocs(q);
      if (!snap.empty) {
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as SectionItem));
      }

      // If empty, initialize default sections
      const defaultList: SectionItem[] = DEFAULT_ACADEMIC_SECTIONS.map((sec, idx) => ({
        id: `sec_${sec.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now() + idx}`,
        schoolId,
        name: sec.name,
        code: sec.code,
        description: sec.description,
        order: sec.order,
        active: true,
        createdAt: new Date().toISOString(),
      }));

      // Store in firestore in background
      for (const item of defaultList) {
        await setDoc(doc(db, 'schools', schoolId, 'sections', item.id), item);
      }
      return defaultList;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, p);
    }
  }

  static async saveSection(
    schoolId: string,
    sectionData: Partial<SectionItem>,
    userId: string,
    userEmail: string
  ): Promise<SectionItem> {
    const p = `schools/${schoolId}/sections`;
    try {
      const id = sectionData.id || `sec_${Date.now()}`;
      const item: SectionItem = {
        id,
        schoolId,
        name: sectionData.name || '',
        code: sectionData.code || '',
        description: sectionData.description || '',
        order: Number(sectionData.order) || 1,
        active: sectionData.active ?? true,
        createdAt: sectionData.createdAt || new Date().toISOString(),
      };
      await setDoc(doc(db, 'schools', schoolId, 'sections', id), item);
      await this.logAudit(
        schoolId,
        userId,
        userEmail,
        sectionData.id ? 'SECTION_UPDATED' : 'SECTION_CREATED',
        'Section',
        id,
        { name: item.name, code: item.code }
      );
      return item;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, p);
    }
  }

  static async deleteSection(
    schoolId: string,
    sectionId: string,
    userId: string,
    userEmail: string
  ): Promise<void> {
    const p = `schools/${schoolId}/sections/${sectionId}`;
    try {
      await deleteDoc(doc(db, 'schools', schoolId, 'sections', sectionId));
      await this.logAudit(schoolId, userId, userEmail, 'SECTION_DELETED', 'Section', sectionId, {
        deletedAt: new Date().toISOString(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, p);
    }
  }

  // ------------------- CLASSES & OPTIONS -------------------
  static async getClasses(schoolId: string): Promise<ClassItem[]> {
    const p = `schools/${schoolId}/classes`;
    try {
      const q = query(collection(db, 'schools', schoolId, 'classes'), orderBy('name', 'asc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as ClassItem));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, p);
    }
  }

  static async saveClass(schoolId: string, classData: Partial<ClassItem>, userId: string, userEmail: string): Promise<ClassItem> {
    const p = `schools/${schoolId}/classes`;
    try {
      const id = classData.id || `cls_${Date.now()}`;
      const item: ClassItem = {
        id,
        schoolId,
        name: classData.name || '',
        section: classData.section || 'Secondaire',
        level: classData.level || '1ère',
        optionId: classData.optionId || '',
        optionName: classData.optionName || '',
        monthlyFee: Number(classData.monthlyFee) || 0,
        active: classData.active ?? true,
        createdAt: classData.createdAt || new Date().toISOString(),
      };
      await setDoc(doc(db, 'schools', schoolId, 'classes', id), item);
      await this.logAudit(schoolId, userId, userEmail, classData.id ? 'CLASS_UPDATED' : 'CLASS_CREATED', 'Class', id, { name: item.name });
      return item;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, p);
    }
  }

  static async deleteClass(schoolId: string, classId: string, userId: string, userEmail: string): Promise<void> {
    const p = `schools/${schoolId}/classes/${classId}`;
    try {
      await deleteDoc(doc(db, 'schools', schoolId, 'classes', classId));
      await this.logAudit(schoolId, userId, userEmail, 'CLASS_DELETED', 'Class', classId, {
        deletedAt: new Date().toISOString(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, p);
    }
  }

  static async getOptions(schoolId: string): Promise<OptionItem[]> {
    const p = `schools/${schoolId}/options`;
    try {
      const q = query(collection(db, 'schools', schoolId, 'options'), orderBy('name', 'asc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as OptionItem));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, p);
    }
  }

  static async saveOption(
    schoolId: string,
    optionData: Partial<OptionItem>,
    userId: string = 'admin',
    userEmail: string = 'admin@ecole.cd'
  ): Promise<OptionItem> {
    const p = `schools/${schoolId}/options`;
    try {
      const id = optionData.id || `opt_${Date.now()}`;
      const item: OptionItem = {
        id,
        schoolId,
        name: optionData.name || '',
        description: optionData.description || '',
        section: optionData.section || 'Secondaire',
        active: optionData.active ?? true,
        createdAt: optionData.createdAt || new Date().toISOString(),
      };
      await setDoc(doc(db, 'schools', schoolId, 'options', id), item);
      await this.logAudit(
        schoolId,
        userId,
        userEmail,
        optionData.id ? 'OPTION_UPDATED' : 'OPTION_CREATED',
        'Option',
        id,
        { name: item.name }
      );
      return item;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, p);
    }
  }

  static async deleteOption(schoolId: string, optionId: string, userId: string, userEmail: string): Promise<void> {
    const p = `schools/${schoolId}/options/${optionId}`;
    try {
      await deleteDoc(doc(db, 'schools', schoolId, 'options', optionId));
      await this.logAudit(schoolId, userId, userEmail, 'OPTION_DELETED', 'Option', optionId, {
        deletedAt: new Date().toISOString(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, p);
    }
  }

  // ------------------- STUDENTS -------------------
  static async getStudents(schoolId: string): Promise<Student[]> {
    const p = `schools/${schoolId}/students`;
    try {
      const q = query(collection(db, 'schools', schoolId, 'students'), orderBy('lastName', 'asc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Student));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, p);
    }
  }

  static async getStudentById(schoolId: string, studentId: string): Promise<Student | null> {
    const p = `schools/${schoolId}/students/${studentId}`;
    try {
      const snap = await getDoc(doc(db, 'schools', schoolId, 'students', studentId));
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as Student;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, p);
    }
  }

  static async generateMatricule(schoolId: string, prefix = '2026'): Promise<string> {
    const p = `schools/${schoolId}/students`;
    try {
      const snap = await getDocs(collection(db, 'schools', schoolId, 'students'));
      const count = snap.size + 1;
      return `${prefix}-${String(count).padStart(5, '0')}`;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, p);
    }
  }

  static async saveStudent(schoolId: string, studentData: Partial<Student>, userId: string, userEmail: string): Promise<Student> {
    const p = `schools/${schoolId}/students`;
    try {
      const isNew = !studentData.id;
      const id = studentData.id || `stu_${Date.now()}`;
      const matricule = studentData.matricule || (await this.generateMatricule(schoolId));
      
      const item: Student = {
        id,
        schoolId,
        matricule,
        firstName: studentData.firstName || '',
        lastName: studentData.lastName || '',
        gender: studentData.gender || 'M',
        dateOfBirth: studentData.dateOfBirth || '',
        placeOfBirth: studentData.placeOfBirth || '',
        section: studentData.section || '',
        classId: studentData.classId || '',
        className: studentData.className || '',
        optionId: studentData.optionId || '',
        optionName: studentData.optionName || '',
        parentName: studentData.parentName || '',
        parentPhone: studentData.parentPhone || '',
        parentEmail: studentData.parentEmail || '',
        address: studentData.address || '',
        enrollmentDate: studentData.enrollmentDate || new Date().toISOString().split('T')[0],
        status: studentData.status || 'active',
        financialSituation: studentData.financialSituation,
        photoUrl: studentData.photoUrl || '',
        creditAdvance: Number(studentData.creditAdvance) || 0,
        createdAt: studentData.createdAt || new Date().toISOString(),
      };

      await setDoc(doc(db, 'schools', schoolId, 'students', id), item);

      // Si nouvel élève : générer automatiquement les obligations de frais applicables
      // pour que chaque nouvel élève soit directement éligible au paiement de tous les frais scolaires
      if (isNew) {
        try {
          await this.ensureAllStudentCharges(schoolId, item.id);
        } catch (genErr) {
          console.warn('Initial student charges auto-generation error:', genErr);
        }
      }

      await this.logAudit(schoolId, userId, userEmail, isNew ? 'STUDENT_CREATED' : 'STUDENT_UPDATED', 'Student', id, {
        matricule: item.matricule,
        name: `${item.lastName} ${item.firstName}`,
        section: item.section,
        className: item.className,
      });
      return item;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, p);
    }
  }

  /**
   * Assure que l'élève possède l'intégralité des obligations de frais scolaires applicables à son profil
   * (Frais d'inscription, Minerval par mois, Frais de l'État, etc.) pour qu'il soit immédiatement éligible au paiement
   */
  static async ensureAllStudentCharges(schoolId: string, studentId: string): Promise<void> {
    const studentDoc = await getDoc(doc(db, 'schools', schoolId, 'students', studentId));
    if (!studentDoc.exists()) return;
    const student = { id: studentDoc.id, ...studentDoc.data() } as Student;

    const feesSnap = await getDocs(collection(db, 'schools', schoolId, 'feeTypes'));
    const feesList = feesSnap.docs.map(d => ({ id: d.id, ...d.data() } as FeeType));

    const existingChargesSnap = await getDocs(
      query(collection(db, 'schools', schoolId, 'studentCharges'), where('studentId', '==', studentId))
    );
    const existingCharges = existingChargesSnap.docs.map(d => ({ id: d.id, ...d.data() } as StudentCharge));

    const schoolDoc = await getDoc(doc(db, 'schools', schoolId));
    const schoolYear = schoolDoc.exists() ? (schoolDoc.data() as School).schoolYear : '2026-2027';

    for (const fee of feesList) {
      if (!fee.active) continue;

      // Vérification de compatibilité de classe
      if (fee.classId && fee.classId !== student.classId) continue;
      // Vérification de compatibilité d'option
      if (fee.optionId && fee.optionId !== student.optionId) continue;
      // Vérification de compatibilité de section
      if (
        fee.section &&
        fee.section.trim().length > 0 &&
        student.section &&
        fee.section.trim().toLowerCase() !== student.section.trim().toLowerCase()
      ) {
        continue;
      }

      // Si le frais est mensuel mais sans mois spécifique dans son nom (ex: "Minerval Mensuel")
      // Créer une facture pour chaque mois de l'année scolaire
      const extractedMonth = extractMonthFromCharge({ label: fee.name });
      if (fee.frequency === 'monthly' && !extractedMonth) {
        for (const m of ACADEMIC_YEAR_MONTHS) {
          const alreadyExists = existingCharges.some(
            c =>
              c.feeTypeId === fee.id &&
              c.applicableMonth?.toLowerCase() === m.toLowerCase() &&
              c.status !== 'cancelled'
          );
          if (alreadyExists) continue;

          const chgId = `chg_${Date.now()}_${student.id.substring(0, 4)}_${m.substring(0, 3)}_${Math.random().toString(36).substring(2, 6)}`;
          const dueDate = new Date().toISOString().split('T')[0];
          const chargeRecord: StudentCharge = {
            id: chgId,
            schoolId,
            studentId: student.id,
            studentName: `${student.lastName} ${student.firstName}`,
            matricule: student.matricule,
            classId: student.classId,
            feeTypeId: fee.id,
            feeTypeName: `${fee.name} - ${m}`,
            category: fee.category,
            applicableMonth: m,
            schoolYear,
            label: `${fee.name} - ${m}`,
            dueDate,
            amountDue: fee.amount,
            discountAmount: 0,
            netAmount: fee.amount,
            paidAmount: 0,
            status: 'pending',
            createdAt: new Date().toISOString(),
          };
          await setDoc(doc(db, 'schools', schoolId, 'studentCharges', chgId), chargeRecord);
        }
      } else {
        // Frais ponctuel, trimestriel, annuel ou mensuel déjà nommé avec son mois
        const alreadyExists = existingCharges.some(
          c => c.feeTypeId === fee.id && c.status !== 'cancelled'
        );
        if (alreadyExists) continue;

        const chgId = `chg_${Date.now()}_${student.id.substring(0, 4)}_${fee.id.substring(0, 5)}_${Math.random().toString(36).substring(2, 6)}`;
        const dueDate = new Date().toISOString().split('T')[0];
        const chargeRecord: StudentCharge = {
          id: chgId,
          schoolId,
          studentId: student.id,
          studentName: `${student.lastName} ${student.firstName}`,
          matricule: student.matricule,
          classId: student.classId,
          feeTypeId: fee.id,
          feeTypeName: fee.name,
          category: fee.category,
          applicableMonth: extractedMonth || undefined,
          schoolYear,
          label: fee.name,
          dueDate,
          amountDue: fee.amount,
          discountAmount: 0,
          netAmount: fee.amount,
          paidAmount: 0,
          status: 'pending',
          createdAt: new Date().toISOString(),
        };
        await setDoc(doc(db, 'schools', schoolId, 'studentCharges', chgId), chargeRecord);
      }
    }
  }

  // ------------------- MODIFICATION DE SITUATION ADMINISTRATIVE & FINANCIÈRE -------------------
  static async updateStudentFinancialSituation(
    schoolId: string,
    studentId: string,
    situationData: {
      scope: 'month' | 'year';
      month?: string;
      situation: 'in_order' | 'exempted' | 'scholarship' | 'extended_deadline' | 'dispute' | 'social_case' | 'standard';
      label: string;
      motif: string;
      discountPercentage?: number;
    },
    userId: string,
    userEmail: string,
    userName: string
  ): Promise<void> {
    const p = `schools/${schoolId}/students/${studentId}`;
    try {
      if (!situationData.motif || !situationData.motif.trim()) {
        throw new Error("Le motif justificatif de l'Administrateur Général est obligatoire.");
      }

      const studentRef = doc(db, 'schools', schoolId, 'students', studentId);
      const studentSnap = await getDoc(studentRef);
      if (!studentSnap.exists()) throw new Error('Élève introuvable.');

      const studentData = studentSnap.data() as Student;
      const now = new Date().toISOString();

      // Charger les frais facturés de cet élève
      const chargesQuery = query(
        collection(db, 'schools', schoolId, 'studentCharges'),
        where('studentId', '==', studentId)
      );
      const chargesSnap = await getDocs(chargesQuery);

      // Traiter les charges concernées par le périmètre (mois spécifique ou année entière)
      for (const chgDoc of chargesSnap.docs) {
        const charge = chgDoc.data() as StudentCharge;
        if (charge.status === 'cancelled') continue;

        let inScope = false;
        if (situationData.scope === 'year') {
          inScope = true;
        } else if (situationData.scope === 'month' && situationData.month) {
          const chgMonth = extractMonthFromCharge(charge);
          if (chgMonth && chgMonth.toLowerCase() === situationData.month.toLowerCase()) {
            inScope = true;
          } else if (charge.label.toLowerCase().includes(situationData.month.toLowerCase())) {
            inScope = true;
          }
        }

        if (inScope) {
          const chgRef = doc(db, 'schools', schoolId, 'studentCharges', chgDoc.id);

          if (situationData.situation === 'exempted' || situationData.situation === 'scholarship') {
            const pct = situationData.discountPercentage ?? 100;
            const discount = Math.round((charge.amountDue * pct) / 100);
            const net = Math.max(0, charge.amountDue - discount);
            await updateDoc(chgRef, {
              discountAmount: discount,
              netAmount: net,
              status: net === 0 ? 'paid' : charge.paidAmount >= net ? 'paid' : charge.paidAmount > 0 ? 'partial' : 'pending',
            });
          } else if (situationData.situation === 'in_order') {
            // Marquer régularisé : le reste dû est absorbé administrativement
            const remaining = Math.max(0, charge.amountDue - charge.paidAmount);
            await updateDoc(chgRef, {
              discountAmount: (charge.discountAmount || 0) + remaining,
              netAmount: charge.paidAmount,
              status: 'paid',
            });
          } else if (situationData.situation === 'social_case') {
            // Prise en charge cas social (abattement de 100% ou selon accord)
            const discount = Math.round(charge.amountDue * 0.8); // 80% ou total
            const net = Math.max(0, charge.amountDue - discount);
            await updateDoc(chgRef, {
              discountAmount: discount,
              netAmount: net,
              status: net === 0 ? 'paid' : charge.paidAmount >= net ? 'paid' : 'partial',
            });
          } else if (situationData.situation === 'standard') {
            // Rétablir la situation standard sans exonération
            await updateDoc(chgRef, {
              discountAmount: 0,
              netAmount: charge.amountDue,
              status: charge.paidAmount >= charge.amountDue ? 'paid' : charge.paidAmount > 0 ? 'partial' : 'pending',
            });
          }
        }
      }

      // Enregistrer l'état de situation administrative sur l'élève
      const situationRecord: StudentFinancialSituation = {
        scope: situationData.scope,
        month: situationData.month || '',
        situation: situationData.situation,
        label: situationData.label,
        motif: situationData.motif.trim(),
        discountPercentage: situationData.discountPercentage ?? 100,
        updatedBy: userEmail,
        updatedByName: userName,
        updatedAt: now,
      };

      await updateDoc(studentRef, {
        financialSituation: situationRecord,
      });

      // Journal d'audit obligatoire avec motif
      await this.logAudit(
        schoolId,
        userId,
        userEmail,
        'STUDENT_SITUATION_MODIFIED',
        'Student',
        studentId,
        {
          studentName: `${studentData.lastName} ${studentData.firstName}`,
          matricule: studentData.matricule,
          scope: situationData.scope,
          month: situationData.month || 'Année entière',
          situation: situationData.label,
          motif: situationData.motif.trim(),
          admin: userName || userEmail,
          appliedAt: now,
        }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, p);
    }
  }

  static async deleteStudentPermanently(
    schoolId: string,
    studentId: string,
    userId: string,
    userEmail: string
  ): Promise<void> {
    const p = `schools/${schoolId}/students/${studentId}`;
    try {
      const studentSnap = await getDoc(doc(db, 'schools', schoolId, 'students', studentId));
      const studentData = studentSnap.exists() ? (studentSnap.data() as Student) : null;

      // 1. Delete student document
      await deleteDoc(doc(db, 'schools', schoolId, 'students', studentId));

      // 2. Clean up associated charges for this student
      try {
        const chargesSnap = await getDocs(
          query(collection(db, 'schools', schoolId, 'studentCharges'), where('studentId', '==', studentId))
        );
        for (const chargeDoc of chargesSnap.docs) {
          await deleteDoc(chargeDoc.ref);
        }
      } catch (err) {
        console.warn('Could not clean up student charges:', err);
      }

      // 3. Log permanent deletion in immutable audit trail
      await this.logAudit(
        schoolId,
        userId,
        userEmail,
        'STUDENT_PERMANENTLY_DELETED',
        'Student',
        studentId,
        {
          matricule: studentData?.matricule || 'N/A',
          name: studentData ? `${studentData.lastName} ${studentData.firstName}` : 'Inconnu',
          className: studentData?.className || 'N/A',
          deletedAt: new Date().toISOString(),
        }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, p);
    }
  }

  static async transferStudent(
    schoolId: string,
    studentId: string,
    targetClassId: string,
    targetOptionId: string | undefined,
    reason: string = '',
    userId: string = 'admin',
    userEmail: string = 'admin@ecole.cd'
  ): Promise<Student> {
    const p = `schools/${schoolId}/students/${studentId}`;
    try {
      const studentSnap = await getDoc(doc(db, 'schools', schoolId, 'students', studentId));
      if (!studentSnap.exists()) {
        throw new Error('Dossier de l\'élève introuvable');
      }
      const student = studentSnap.data() as Student;

      const targetClassSnap = await getDoc(doc(db, 'schools', schoolId, 'classes', targetClassId));
      if (!targetClassSnap.exists()) {
        throw new Error('Classe de destination introuvable');
      }
      const targetClass = targetClassSnap.data() as ClassItem;

      let targetOptionName = '';
      if (targetOptionId) {
        const optionSnap = await getDoc(doc(db, 'schools', schoolId, 'options', targetOptionId));
        if (optionSnap.exists()) {
          targetOptionName = (optionSnap.data() as OptionItem).name;
        }
      }

      const prevClassName = student.className || 'Non assigné';
      const prevOptionName = student.optionName || 'Aucune option';

      const updates: Partial<Student> = {
        classId: targetClass.id,
        className: targetClass.name,
        optionId: targetOptionId || '',
        optionName: targetOptionName || '',
      };

      await updateDoc(doc(db, 'schools', schoolId, 'students', studentId), updates);

      // Log immutable audit
      await this.logAudit(
        schoolId,
        userId,
        userEmail,
        'STUDENT_TRANSFERRED',
        'Student',
        studentId,
        {
          matricule: student.matricule,
          studentName: `${student.lastName} ${student.firstName}`,
          fromClass: prevClassName,
          toClass: targetClass.name,
          fromOption: prevOptionName,
          toOption: targetOptionName || 'Aucune option',
          reason: reason || 'Transfert de classe',
          transferredAt: new Date().toISOString(),
        }
      );

      return {
        ...student,
        ...updates,
      } as Student;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, p);
    }
  }

  // ------------------- FEE CATALOG -------------------
  static async getFeeTypes(schoolId: string): Promise<FeeType[]> {
    const p = `schools/${schoolId}/feeTypes`;
    try {
      const q = query(collection(db, 'schools', schoolId, 'feeTypes'), orderBy('name', 'asc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as FeeType));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, p);
    }
  }

  static async saveFeeType(schoolId: string, feeData: Partial<FeeType>, userId: string, userEmail: string): Promise<FeeType> {
    const p = `schools/${schoolId}/feeTypes`;
    try {
      const id = feeData.id || `fee_${Date.now()}`;
      const item: FeeType = {
        id,
        schoolId,
        name: feeData.name || '',
        category: feeData.category || 'Minerval',
        section: feeData.section || '',
        promotion: feeData.promotion || '',
        optionId: feeData.optionId || '',
        optionName: feeData.optionName || '',
        classId: feeData.classId || '',
        className: feeData.className || '',
        description: feeData.description || '',
        amount: Number(feeData.amount) || 0,
        frequency: feeData.frequency || 'monthly',
        active: feeData.active ?? true,
        createdAt: feeData.createdAt || new Date().toISOString(),
      };
      await setDoc(doc(db, 'schools', schoolId, 'feeTypes', id), item);
      await this.logAudit(schoolId, userId, userEmail, feeData.id ? 'FEE_UPDATED' : 'FEE_CREATED', 'FeeType', id, { name: item.name, amount: item.amount });
      return item;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, p);
    }
  }

  static async deleteFeeType(
    schoolId: string,
    feeTypeId: string,
    userId: string,
    userEmail: string
  ): Promise<void> {
    const p = `schools/${schoolId}/feeTypes/${feeTypeId}`;
    try {
      const docRef = doc(db, 'schools', schoolId, 'feeTypes', feeTypeId);
      const snap = await getDoc(docRef);
      const feeData = snap.exists() ? snap.data() : null;
      await deleteDoc(docRef);
      await this.logAudit(schoolId, userId, userEmail, 'FEE_DELETED', 'FeeType', feeTypeId, {
        name: feeData?.name || 'Inconnu',
        category: feeData?.category || '',
        amount: feeData?.amount || 0,
        deletedAt: new Date().toISOString(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, p);
    }
  }

  // ------------------- BILLING & STUDENT CHARGES -------------------
  static async getCharges(schoolId: string, studentId?: string): Promise<StudentCharge[]> {
    const p = `schools/${schoolId}/studentCharges`;
    try {
      let q;
      if (studentId) {
        q = query(collection(db, 'schools', schoolId, 'studentCharges'), where('studentId', '==', studentId));
      } else {
        q = query(collection(db, 'schools', schoolId, 'studentCharges'), orderBy('dueDate', 'asc'));
      }
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as StudentCharge));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, p);
    }
  }

  static async generateChargesForClass(
    schoolId: string,
    classId: string,
    feeTypeId: string,
    label: string,
    dueDate: string,
    amount: number,
    schoolYear: string,
    userId: string,
    userEmail: string
  ): Promise<number> {
    const p = `schools/${schoolId}/studentCharges`;
    try {
      // Get all active students in class
      const q = query(
        collection(db, 'schools', schoolId, 'students'),
        where('classId', '==', classId),
        where('status', '==', 'active')
      );
      const snap = await getDocs(q);
      let count = 0;

      for (const studentDoc of snap.docs) {
        const student = studentDoc.data() as Student;
        const chargeId = `chg_${Date.now()}_${student.id.substring(0, 5)}_${count}`;
        const charge: StudentCharge = {
          id: chargeId,
          schoolId,
          studentId: student.id,
          studentName: `${student.lastName} ${student.firstName}`,
          matricule: student.matricule,
          classId: student.classId,
          feeTypeId,
          feeTypeName: label,
          schoolYear,
          label,
          dueDate,
          amountDue: amount,
          discountAmount: 0,
          netAmount: amount,
          paidAmount: 0,
          status: 'pending',
          createdAt: new Date().toISOString(),
        };
        await setDoc(doc(db, 'schools', schoolId, 'studentCharges', chargeId), charge);
        count++;
      }

      await this.logAudit(schoolId, userId, userEmail, 'CHARGES_GENERATED', 'Class', classId, {
        feeLabel: label,
        dueDate,
        amount,
        studentsCount: count,
      });

      return count;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, p);
    }
  }

  static async applyDiscount(
    schoolId: string,
    chargeId: string,
    discountAmount: number,
    reason: string,
    userId: string,
    userEmail: string
  ): Promise<void> {
    const p = `schools/${schoolId}/studentCharges/${chargeId}`;
    try {
      await runTransaction(db, async (transaction) => {
        const chargeRef = doc(db, 'schools', schoolId, 'studentCharges', chargeId);
        const chargeSnap = await transaction.get(chargeRef);
        if (!chargeSnap.exists()) throw new Error('Frais introuvable.');

        const charge = chargeSnap.data() as StudentCharge;
        if (discountAmount > charge.amountDue) {
          throw new Error('La remise ne peut pas être supérieure au montant total dû.');
        }

        const netAmount = Math.max(0, charge.amountDue - discountAmount);
        let status = charge.status;
        if (charge.paidAmount >= netAmount && netAmount > 0) {
          status = 'paid';
        } else if (charge.paidAmount > 0) {
          status = 'partial';
        }

        transaction.update(chargeRef, {
          discountAmount,
          netAmount,
          status,
        });
      });

      await this.logAudit(schoolId, userId, userEmail, 'DISCOUNT_APPLIED', 'StudentCharge', chargeId, {
        discountAmount,
        reason,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, p);
    }
  }

  // ------------------- PAYMENTS & ALLOCATIONS -------------------
  static async getPayments(schoolId: string, studentId?: string): Promise<Payment[]> {
    const p = `schools/${schoolId}/payments`;
    try {
      let q;
      if (studentId) {
        q = query(collection(db, 'schools', schoolId, 'payments'), where('studentId', '==', studentId));
      } else {
        q = query(collection(db, 'schools', schoolId, 'payments'), orderBy('createdAt', 'desc'));
      }
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Payment));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, p);
    }
  }

  static async generateReceiptNumber(schoolId: string, year = '2026'): Promise<string> {
    const p = `schools/${schoolId}/payments`;
    try {
      const snap = await getDocs(collection(db, 'schools', schoolId, 'payments'));
      const nextNum = snap.size + 1;
      return `REC-${year}-${String(nextNum).padStart(6, '0')}`;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, p);
    }
  }

  static async recordPayment(
    schoolId: string,
    student: Student,
    amount: number,
    paymentMethod: PaymentMethod,
    allocations: { chargeId: string; amount: number; label?: string }[],
    note: string,
    currency: string,
    userId: string,
    userEmail: string,
    userName: string,
    targetMonth?: string,
    advanceDeducted: number = 0
  ): Promise<{ payment: Payment; receipt: Receipt }> {
    if (amount <= 0 && advanceDeducted <= 0) {
      throw new Error('Le montant du paiement doit être strictement supérieur à zéro.');
    }

    const effectiveTotalAvailable = amount + advanceDeducted;
    const totalAllocated = allocations.reduce((sum, a) => sum + a.amount, 0);
    if (totalAllocated > effectiveTotalAvailable) {
      throw new Error('La somme des affectations dépasse le montant total disponible (versement + avance).');
    }

    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const receiptNumber = await this.generateReceiptNumber(schoolId);
    const dateNow = new Date().toISOString();
    const p = `schools/${schoolId}/payments/${paymentId}`;

    try {
      let createdPayment!: Payment;
      let createdReceipt!: Receipt;

      await runTransaction(db, async (transaction) => {
        // 1. Process allocations & update charges
        const allocationRecords: PaymentAllocation[] = [];
        const receiptDetails: { label: string; amount: number }[] = [];

        for (const alloc of allocations) {
          if (alloc.amount <= 0) continue;
          const chargeRef = doc(db, 'schools', schoolId, 'studentCharges', alloc.chargeId);
          const chargeSnap = await transaction.get(chargeRef);

          const feeLabel = alloc.label || targetMonth || 'Frais scolaire';

          if (!chargeSnap.exists()) {
            // Charge not yet generated in DB (e.g. advance allocation to future month or specific fee by libellé)
            const newCharge: StudentCharge = {
              id: alloc.chargeId,
              schoolId,
              studentId: student.id,
              studentName: `${student.lastName} ${student.firstName}`,
              matricule: student.matricule,
              classId: student.classId,
              feeTypeId: 'auto_advance_alloc',
              feeTypeName: feeLabel,
              schoolYear: '2026-2027',
              label: feeLabel,
              dueDate: dateNow.split('T')[0],
              amountDue: alloc.amount,
              discountAmount: 0,
              netAmount: alloc.amount,
              paidAmount: alloc.amount,
              status: 'paid',
              createdAt: dateNow,
            };
            transaction.set(chargeRef, newCharge);
          } else {
            const charge = chargeSnap.data() as StudentCharge;
            const remainingDue = Math.max(0, charge.netAmount - charge.paidAmount);

            if (alloc.amount > remainingDue) {
              throw new Error(`Le montant alloué (${alloc.amount}) dépasse le solde restant (${remainingDue}) pour "${charge.label}".`);
            }

            const newPaidAmount = charge.paidAmount + alloc.amount;
            const newStatus = newPaidAmount >= charge.netAmount ? 'paid' : 'partial';

            transaction.update(chargeRef, {
              paidAmount: newPaidAmount,
              status: newStatus,
            });
          }

          const allocId = `alloc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          const allocRecord: PaymentAllocation = {
            id: allocId,
            schoolId,
            paymentId,
            studentChargeId: alloc.chargeId,
            feeLabel,
            studentId: student.id,
            amount: alloc.amount,
            createdAt: dateNow,
          };
          allocationRecords.push(allocRecord);
          receiptDetails.push({ label: feeLabel, amount: alloc.amount });

          const allocRef = doc(db, 'schools', schoolId, 'paymentAllocations', allocId);
          transaction.set(allocRef, allocRecord);
        }

        // Si aucun frais explicite n'était coché mais qu'un libellé principal spécifique (autre que avance générale) est ciblé
        if (allocationRecords.length === 0 && targetMonth && targetMonth !== 'Avance sur frais scolaires' && effectiveTotalAvailable > 0) {
          const autoChargeId = `chg_${student.id}_${Date.now()}`;
          const autoChargeRef = doc(db, 'schools', schoolId, 'studentCharges', autoChargeId);
          const cleanLabel = targetMonth.toLowerCase().includes('minerval') || targetMonth.toLowerCase().includes('frais')
            ? targetMonth
            : `Minerval - ${targetMonth}`;

          const newCharge: StudentCharge = {
            id: autoChargeId,
            schoolId,
            studentId: student.id,
            studentName: `${student.lastName} ${student.firstName}`,
            matricule: student.matricule,
            classId: student.classId,
            feeTypeId: 'auto_target_alloc',
            feeTypeName: cleanLabel,
            schoolYear: '2026-2027',
            label: cleanLabel,
            dueDate: dateNow.split('T')[0],
            amountDue: effectiveTotalAvailable,
            discountAmount: 0,
            netAmount: effectiveTotalAvailable,
            paidAmount: effectiveTotalAvailable,
            status: 'paid',
            createdAt: dateNow,
          };
          transaction.set(autoChargeRef, newCharge);

          const allocId = `alloc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          const allocRecord: PaymentAllocation = {
            id: allocId,
            schoolId,
            paymentId,
            studentChargeId: autoChargeId,
            feeLabel: cleanLabel,
            studentId: student.id,
            amount: effectiveTotalAvailable,
            createdAt: dateNow,
          };
          allocationRecords.push(allocRecord);
          receiptDetails.push({ label: cleanLabel, amount: effectiveTotalAvailable });

          const allocRef = doc(db, 'schools', schoolId, 'paymentAllocations', allocId);
          transaction.set(allocRef, allocRecord);
        }

        // 2. Handle Advance Credit: deduction from existing advance and/or addition of newly generated advance
        const advancePortion = Math.max(0, effectiveTotalAvailable - totalAllocated);
        if (advanceDeducted > 0 || advancePortion > 0) {
          const studentRef = doc(db, 'schools', schoolId, 'students', student.id);
          const studentSnap = await transaction.get(studentRef);
          const currentStudent = studentSnap.exists() ? (studentSnap.data() as Student) : student;
          const currentAdvance = currentStudent.creditAdvance || 0;

          if (advanceDeducted > currentAdvance) {
            throw new Error(`Le montant déduit sur l'avance (${advanceDeducted}) dépasse l'avance disponible (${currentAdvance}).`);
          }

          const newAdvance = Math.max(0, currentAdvance - advanceDeducted + advancePortion);
          transaction.update(studentRef, { creditAdvance: newAdvance });

          if (advanceDeducted > 0) {
            receiptDetails.push({ label: `Déduction sur avance élève (${advanceDeducted} ${currency})`, amount: advanceDeducted });
          }
          if (advancePortion > 0) {
            receiptDetails.push({ label: `Avance créditée sur solde (${advancePortion} ${currency})`, amount: advancePortion });
          }
        }

        // 3. Create Payment document (amount represents the total settled value recognised as encaissé)
        createdPayment = {
          id: paymentId,
          schoolId,
          studentId: student.id,
          studentName: `${student.lastName} ${student.firstName}`,
          matricule: student.matricule,
          classId: student.classId,
          className: student.className,
          amount: effectiveTotalAvailable,
          directAmountPaid: amount,
          advanceDeducted: advanceDeducted,
          paymentDate: dateNow.split('T')[0],
          targetMonth: targetMonth || '',
          paymentMethod,
          receiptNumber,
          note: note || '',
          createdBy: userId,
          createdByName: userName || userEmail,
          status: 'posted',
          allocations: allocationRecords,
          createdAt: dateNow,
        };

        const paymentRef = doc(db, 'schools', schoolId, 'payments', paymentId);
        transaction.set(paymentRef, createdPayment);

        // 4. Create Receipt document
        const receiptId = `rec_${Date.now()}`;
        createdReceipt = {
          id: receiptId,
          schoolId,
          receiptNumber,
          paymentId,
          studentId: student.id,
          studentName: `${student.lastName} ${student.firstName}`,
          matricule: student.matricule,
          className: student.className || 'Classe non assignée',
          amount: effectiveTotalAvailable,
          amountInWords: numberToWords(effectiveTotalAvailable, currency),
          currency,
          targetMonth: targetMonth || '',
          paymentMethod,
          cashierName: userName || userEmail,
          note,
          allocationsSummary: receiptDetails,
          issuedAt: dateNow,
        };

        const receiptRef = doc(db, 'schools', schoolId, 'receipts', receiptId);
        transaction.set(receiptRef, createdReceipt);

        // 5. Create CashOperation movement (only for actual cash / mobile money perceived today)
        if (amount > 0 && ['cash', 'mobile_money'].includes(paymentMethod)) {
          const cashOpId = `csh_${Date.now()}`;
          const cashOp: CashOperation = {
            id: cashOpId,
            schoolId,
            date: dateNow.split('T')[0],
            type: 'inflow',
            amount,
            paymentMethod,
            referenceId: receiptNumber,
            performedBy: userId,
            performedByName: userName || userEmail,
            balanceAfter: 0,
            notes: `Paiement ${receiptNumber} - ${student.lastName} ${student.firstName}`,
            createdAt: dateNow,
          };
          const cashOpRef = doc(db, 'schools', schoolId, 'cashOperations', cashOpId);
          transaction.set(cashOpRef, cashOp);
        }
      });

      await this.logAudit(schoolId, userId, userEmail, 'PAYMENT_CREATED', 'Payment', paymentId, {
        receiptNumber,
        amount: effectiveTotalAvailable,
        directAmountPaid: amount,
        advanceDeducted,
        paymentMethod,
        studentMatricule: student.matricule,
      });

      return { payment: createdPayment, receipt: createdReceipt };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, p);
    }
  }

  static async voidPayment(
    schoolId: string,
    paymentId: string,
    reason: string,
    userId: string,
    userEmail: string
  ): Promise<void> {
    const p = `schools/${schoolId}/payments/${paymentId}`;
    try {
      await runTransaction(db, async (transaction) => {
        const paymentRef = doc(db, 'schools', schoolId, 'payments', paymentId);
        const paymentSnap = await transaction.get(paymentRef);
        if (!paymentSnap.exists()) throw new Error('Paiement introuvable.');

        const payment = paymentSnap.data() as Payment;
        if (payment.status !== 'posted') {
          throw new Error('Ce paiement ne peut pas être annulé car son statut est déjà : ' + payment.status);
        }

        // Get allocations of this payment
        const allocQuery = query(
          collection(db, 'schools', schoolId, 'paymentAllocations'),
          where('paymentId', '==', paymentId)
        );
        const allocSnap = await getDocs(allocQuery);

        // Revert charges
        for (const aDoc of allocSnap.docs) {
          const alloc = aDoc.data() as PaymentAllocation;
          const chargeRef = doc(db, 'schools', schoolId, 'studentCharges', alloc.studentChargeId);
          const chargeSnap = await transaction.get(chargeRef);
          if (chargeSnap.exists()) {
            const charge = chargeSnap.data() as StudentCharge;
            const newPaid = Math.max(0, charge.paidAmount - alloc.amount);
            const newStatus = newPaid === 0 ? 'pending' : 'partial';
            transaction.update(chargeRef, {
              paidAmount: newPaid,
              status: newStatus,
            });
          }
        }

        const dateNow = new Date().toISOString();
        transaction.update(paymentRef, {
          status: 'voided',
          voidReason: reason,
          voidedBy: userEmail,
          voidedAt: dateNow,
        });

        // Add cash outflow reversal
        const cashOpId = `csh_rev_${Date.now()}`;
        const cashOp: CashOperation = {
          id: cashOpId,
          schoolId,
          date: dateNow.split('T')[0],
          type: 'outflow',
          amount: payment.amount,
          paymentMethod: payment.paymentMethod,
          referenceId: payment.receiptNumber,
          performedBy: userId,
          performedByName: userEmail,
          balanceAfter: 0,
          notes: `Annulation du paiement ${payment.receiptNumber} (${reason})`,
          createdAt: dateNow,
        };
        transaction.set(doc(db, 'schools', schoolId, 'cashOperations', cashOpId), cashOp);
      });

      await this.logAudit(schoolId, userId, userEmail, 'PAYMENT_VOIDED', 'Payment', paymentId, {
        reason,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, p);
    }
  }

  // ------------------- RECEIPTS -------------------
  static async getReceipts(schoolId: string): Promise<Receipt[]> {
    const p = `schools/${schoolId}/receipts`;
    try {
      const q = query(collection(db, 'schools', schoolId, 'receipts'), orderBy('issuedAt', 'desc'), limit(100));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Receipt));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, p);
    }
  }

  static async getReceiptByPaymentId(schoolId: string, paymentId: string): Promise<Receipt | null> {
    const p = `schools/${schoolId}/receipts`;
    try {
      const q = query(collection(db, 'schools', schoolId, 'receipts'), where('paymentId', '==', paymentId));
      const snap = await getDocs(q);
      if (snap.empty) return null;
      return { id: snap.docs[0].id, ...snap.docs[0].data() } as Receipt;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, p);
    }
  }

  // ------------------- CASH OPERATIONS -------------------
  static async getCashOperations(schoolId: string, date?: string): Promise<CashOperation[]> {
    const p = `schools/${schoolId}/cashOperations`;
    try {
      let q;
      if (date) {
        q = query(
          collection(db, 'schools', schoolId, 'cashOperations'),
          where('date', '==', date),
          orderBy('createdAt', 'desc')
        );
      } else {
        q = query(collection(db, 'schools', schoolId, 'cashOperations'), orderBy('createdAt', 'desc'), limit(150));
      }
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as CashOperation));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, p);
    }
  }

  static async performCashClosing(
    schoolId: string,
    date: string,
    openingBalance: number,
    physicalCash: number,
    notes: string,
    userId: string,
    userEmail: string
  ): Promise<CashOperation> {
    const p = `schools/${schoolId}/cashOperations`;
    try {
      // Calculate day total inflows and outflows
      const ops = await this.getCashOperations(schoolId, date);
      let dayInflow = 0;
      let dayOutflow = 0;

      ops.forEach(op => {
        if (op.type === 'inflow') dayInflow += op.amount;
        if (op.type === 'outflow') dayOutflow += op.amount;
      });

      const theoreticalBalance = openingBalance + dayInflow - dayOutflow;
      const difference = physicalCash - theoreticalBalance;

      const closingId = `close_${Date.now()}`;
      const closeRecord: CashOperation = {
        id: closingId,
        schoolId,
        date,
        type: 'closing',
        amount: theoreticalBalance,
        performedBy: userId,
        performedByName: userEmail,
        balanceAfter: physicalCash,
        physicalCash,
        cashDifference: difference,
        notes: notes || `Clôture de journée. Écart: ${difference}`,
        createdAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'schools', schoolId, 'cashOperations', closingId), closeRecord);
      await this.logAudit(schoolId, userId, userEmail, 'CASH_CLOSING', 'CashOperation', closingId, {
        date,
        theoreticalBalance,
        physicalCash,
        difference,
      });

      return closeRecord;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, p);
    }
  }

  // ------------------- AUDIT LOGGING -------------------
  static async logAudit(
    schoolId: string,
    userId: string,
    userEmail: string,
    action: string,
    entityType: string,
    entityId: string,
    metadata: Record<string, unknown> | string
  ): Promise<void> {
    const auditId = `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const p = `schools/${schoolId}/auditLogs/${auditId}`;
    try {
      const log: AuditLog = {
        id: auditId,
        schoolId,
        userId: userId || 'system',
        userEmail: userEmail || 'system@ecole.cd',
        action,
        entityType,
        entityId,
        metadata: typeof metadata === 'object' ? JSON.stringify(metadata) : metadata,
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'schools', schoolId, 'auditLogs', auditId), log);
    } catch (error) {
      // Don't interrupt flow if audit fails, but log
      console.error('Audit logging failed: ', error);
    }
  }

  static async getAuditLogs(schoolId: string): Promise<AuditLog[]> {
    const p = `schools/${schoolId}/auditLogs`;
    try {
      const q = query(collection(db, 'schools', schoolId, 'auditLogs'), orderBy('createdAt', 'desc'), limit(150));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as AuditLog));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, p);
    }
  }

  // ------------------- USER MANAGEMENT & RBAC -------------------
  static async getUsers(schoolId: string): Promise<UserProfile[]> {
    const p = `schools/${schoolId}/users`;
    try {
      const snap = await getDocs(collection(db, 'schools', schoolId, 'users'));
      if (!snap.empty) {
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as UserProfile));
      }

      // Default initial users if collection empty
      const defaultUsers: UserProfile[] = [
        {
          id: 'usr_admin',
          schoolId,
          email: 'controlpolytra@gmail.com',
          displayName: 'Administrateur Général',
          role: 'admin',
          active: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'usr_director',
          schoolId,
          email: 'directeur@college-boboto.cd',
          displayName: 'Directeur des Études',
          role: 'director',
          active: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'usr_cashier',
          schoolId,
          email: 'caisse@college-boboto.cd',
          displayName: 'Mme Cécile Mbuyi (Caissière)',
          role: 'cashier',
          active: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'usr_secretary',
          schoolId,
          email: 'secretaire@college-boboto.cd',
          displayName: 'Secrétariat Administratif',
          role: 'secretary',
          active: true,
          createdAt: new Date().toISOString(),
        },
      ];

      for (const u of defaultUsers) {
        await setDoc(doc(db, 'schools', schoolId, 'users', u.id), u);
      }
      return defaultUsers;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, p);
    }
  }

  static async saveUser(
    schoolId: string,
    userData: Partial<UserProfile>,
    userId: string,
    userEmail: string
  ): Promise<UserProfile> {
    const p = `schools/${schoolId}/users`;
    try {
      const isNew = !userData.id;
      const id = userData.id || `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const userItem: UserProfile = {
        id,
        schoolId,
        email: userData.email || '',
        displayName: userData.displayName || userData.email?.split('@')[0] || 'Utilisateur',
        role: userData.role || 'secretary',
        active: userData.active ?? true,
        createdAt: userData.createdAt || new Date().toISOString(),
      };

      await setDoc(doc(db, 'schools', schoolId, 'users', id), userItem);
      await this.logAudit(
        schoolId,
        userId,
        userEmail,
        isNew ? 'USER_CREATED' : 'USER_UPDATED',
        'UserProfile',
        id,
        {
          email: userItem.email,
          displayName: userItem.displayName,
          role: userItem.role,
        }
      );
      return userItem;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, p);
    }
  }

  static async updateUserRole(
    schoolId: string,
    targetUserId: string,
    newRole: UserRole,
    userId: string,
    userEmail: string
  ): Promise<void> {
    const p = `schools/${schoolId}/users/${targetUserId}`;
    try {
      await updateDoc(doc(db, 'schools', schoolId, 'users', targetUserId), {
        role: newRole,
      });
      await this.logAudit(
        schoolId,
        userId,
        userEmail,
        'USER_ROLE_CHANGED',
        'UserProfile',
        targetUserId,
        {
          newRole,
          updatedAt: new Date().toISOString(),
        }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, p);
    }
  }

  static async deleteUser(
    schoolId: string,
    targetUserId: string,
    userId: string,
    userEmail: string
  ): Promise<void> {
    const p = `schools/${schoolId}/users/${targetUserId}`;
    try {
      const userSnap = await getDoc(doc(db, 'schools', schoolId, 'users', targetUserId));
      const uData = userSnap.exists() ? (userSnap.data() as UserProfile) : null;

      await deleteDoc(doc(db, 'schools', schoolId, 'users', targetUserId));
      await this.logAudit(
        schoolId,
        userId,
        userEmail,
        'USER_DELETED',
        'UserProfile',
        targetUserId,
        {
          deletedEmail: uData?.email || 'N/A',
          deletedName: uData?.displayName || 'N/A',
          deletedRole: uData?.role || 'N/A',
          deletedAt: new Date().toISOString(),
        }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, p);
    }
  }
}
