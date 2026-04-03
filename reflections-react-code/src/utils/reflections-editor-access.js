/**
 * Editing / AI features for alialiayman/reflections are limited to:
 * - Specific GitHub users (repo owner + trusted account)
 * - Active members of organizations hajonsoft or alialiayman
 *
 * Requires OAuth scope read:org to list org memberships (see github-auth.js).
 */
const GITHUB_API_BASE = 'https://api.github.com';

const ALLOWED_USER_LOGINS = new Set(['alialiayman', 'hajonsoft']);

const ALLOWED_ORG_LOGINS = new Set(['hajonsoft', 'alialiayman']);

const githubHeaders = (accessToken) => ({
  Authorization: `Bearer ${accessToken}`,
  Accept: 'application/vnd.github+json',
});

/**
 * @returns {Promise<{ eligible: boolean, login: string, reason: string }>}
 */
export async function checkReflectionsEditorIdentity(accessToken) {
  if (!accessToken?.trim()) {
    return { eligible: false, login: '', reason: 'no_token' };
  }

  try {
    const userResponse = await fetch(`${GITHUB_API_BASE}/user`, {
      headers: githubHeaders(accessToken),
    });

    if (!userResponse.ok) {
      return { eligible: false, login: '', reason: 'user_fetch_failed' };
    }

    const user = await userResponse.json();
    const login = (user.login || '').trim();
    const loginLower = login.toLowerCase();

    if (ALLOWED_USER_LOGINS.has(loginLower)) {
      return { eligible: true, login, reason: 'allowed_user' };
    }

    let page = 1;
    for (;;) {
      const orgUrl = `${GITHUB_API_BASE}/user/memberships/orgs?state=active&per_page=100&page=${page}`;
      const orgResponse = await fetch(orgUrl, {
        headers: githubHeaders(accessToken),
      });

      if (orgResponse.status === 403) {
        return {
          eligible: false,
          login,
          reason: 'read_org_scope_required',
        };
      }

      if (!orgResponse.ok) {
        return { eligible: false, login, reason: 'org_memberships_failed' };
      }

      const memberships = await orgResponse.json();
      if (!Array.isArray(memberships) || memberships.length === 0) {
        break;
      }

      for (const membership of memberships) {
        const orgLogin = (membership.organization?.login || '').toLowerCase();
        if (ALLOWED_ORG_LOGINS.has(orgLogin)) {
          return { eligible: true, login, reason: `org_${orgLogin}` };
        }
      }

      if (memberships.length < 100) {
        break;
      }
      page += 1;
    }

    return { eligible: false, login, reason: 'not_allowlisted' };
  } catch {
    return { eligible: false, login: '', reason: 'network_error' };
  }
}
