import { useState } from 'react'

/** How the Team page shows the Manager chat: hidden, beside the board, or alone in place of it. */
export type TeamManagerView = 'closed' | 'docked' | 'expanded'

const VIEW_KEY = 'orca.agentTeam.managerView'

function readManagerView(): TeamManagerView {
  try {
    const stored = window.localStorage.getItem(VIEW_KEY)
    if (stored === 'docked' || stored === 'expanded') {
      return stored
    }
  } catch {
    // Private windows and blocked storage open with the Manager hidden.
  }
  return 'closed'
}

/** The Manager view as the user last left it on this machine. */
export function useTeamManagerView(): [TeamManagerView, (view: TeamManagerView) => void] {
  const [view, setView] = useState(readManagerView)
  const update = (next: TeamManagerView): void => {
    setView(next)
    try {
      window.localStorage.setItem(VIEW_KEY, next)
    } catch {
      // The view still changes; it just is not remembered.
    }
  }
  return [view, update]
}
