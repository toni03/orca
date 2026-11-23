import { describe, expect, it } from 'vitest'
import { scanNestedRepos } from './nested-repo-discovery'

function posixTestFilesystem(args: { directories: Map<string, string[]>; gitRepos: Set<string> }) {
  return {
    readDirectory: async (dirPath: string) =>
      (args.directories.get(dirPath) ?? []).map((name) => ({ name, isDirectory: true })),
    joinPath: (parentPath: string, childName: string) => `${parentPath}/${childName}`,
    basename: (path: string) => path.split('/').at(-1) ?? path,
    hasGitMarker: (path: string) => args.gitRepos.has(path),
    isSelectedPathGitRepo: (path: string) => args.gitRepos.has(path)
  }
}

describe('scanNestedRepos', () => {
  it('scans a plain subfolder of an enclosing repo for its own repos', async () => {
    const directories = new Map([
      ['/meta/app-a', ['api', 'web']],
      ['/meta/app-b', ['docs']]
    ])
    const filesystem = {
      ...posixTestFilesystem({
        directories,
        gitRepos: new Set(['/meta', '/meta/app-a/api', '/meta/app-a/web'])
      }),
      isSelectedPathGitRepo: () => true
    }

    const withRepos = await scanNestedRepos({ path: '/meta/app-a', filesystem })
    const withoutRepos = await scanNestedRepos({ path: '/meta/app-b', filesystem })

    expect(withRepos.selectedPathKind).toBe('non_git_folder')
    expect(withRepos.repos.map((repo) => repo.displayName)).toEqual(['api', 'web'])
    expect(withoutRepos.selectedPathKind).toBe('git_repo')
  })
})
