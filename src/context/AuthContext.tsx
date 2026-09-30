import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as fbSignOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
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
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (e: string, p: string) => Promise<void>;
  signUpWithEmail: (e: string, p: string, name: string, role?: UserRole) => Promise<void>;
  signOut: () => Promise<void>;
  switchRole: (newRole: UserRole) => void;
  setSchoolId: (id: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const DEFAULT_SCHOOL_ID = 'school_college_boboto';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [schoolId, setSchoolId] = useState<string>(DEFAULT_SCHOOL_ID);
  const [activeRole, setActiveRole] = useState<UserRole>('admin');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!isMounted) return;
      setCurrentUser(user);

      if (user) {
        try {
          const userDocRef = doc(db, 'schools', schoolId, 'users', user.uid);
          const snap = await getDoc(userDocRef);

          let role: UserRole = 'admin';
          if (user.email === 'controlpolytra@gmail.com') {
            role = 'admin';
          }

          if (snap.exists()) {
            const data = snap.data() as UserProfile;
            setProfile(data);
            setActiveRole(data.role || role);
          } else {
            const newProfile: UserProfile = {
              id: user.uid,
              schoolId,
              email: user.email || 'utilisateur@ecole.cd',
              displayName: user.displayName || user.email?.split('@')[0] || 'Responsable Scolaire',
              role,
              active: true,
              createdAt: new Date().toISOString(),
            };
            try {
              await setDoc(userDocRef, newProfile);
            } catch {
              // Ignore doc write error in initial anonymous setup
            }
            setProfile(newProfile);
            setActiveRole(role);
          }
        } catch {
          // Fallback user profile in case of permissions during initial bootstrap
          const fallbackProfile: UserProfile = {
            id: user.uid,
            schoolId,
            email: user.email || 'admin@ecole.cd',
            displayName: user.displayName || 'Administrateur',
            role: 'admin',
            active: true,
            createdAt: new Date().toISOString(),
          };
          setProfile(fallbackProfile);
          setActiveRole(fallbackProfile.role);
        }
      } else {
        // Auto-authenticate anonymously for seamless preview & permissions
        try {
          await signInAnonymously(auth);
        } catch {
          const fallbackProfile: UserProfile = {
            id: 'admin_local',
            schoolId,
            email: 'admin@ecole.cd',
            displayName: 'Direction & Administration',
            role: 'admin',
            active: true,
            createdAt: new Date().toISOString(),
          };
          setProfile(fallbackProfile);
          setActiveRole('admin');
        }
      }
      setLoading(false);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [schoolId]);

  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'auth/google');
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const signUpWithEmail = async (email: string, pass: string, name: string, role: UserRole = 'cashier') => {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    if (cred.user) {
      const newProfile: UserProfile = {
        id: cred.user.uid,
        schoolId,
        email,
        displayName: name,
        role: cred.user.email === 'controlpolytra@gmail.com' ? 'admin' : role,
        active: true,
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'schools', schoolId, 'users', cred.user.uid), newProfile);
      setProfile(newProfile);
      setActiveRole(newProfile.role);
    }
  };

  const signOut = async () => {
    await fbSignOut(auth);
    setProfile(null);
  };

  const switchRole = (newRole: UserRole) => {
    setActiveRole(newRole);
    if (profile) {
      setProfile({ ...profile, role: newRole });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        profile,
        schoolId,
        role: activeRole,
        loading,
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
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
