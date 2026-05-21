/**
 * Public Firebase web client config for the a-reflections / RepoPress deployment.
 * These values are not secrets (they ship in the browser bundle). Env vars override
 * them when set (e.g. local .env or CI).
 */
export const A_REFLECTIONS_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDDZNggvPgspFMo_r8hdq_rkT2Ep-f45PE",
  authDomain: "a-reflections.firebaseapp.com",
  projectId: "a-reflections",
  appId: "1:901114266665:web:7934ad0726ca7cc02c0838",
};

const pickConfigField = (envValue, fallback) => {
  const trimmed = typeof envValue === "string" ? envValue.trim() : "";
  return trimmed.length > 0 ? trimmed : fallback;
};

export const resolveFirebaseConfig = () => ({
  apiKey: pickConfigField(
    process.env.REACT_APP_FIREBASE_API_KEY,
    A_REFLECTIONS_FIREBASE_CONFIG.apiKey
  ),
  authDomain: pickConfigField(
    process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    A_REFLECTIONS_FIREBASE_CONFIG.authDomain
  ),
  projectId: pickConfigField(
    process.env.REACT_APP_FIREBASE_PROJECT_ID,
    A_REFLECTIONS_FIREBASE_CONFIG.projectId
  ),
  appId: pickConfigField(
    process.env.REACT_APP_FIREBASE_APP_ID,
    A_REFLECTIONS_FIREBASE_CONFIG.appId
  ),
});

export const isFirebaseConfigReady = (config) =>
  Object.values(config).every(
    (value) => typeof value === "string" && value.trim().length > 0
  );
