import { useEffect, useState } from 'react';

// Retain a closing surface just long enough to finish its exit transition.
export function usePresence(open: boolean) {
  const [retained, setRetained] = useState(open);
  useEffect(() => {
    if (open) { setRetained(true); return; }
    const timer = setTimeout(() => setRetained(false), 140);
    return () => clearTimeout(timer);
  }, [open]);
  return { rendered: open || retained, leaving: !open };
}
