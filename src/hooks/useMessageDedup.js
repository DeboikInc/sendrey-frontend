import { useRef, useCallback } from 'react';

/**
 * Single source of truth for message deduplication.
 * Tracks IDs, tempIds, and content-based fingerprints.
 */
export function useMessageDedup() {
  const seenIds = useRef(new Set());
  const seenTempIds = useRef(new Set());
  // fingerprint: type+senderId+text for system messages that arrive without stable IDs
  const seenFingerprints = useRef(new Set());

  const reset = useCallback(() => {
    seenIds.current.clear();
    seenTempIds.current.clear();
    seenFingerprints.current.clear();
  }, []);

  const markSeen = useCallback((msg) => {
    if (msg.id) seenIds.current.add(msg.id);
    if (msg.tempId) seenTempIds.current.add(msg.tempId);
    const fp = fingerprint(msg);
    if (fp) seenFingerprints.current.add(fp);
  }, []);

  const isSeen = useCallback((msg) => {
    if (msg.id && seenIds.current.has(msg.id)) return true;
    if (msg.tempId && seenTempIds.current.has(msg.tempId)) return true;
    const fp = fingerprint(msg);
    if (fp && seenFingerprints.current.has(fp)) return true;
    return false;
  }, []);

  // For replacing a temp message with its real version
  const replaceTempId = useCallback((tempId, realId) => {
    seenTempIds.current.delete(tempId);
    if (realId) seenIds.current.add(realId);
  }, []);

  return { markSeen, isSeen, replaceTempId, reset };
}

function fingerprint(msg) {
  const isSystem =
    msg.type === 'system' ||
    msg.messageType === 'system' ||
    msg.senderType === 'system' ||
    msg.senderId === 'system';

  if (!isSystem) return null;
  // Use text content as fingerprint for system messages
  // Strip trailing timestamps like "-1775405928976"
  const cleanText = (msg.text || '').replace(/-\d{10,}$/, '').trim();
  if (!cleanText) return null;
  return `system:${cleanText}`;
}