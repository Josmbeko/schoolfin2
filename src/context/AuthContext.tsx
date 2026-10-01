import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as fbSignOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, OperationType, handleFirestoreError } from '../firebase/config';
import { UserProfile, UserRole } from '../types';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  profile: UserProfile | null;
  schoolId: string;
  role: UserRole;
  loading: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (e: string, p: string) => Promise<void>;
  signUpWithEmail: (e: string, p: string, name: string, role?: UserRole) => Promise<void>;
  signOut: () => Promise<void>;
  switchRole: (newRole: UserRole) => void;
  setSchoolId: (id: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const DEFAULT_SCHOOL_ID = 'school_college_boboto';
export const ADMIN_EMAIL = 'controlpolytra@gmail.com';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [schoolId, setSchoolId] = useState<string>(DEFAULT_SCHOOL_ID);
  const [activeRole, setActiveRole] = useState<UserRole>('admin');
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!mounted) return;
      setCurrentUser(user);
      setAuthError(null);

      if (!user) {
        setProfile(null);
        setActiveRole('admin');
        setLoading(false);
        return;
      }

      try {
        const profileRef = doc(db, 'schools', schoolId, 'users', user.uid);
        const snap = await getDoc(profileRef);

        if (snap.exists()) {
          const data = snap.data() as UserProfile;
          if (!data.active) {
            await fbSignOut(auth);
            throw new Error('Ce compte est désactivé. Contactez un administrateur.');
          }
          setProfile(data);
          setActiveRole(data.role);
        } else if (user.email === ADMIN_EMAIL && user.emailVerified) {
          const adminProfile: UserProfile = {
            id: user.uid,
            schoolId,
            email: user.email,
            displayName: user.displayName || 'Administrateur Général',
            role: 'admin',
            active: true,
            createdAt: new Date().toISOString(),
          };
          await setDoc(profileRef, adminProfile);
          setProfile(adminProfile);
          setActiveRole('admin');
        } else {
          await fbSignOut(auth);
          throw new Error('Votre compte Firebase n’est pas autorisé pour cet établissement.');
        }
      } catch (error) {
        if (!mounted) return;
        setProfile(null);
        setAuthError(error instanceof Error ? error.message : 'Erreur d’authentification.');
      } finally {
        if (mounted) setLoading(false);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [schoolId]);

  const signInWithGoogle = async () => {
    setAuthError(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Connexion Google impossible.');
      throw error;
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Email ou mot de passe incorrect.');
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, pass: string, name: string, role: UserRole = 'secretary') => {
    if (email.toLowerCase() !== ADMIN_EMAIL) {
      throw new Error('La création de comptes est réservée à l’administrateur initial.');
    }
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    if (cred.user) {
      const newProfile: UserProfile = {
        id: cred.user.uid,
        schoolId,
        email,
        displayName: name,
        role: 'admin',
        active: true,
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'schools', schoolId, 'users', cred.user.uid), newProfile);
      setProfile(newProfile);
      setActiveRole('admin');
    }
  };

  const signOut = async () => {
    await fbSignOut(auth);
    setProfile(null);
    setActiveRole('admin');
  };

  const switchRole = (_newRole: UserRole) => {
    // Role is authoritative in Firestore; do not allow client-side privilege escalation.
    if (profile) setActiveRole(profile.role);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        profile,
        schoolId,
        role: activeRole,
        loading,
        authError,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        switchRole,
        setSchoolId,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
