/** Base name of the root-level private folder (may be prefixed with a number, e.g. "5 خاص"). */
export const PRIVATE_FOLDER_BASE_NAME = 'خاص';

export const PRIVATE_FOLDER_ACCESS_LOGIN = 'hajonsoft';

export const EXCLUDED_FOLDER_NAMES = new Set(['reflections-react-code']);

const safelyDecodeURIComponent = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export const normalizePathSegment = (segment) =>
  safelyDecodeURIComponent(segment || '').trim();

const stripLeadingFolderNumber = (folderName = '') =>
  normalizePathSegment(folderName).replace(/^\d+\s*[-_.]?\s*/, '').trim();

export const isPrivateFolderName = (folderName) =>
  stripLeadingFolderNumber(folderName) === PRIVATE_FOLDER_BASE_NAME;

export const getNormalizedPathSegments = (path = '') =>
  path
    .split('/')
    .filter(Boolean)
    .map((segment) => normalizePathSegment(segment))
    .filter(Boolean);

export const pathContainsPrivateFolder = (path) =>
  getNormalizedPathSegments(path).some(isPrivateFolderName);

export const canAccessPrivateFolder = (githubLogin) =>
  normalizePathSegment(githubLogin).toLowerCase() === PRIVATE_FOLDER_ACCESS_LOGIN;

export const isPathAccessible = (path, githubLogin) =>
  !pathContainsPrivateFolder(path) || canAccessPrivateFolder(githubLogin);

const getLeadingNumber = (name) => {
  const match = name.match(/^\s*(\d+)/);
  return match ? Number.parseInt(match[1], 10) : Number.POSITIVE_INFINITY;
};

export const sortFoldersNumerically = (folders) =>
  [...folders].sort((a, b) => {
    const aNumber = getLeadingNumber(a.name);
    const bNumber = getLeadingNumber(b.name);

    if (aNumber !== bNumber) {
      return aNumber - bNumber;
    }

    return a.name.localeCompare(b.name, undefined, {
      numeric: true,
      sensitivity: 'base',
    });
  });

/** Numbered folders first; the private folder always appears last. */
export const sortFoldersForDisplay = (folders) => {
  const regular = [];
  const privateOnes = [];

  folders.forEach((folder) => {
    if (isPrivateFolderName(folder?.name)) {
      privateOnes.push(folder);
    } else {
      regular.push(folder);
    }
  });

  return [...sortFoldersNumerically(regular), ...sortFoldersNumerically(privateOnes)];
};

export const shouldIncludeFolderInList = (folder, githubLogin) => {
  if (!folder || typeof folder.name !== 'string') {
    return false;
  }

  const folderName = folder.name.trim();
  if (!folderName || folderName.startsWith('.')) {
    return false;
  }

  if (EXCLUDED_FOLDER_NAMES.has(folderName)) {
    return false;
  }

  if (isPrivateFolderName(folderName)) {
    return canAccessPrivateFolder(githubLogin);
  }

  return true;
};

export const filterFoldersForListing = (folders, githubLogin) =>
  sortFoldersForDisplay(
    (Array.isArray(folders) ? folders : []).filter((folder) =>
      shouldIncludeFolderInList(folder, githubLogin)
    )
  );
