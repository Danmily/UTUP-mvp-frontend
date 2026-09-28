import { useEffect, useRef } from 'react'

// Shared, scoped workspace is mounted directly in the portal, without an iframe.
export default function Audience({ mode, seed, onPermission }) {
  const host = useRef(null)
  const permission = useRef(onPermission)
  permission.current = onPermission
  useEffect(() => {
    const workspace = window.AudienceWorkspace
    workspace.mount(host.current, {
      view: mode === 'audiences' ? 'archive' : 'home',
      resume: true,
      onPortal: () => permission.current(),
    })
    if (mode === 'audience' && seed) workspace.openAsset(seed.newTask ? null : seed)
    return () => workspace.unmount()
  }, [mode, seed])
  return <div ref={host} />
}
