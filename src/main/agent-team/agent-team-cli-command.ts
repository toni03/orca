import { getAppEnvironment, hasAppEnvironment } from '../../shared/app-environment'
import { prependOrcaCliDirToChildPath } from '../cli/orca-cli-child-path'

/** This app's own CLI launcher; agent CLIs may rebuild PATH and reach another Orca install. */
export function resolveAgentTeamCliCommand(): string | null {
  if (!hasAppEnvironment()) {
    return null
  }
  const app = getAppEnvironment()
  return prependOrcaCliDirToChildPath(
    {},
    {
      isPackaged: app.isPackaged(),
      userDataPath: app.getPath('userData'),
      resourcesPath: process.resourcesPath ?? null
    }
  )
}
