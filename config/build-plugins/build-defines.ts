import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const requireFromRoot = createRequire(resolve('package.json'))

// Dark-build switches plus the release repository the updater reads (forks set it).
export const BUILD_DEFINES: Record<string, string> = {
  ...requireFromRoot('./config/dark-build-switches.cjs').darkBuildDefines(),
  ...requireFromRoot('./config/release-distribution.cjs').resolveReleaseDistributionDefines()
}
