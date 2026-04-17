import { useEffect, useState, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { authStorage } from '../utils/authStorage';
import { isCapacitor, useTokenAuth } from '../utils/api';
import { clearCredentials, fetchRunnerMe, fetchUserMe, wipeRunnerLocalStorage } from '../Redux/authSlice';
import { setActiveChat } from '../Redux/orderSlice';
import chatStorage from '../utils/chatStorage';
import { persistor } from '../store/store';
import useOrderStore from '../store/orderStore';

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
        if (useTokenAuth) {
          const { accessToken, refreshToken } = await authStorage.getTokens();
          if (!accessToken && !refreshToken) {
            dispatch(clearCredentials());
            await persistor.purge();
            setIsReady(true);
            return;
          }
        }

        const [runnerResult, userResult] = await Promise.allSettled([
          dispatch(fetchRunnerMe()),
          dispatch(fetchUserMe()),
        ]);

        const getStatus = (result) => {
          if (result.status === 'rejected') return 'network_error'; // Promise itself rejected

          const value = result.value;
          const isRejectedAction =
            fetchRunnerMe.rejected.match(value) || fetchUserMe.rejected.match(value);

          if (!isRejectedAction) return 'ok';

          const code = value?.payload?.status ?? value?.payload?.statusCode;
          console.log('[Bootstrap] getStatus — payload:', value?.payload, '| resolved code:', code);

          if (code === 401 || code === 403) return 'auth_failed';
          return 'network_error';
        };

        const runnerStatus = getStatus(runnerResult);
        const userStatus = getStatus(userResult);

        if (runnerStatus === 'auth_failed' && userStatus === 'auth_failed') {
          const runnerId = runnerResult.value?.payload?.runner?._id
            ?? (() => {
              try {
                const persisted = JSON.parse(localStorage.getItem('persist:auth') || '{}');
                return JSON.parse(persisted.runner || 'null')?._id;
              } catch { return undefined; }
            })();

          console.log('[Bootstrap] both 401 — about to wipe. persist:auth at this moment:', localStorage.getItem('persist:auth'));
          wipeRunnerLocalStorage(runnerId);
          useOrderStore.getState()._reset();
          dispatch(clearCredentials());
          console.log('[Bootstrap] after dispatch. persist:auth now:', localStorage.getItem('persist:auth'));
          await persistor.purge();
          console.log('[Bootstrap] after persistor.purge. persist:auth now:', localStorage.getItem('persist:auth'));

          if (!isCapacitor) {
            document.cookie = 'token=; Max-Age=0; path=/';
            document.cookie = 'refreshToken=; Max-Age=0; path=/';
            document.cookie = 'refreshToken=; Max-Age=0; path=/api/v1/auth/refresh-token';
            await authStorage.clearTokens();
          } else {
            await authStorage.clearTokens();
          }

          // Guard: sessionStorage survives reload() but not tab close.
          // Without this, post-reload bootstrap hits 401 again → wipes → reloads → loop.
          if (!sessionStorage.getItem('auth_cleared')) {
            sessionStorage.setItem('auth_cleared', '1');
            window.location.reload();
            return;
          }

          // Second pass after reload — everything is clean, just fall through to setIsReady
          sessionStorage.removeItem('auth_cleared');
          return;
        }

        sessionStorage.removeItem('auth_cleared');

        const { chatId, orderId } = await chatStorage.getActiveChat();
        if (chatId) dispatch(setActiveChat({ chatId, orderId }));

      } catch {
        console.error('[AuthBootstrap] Unexpected bootstrap error');
      } finally {
        setIsReady(true);
      }
    };

    bootstrap();
  }, [dispatch]);

  return isReady;
};