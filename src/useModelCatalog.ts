import { useCallback, useEffect, useRef, useState } from 'react';
import * as bridge from './bridge';
import type { CatalogSnapshot, ConnectionProfile, Model, ProfileStatus } from './types';
import { friendlyError } from './connections';

const pending = new Map<string, Promise<Model[]>>();
function load(profile: ConnectionProfile) {
  const key = JSON.stringify([profile.id, profile.provider, profile.endpoint]);
  let task = pending.get(key);
  if (!task) {
    task = bridge.models(profile.provider, profile.endpoint, profile.id).finally(() => pending.delete(key));
    pending.set(key, task);
  }
  return task;
}
export function matchingCatalog(profile: ConnectionProfile | undefined, cache: CatalogSnapshot | undefined): Model[] {
  return profile && cache?.provider === profile.provider && cache.endpoint === profile.endpoint ? cache.models : [];
}
export function useModelCatalog(profile: ConnectionProfile | undefined, cache: CatalogSnapshot | undefined, onSnapshot: (id: string, value: CatalogSnapshot) => void, epoch: number) {
  const identity = JSON.stringify([profile?.id, profile?.provider, profile?.endpoint]);
  const [catalogState, setCatalog] = useState({ identity, models: matchingCatalog(profile, cache) });
  const catalog = catalogState.identity === identity ? catalogState.models : matchingCatalog(profile, cache);
  const [status, setStatus] = useState<ProfileStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ReturnType<typeof friendlyError> | null>(null);
  const sequence = useRef(0);
  const latest = useRef({ profile, cache, onSnapshot });
  latest.current = { profile, cache, onSnapshot };
  const refresh = useCallback(async () => {
    const { profile: target, onSnapshot: save } = latest.current;
    if (!target || !bridge.desktop) return;
    const ticket = ++sequence.current;
    const targetIdentity = JSON.stringify([target.id, target.provider, target.endpoint]);
    setLoading(true); setError(null);
    try {
      const info = await bridge.profileStatus(target);
      if (ticket !== sequence.current) return;
      setStatus(info);
      const ready = target.provider === 'chatgpt' ? info.connected && info.planUsage : info.hasKey && info.endpointMatches;
      if (!ready) { setCatalog({identity: targetIdentity, models: []}); return; }
      const models = await load(target);
      if (ticket !== sequence.current) return;
      setCatalog({identity: targetIdentity, models});
      save(target.id, { provider: target.provider, endpoint: target.endpoint, models, updatedAt: Date.now() });
    } catch (e) {
      if (ticket === sequence.current) setError(friendlyError(e));
    } finally {
      if (ticket === sequence.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    setCatalog({identity: JSON.stringify([latest.current.profile?.id, latest.current.profile?.provider, latest.current.profile?.endpoint]), models: matchingCatalog(latest.current.profile, latest.current.cache)});
    setStatus(null); setError(null);
    void refresh();
    return () => { sequence.current++; };
  }, [profile?.id, profile?.provider, profile?.endpoint, epoch, refresh]);
  return { catalog, status, loading, error, refresh };
}
