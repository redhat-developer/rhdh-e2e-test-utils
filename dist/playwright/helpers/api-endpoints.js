const baseApiUrl = "https://api.github.com";
const perPage = 100;
const getRepoUrl = (owner, repo) => `${baseApiUrl}/repos/${owner}/${repo}`;
const getOrgUrl = (owner) => `${baseApiUrl}/orgs/${owner}`;
const backstageShowcaseAPI = getRepoUrl("janus-idp", "backstage-showcase");
export const GITHUB_API_ENDPOINTS = {
    pull: (owner, repo, state) => `${getRepoUrl(owner, repo)}/pulls?per_page=${perPage}&state=${state}`,
    issues: (state) => `${backstageShowcaseAPI}/issues?per_page=${perPage}&sort=updated&state=${state}`,
    workflowRuns: `${backstageShowcaseAPI}/actions/runs?per_page=${perPage}`,
    getOrg: getOrgUrl,
    createRepo: (owner) => `${getOrgUrl(owner)}/repos`,
    getRepo: getRepoUrl,
    deleteRepo: getRepoUrl,
    mergePR: (owner, repoName, pullNumber) => `${getRepoUrl(owner, repoName)}/pulls/${pullNumber}/merge`,
    pullFiles: (owner, repoName, pr) => `${getRepoUrl(owner, repoName)}/pulls/${pr}/files`,
    contents: (owner, repoName) => `${getRepoUrl(owner, repoName)}/contents`,
};
