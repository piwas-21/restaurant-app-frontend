'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useOptionalAuth } from '@/components/AuthContext';
import { canonicalAccountPaymentActorId, resolveAccountPaymentActorId } from '@/services/accountPaymentActorService';

type AuthUser = NonNullable<NonNullable<ReturnType<typeof useOptionalAuth>>['user']>;
type ActorStatus = 'checking' | 'ready' | 'failed';

interface Resolution {
  readonly user: AuthUser | null;
  readonly status: ActorStatus;
  readonly actorId?: string;
}

export interface AccountPaymentActor {
  readonly actorId?: string;
  readonly status: ActorStatus;
  readonly retry: () => void;
}

function authActorId(user: AuthUser): { readonly actorId?: string; readonly malformed: boolean } {
  const value = user.userId;
  if (value === undefined || value === null) return { malformed: false };
  const actorId = canonicalAccountPaymentActorId(value);
  return actorId ? { actorId, malformed: false } : { malformed: true };
}

/** Resolves the backend actor for same-staff payment recovery without guessing from profile fields. */
export function useAccountPaymentActor(): AccountPaymentActor {
  const auth = useOptionalAuth();
  const user = auth?.user ?? null;
  const knownIdentity = user ? authActorId(user) : undefined;
  const [resolution, setResolution] = useState<Resolution>({ user: null, status: 'checking' });
  const [retryVersion, setRetryVersion] = useState(0);
  const generation = useRef(0);
  const currentUser = useRef(user);
  currentUser.current = user;

  useEffect(() => {
    const requestGeneration = ++generation.current;
    let cancelled = false;
    const appliesToCurrentUser = () =>
      !cancelled && generation.current === requestGeneration && currentUser.current === user;

    if (auth?.isLoading) {
      return () => {
        cancelled = true;
      };
    }

    if (!user) {
      return () => {
        cancelled = true;
      };
    }

    if (knownIdentity?.actorId) {
      return () => {
        cancelled = true;
      };
    }

    if (knownIdentity?.malformed) {
      return () => {
        cancelled = true;
      };
    }

    setResolution({ user, status: 'checking' });
    void resolveAccountPaymentActorId().then(
      (actorId) => {
        if (!appliesToCurrentUser()) return;
        setResolution(actorId ? { user, status: 'ready', actorId } : { user, status: 'failed' });
      },
      () => {
        if (appliesToCurrentUser()) setResolution({ user, status: 'failed' });
      },
    );

    return () => {
      cancelled = true;
    };
  }, [auth?.isLoading, knownIdentity?.actorId, knownIdentity?.malformed, retryVersion, user]);

  const retry = useCallback(() => setRetryVersion((value) => value + 1), []);
  if (auth?.isLoading) return { status: 'checking', retry };
  if (!user || knownIdentity?.malformed) return { status: 'failed', retry };
  if (knownIdentity?.actorId) return { actorId: knownIdentity.actorId, status: 'ready', retry };
  if (resolution.user !== user) return { status: 'checking', retry };
  return {
    actorId: resolution.status === 'ready' ? resolution.actorId : undefined,
    status: resolution.status,
    retry,
  };
}
