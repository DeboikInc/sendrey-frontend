/**
 * utils/returningUserKycUtils.js
 */

const STORAGE_KEY_PREFIX = 'returning_kyc_status_';

/**
 * Persist a returning user's kycStatus so it survives refresh.
 * Call this whenever returningUserData is set in useCredentialFlow.
 */
export function persistReturningKycStatus(email, kycStatus) {
  if (!email || !kycStatus) return;
  try {
    localStorage.setItem(
      `${STORAGE_KEY_PREFIX}${email}`,
      JSON.stringify({
        selfieVerified: kycStatus.selfieVerified ?? false,
        selfieStatus: kycStatus.selfieStatus ?? 'not_submitted',
        overallVerified: kycStatus.overallVerified ?? false,
      })
    );
  } catch (_) {}
}

/**
 * Read back a persisted returning user kycStatus.
 * Returns null if nothing was stored.
 */
export function getPersistedReturningKycStatus(email) {
  if (!email) return null;
  try {
    const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${email}`);
    return stored ? JSON.parse(stored) : null;
  } catch (_) {
    return null;
  }
}

/**
 * Clear persisted returning kyc status (call on logout/reset).
 */
export function clearPersistedReturningKycStatus(email) {
  if (!email) return;
  try {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${email}`);
  } catch (_) {}
}

/**
 * Returns true when the KYC status poll should run.
 *
 * New users (returningUserData is null): always poll.
 * Returning users who already submitted selfie: no poll.
 * Returning users who haven't submitted selfie yet: poll.
 */
export function returningUserNeedsKycPoll(returningUserData, kycStatus) {
  if (!returningUserData) return true;
  if (kycStatus.overallVerified || kycStatus.selfieVerified) return false;

  const s = returningUserData.kycStatus ?? {};
  if (
    s.selfieVerified ||
    s.overallVerified ||
    s.selfieStatus === 'pending_review' ||
    s.selfieStatus === 'approved'
  ) {
    return false;
  }

  return true;
}

/**
 * Returns true when the "documents under review" message should show.
 *
 * Uses effectiveReturningKycStatus — the caller should pass either
 * returningUserData?.kycStatus or the persisted fallback, whichever
 * is available. This way it works correctly on refresh too.
 */
export function shouldShowKycPendingMessage(effectiveReturningKycStatus, kycStatus) {
  if (kycStatus.overallVerified || kycStatus.selfieVerified) return false;

  if (effectiveReturningKycStatus) {
    const s = effectiveReturningKycStatus;
    if (
      s.selfieVerified ||
      s.overallVerified ||
      s.selfieStatus === 'pending_review' ||
      s.selfieStatus === 'approved'
    ) {
      return false;
    }
  }

  return true;
}