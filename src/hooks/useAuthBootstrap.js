import { useEffect, useState, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { authStorage } from '../utils/authStorage';
import { isCapacitor } from '../utils/api';
import { clearCredentials, fetchRunnerMe, fetchUserMe } from '../Redux/authSlice';
import { setActiveChat } from '../Redux/orderSlice';
import chatStorage from '../utils/chatStorage';
import { persistor } from '../store/store';

export const useAuthBootstrap = () => {
  const dispatch = useDispatch();
  const [isReady, setIsReady] = useState(false);

  const hasBootstrapped = useRef(false);

  useEffect(() => {
    const bootstrap = async () => {
      if (hasBootstrapped.current) {
        setIsReady(true);
        return;
      }
      hasBootstrapped.current = true;

      try {
        if (isCapacitor) {
          const { accessToken, refreshToken } = await authStorage.getTokens();
          if (!accessToken && !refreshToken) {
            dispatch(clearCredentials());
            await persistor.purge();
            return;
          }
        }

        const [runnerResult, userResult] = await Promise.allSettled([
          dispatch(fetchRunnerMe()),
          dispatch(fetchUserMe()),
        ]);

        const getStatus = (result) => {
          if (result.status === 'rejected') return 'network_error';
          if (fetchRunnerMe.rejected.match(result.value) || fetchUserMe.rejected.match(result.value)) {
            // Check if it's a 401/403 vs network error
            const code = result.value?.payload?.status ?? result.value?.payload?.statusCode;
            if (code === 401 || code === 403) return 'auth_failed';
            return 'network_error'; // 500, timeout, offline, etc.
          }
          return 'ok';
        };

        const runnerStatus = getStatus(runnerResult);
        const userStatus = getStatus(userResult);

        // Only wipe if BOTH explicitly returned 401/403 — not network errors
        if (runnerStatus === 'auth_failed' && userStatus === 'auth_failed') {
          dispatch(clearCredentials());
          await persistor.purge();

          if (!isCapacitor) {
            document.cookie = 'token=; Max-Age=0; path=/';
            document.cookie = 'refreshToken=; Max-Age=0; path=/api/v1/auth/refresh-token';

            await authStorage.clearTokens();
          } else {
            await authStorage.clearTokens();
          }

          window.location.reload();
          return;
        }
        // network_error = do nothing, keep existing persisted state

        const { chatId, orderId } = await chatStorage.getActiveChat();
        if (chatId) dispatch(setActiveChat({ chatId, orderId }));

      } catch {
        // Only clear tokens on hard unexpected crash, not on network failure
        // Remove the purge here — too aggressive
        console.error('[AuthBootstrap] Unexpected bootstrap error');
      } finally {
        setIsReady(true);
      }
    };

    bootstrap();
  }, [dispatch]);

  return isReady;
};