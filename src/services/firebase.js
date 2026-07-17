const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

export const firebaseReady = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
let auth;
let pendingCredential;
if (firebaseReady) {
  const [{ initializeApp }, authModule] = await Promise.all([import('firebase/app'), import('firebase/auth')]);
  auth = authModule.getAuth(initializeApp(config));
  auth.useDeviceLanguage();
}

export const firebaseAuth = {
  async idToken() { return auth?.currentUser?.getIdToken?.() || null; },
  async email(email, password) {
    const { signInWithEmailAndPassword, createUserWithEmailAndPassword, linkWithCredential } = await import('firebase/auth');
    try { const result=await signInWithEmailAndPassword(auth, email, password); if(pendingCredential){await linkWithCredential(result.user,pendingCredential);pendingCredential=null;} return result; }
    catch (error) {
      if (['auth/invalid-credential', 'auth/user-not-found'].includes(error.code)) return createUserWithEmailAndPassword(auth, email, password);
      throw error;
    }
  },
  async google() {
    const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
    try{return await signInWithPopup(auth, new GoogleAuthProvider());}catch(error){if(error.code==='auth/account-exists-with-different-credential'){pendingCredential=GoogleAuthProvider.credentialFromError(error);throw new Error('This email already has an account. Sign in with email first to link Google.');}throw error;}
  },
  observe(callback) {
    if (!auth) return () => {};
    return import('firebase/auth').then(({ onAuthStateChanged }) => onAuthStateChanged(auth, async user => {
      if (!user) return callback(null);
      const token = await user.getIdTokenResult();
      callback({ id: user.uid, email: user.email, displayName: user.displayName, emailVerified: user.emailVerified === true, role: token.claims.admin === true ? 'admin' : 'user' });
    }));
  },
  async sendVerification() { const { sendEmailVerification }=await import('firebase/auth'); if(!auth?.currentUser)throw new Error('Sign in first'); return sendEmailVerification(auth.currentUser); },
  async logout() { const { signOut }=await import('firebase/auth'); return signOut(auth); }
};
