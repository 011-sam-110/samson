// src/components/CloudSync.jsx
// Headless: keeps a signed-in user's state mirrored to the cloud. Deliberately uses
// only the store's PUBLIC api (useStore + actions.importData) so it needs no changes
// to store.js. Guests render nothing and stay on localStorage.
import { useEffect, useRef } from 'react'
import { useStore } from '../store/store.js'
import { useAuth } from '../lib/auth-context.jsx'
import { pullState, pushState } from '../lib/sync.js'

export default function CloudSync() {
  const { user } = useAuth()
  const { state, actions } = useStore()
  const base = useRef(null) // last updatedAt we've seen from the server
  const hydrated = useRef(false)
  const timer = useRef(null)

  // On sign-in: pull the cloud copy (cloud wins), or seed it with local/guest data
  // if this is a brand-new account.
  useEffect(() => {
    if (!user) {
      hydrated.current = false
      base.current = null
      return
    }
    let alive = true
    ;(async () => {
      try {
        const cloud = await pullState()
        if (!alive) return
        if (cloud && cloud.state) {
          base.current = cloud.updatedAt
          actions.importData(cloud.state)
        } else {
          const res = await pushState(state, null) // first push imports guest data
          if (alive && res && res.updatedAt) base.current = res.updatedAt
        }
      } catch {
        /* offline or not authed — stay on localStorage */
      } finally {
        if (alive) hydrated.current = true
      }
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // On change: debounce, then push. On a 409 (a newer version elsewhere), pull and
  // adopt the cloud copy rather than clobber it.
  useEffect(() => {
    if (!user || !hydrated.current) return
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      try {
        const res = await pushState(state, base.current)
        if (res && res.conflict) {
          const cloud = await pullState()
          if (cloud && cloud.state) {
            base.current = cloud.updatedAt
            actions.importData(cloud.state)
          }
        } else if (res && res.updatedAt) {
          base.current = res.updatedAt
        }
      } catch {
        /* keep local; retry on next change */
      }
    }, 1200)
    return () => clearTimeout(timer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, user])

  return null
}
