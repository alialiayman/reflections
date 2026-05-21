import { initializeApp } from 'firebase/app';
import {
  GithubAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from 'firebase/auth';
import {
  isFirebaseConfigReady,
  resolveFirebaseConfig,
} from '../config/firebase-config';

const firebaseConfig = resolveFirebaseConfig();
const hasFirebaseConfig = isFirebaseConfigReady(firebaseConfig);

let auth = null;
let provider = null;

if (hasFirebaseConfig) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  provider = new GithubAuthProvider();
  provider.addScope('repo');
  provider.addScope('read:org');
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
