import { createContext, useContext, useMemo, useState } from 'react'

/* Documentation routes keep the previous article mounted while the next one is
   fetched, so the page itself has no visible loading state to show. Routes
   publish their background loading here and the app shell renders a slim
   progress bar at the top of the viewport. */
const noop = () => {}
const RouteProgressContext = createContext({ loading: false, setLoading: noop })

export function RouteProgressProvider({ children }) {
  const [loading, setLoading] = useState(false)
  const value = useMemo(() => ({ loading, setLoading }), [loading])
  return (
    <RouteProgressContext.Provider value={value}>
      {children}
    </RouteProgressContext.Provider>
  )
}

export function useRouteProgress() {
  return useContext(RouteProgressContext)
}
