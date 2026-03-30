import { initializeApp } from 'firebase/app';
import {
  GithubAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

const hasFirebaseConfig = Object.values(firebaseConfig).every((value) => typeof value === 'string' && value.trim().length > 0);

let auth = null;
let provider = null;

if (hasFirebaseConfig) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  provider = new GithubAuthProvider();
  provider.addScope('repo');
}

export const isGithubAuthConfigured = () => hasFirebaseConfig;

export const onGithubAuthChanged = (callback) => {
  if (!auth) {
    callback(null);
    return () => {};
  }

  return onAuthStateChanged(auth, callback);
};

export const signInWithGithub = async () => {
  if (!auth || !provider) {
    throw new Error('GitHub OAuth is not configured.');
  }

  const result = await signInWithPopup(auth, provider);
  const credential = GithubAuthProvider.credentialFromResult(result);
  const accessToken = credential?.accessToken || '';

  return {
    user: result.user,
    accessToken
  };
};

export const signOutGithub = async () => {
  if (!auth) {
    return;
  }

  await signOut(auth);
};
