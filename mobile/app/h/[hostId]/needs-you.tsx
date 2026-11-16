import { useLocalSearchParams } from 'expo-router'
import { MobileWebShellScreen } from '../../../src/mobile-web-shell/MobileWebShellScreen'
import {
  shellScreenRoute,
  shellScreenRouteKey
} from '../../../src/mobile-web-shell/routing/shell-screen-route'
import { PageRouteUnavailableScreen } from '../../../src/mobile-web-shell/presentation/PageRouteUnavailableScreen'
import { firstParam } from '../../../src/navigation/route-param-reader'

export default function MobileNeedsYouRoute() {
  const params = useLocalSearchParams<{ hostId?: string | string[] }>()
  const hostId = firstParam(params.hostId)
  const route = hostId
    ? shellScreenRoute({ pathname: `/h/${encodeURIComponent(hostId)}/needs-you` })
    : null
  if (!route) {
    return <PageRouteUnavailableScreen hostId={hostId} />
  }
  return <MobileWebShellScreen key={shellScreenRouteKey(route)} hostId={hostId} route={route} />
}
