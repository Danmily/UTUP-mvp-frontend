import { useEffect, useRef } from 'react'

// Shared, scoped workspace is mounted directly in the portal, without an iframe.
// portal: { tagState(tagId), applyTags(tagIds) } lets the agent check tag permissions
// and hand missing tags to the market's pending list.
export default function Audience({ mode, seed, onPermission, onMarket, portal }) {
  const host = useRef(null)
  const permission = useRef(onPermission)
  permission.current = onPermission
  const bridge = useRef(portal)
  bridge.current = portal
  const market = useRef(onMarket)
  market.current = onMarket
  useEffect(() => {
    const workspace = window.AudienceWorkspace
    workspace.mount(host.current, {
      view: mode === 'audiences' ? 'archive' : 'home',
      resume: true,
      onPortal: () => permission.current(),
      onMarket: () => market.current?.(),
      portal: {
        tagState: (id) => bridge.current?.tagState(id),
        applyTags: (ids) => bridge.current?.applyTags(ids),
      },
    })
    if (mode === 'audience' && seed) workspace.openAsset(seed.newTask ? null : seed)
    return () => workspace.unmount()
  }, [mode, seed])
  return <div ref={host} />
}
