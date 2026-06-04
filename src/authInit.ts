import { getRedirectResult } from 'firebase/auth';
import { auth } from './firebase';

let redirectResultPromise: Promise<void> | null = null;

/** Resolves once per page load; safe to await from multiple callers (e.g. Strict Mode). */
export function waitForAuthRedirectResult(): Promise<void> {
  if (!redirectResultPromise) {
    redirectResultPromise = getRedirectResult(auth).then(result => {
      if (result?.user) {
        console.log(
          'OAuth redirect sign-in completed:',
          result.user.email ?? result.user.uid,
        );
      }
    });
  }
  return redirectResultPromise;
}
