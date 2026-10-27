const RELEASE_REPOSITORY = ORCA_RELEASE_REPOSITORY
const RELEASE_PATH_PATTERN = RELEASE_REPOSITORY.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')

export const RELEASES_URL = `https://github.com/${RELEASE_REPOSITORY}/releases`

// Global flag for matchAll, which clones the pattern, so sharing it is safe.
export const RELEASE_TAG_HREF_PATTERN = new RegExp(
  `href="https://github\\.com/${RELEASE_PATH_PATTERN}/releases/tag/([^"]+)"`,
  'g'
)

export const RELEASE_TAG_PATH_PATTERN = new RegExp(
  `^/${RELEASE_PATH_PATTERN}/releases/tag/([^/]+)$`
)

export const RELEASE_DOWNLOAD_URL_PATTERN = new RegExp(
  `^https://github\\.com/${RELEASE_PATH_PATTERN}/releases/download/`,
  'i'
)
