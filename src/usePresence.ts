import { useEffect, useState } from 'react';

// Retain a closing surface just long enough to finish its exit transition.
export function usePresence(open: boolean, duration=140) {
  const [retained, setRetained] = useState(open);
  useEffect(() => {
    if (open) { setRetained(true); return; }
    const timer = setTimeout(() => setRetained(false), duration);
    return () => clearTimeout(timer);
  }, [open,duration]);
  return { rendered: open || retained, leaving: !open };
}
