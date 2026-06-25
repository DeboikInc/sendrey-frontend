// hooks/useAuthBootstrap.js 

import { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { authStorage } from '../utils/authStorage';
import { isCapacitor, useTokenAuth, isMobileBrowser } from '../utils/api';
import { clearCredentials, fetchRunnerMe, fetchUserMe, wipeRunnerLocalStorage } from '../Redux/authSlice';
import { setActiveChat } from '../Redux/orderSlice';
import chatStorage from '../utils/chatStorage';
import { persistor } from '../store/store';
import useOrderStore from '../store/orderStore';

const RETRY_DELAYS = [4000, 8000, 12000];

if (!isCapacitor && !isMobileBrowser) {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}

// Helper function with retry logic
const fetchWithRetry = async (fetchFn, type, retryDelays = RETRY_DELAYS) => {
  for (let i = 0; i <= retryDelays.length; i++) {
    try {
      const result = await fetchFn();
      return { status: 'ok', data: result };
    } catch (error) {
      const status = error?.response?.status ?? error?.status;
      const isAuthError = status === 401;

      if (isAuthError) {
        return { status: 'auth_failed', data: error };
      }

      // Anything that isn't a confirmed 401 is treated as transient —
      // timeouts, connection refused, CORS, server down, etc.
      if (i < retryDelays.length) {
        console.log(`[Bootstrap] ${type} request failed (non-401), retrying in ${retryDelays[i]}ms...`, error?.message);
        await new Promise(resolve => setTimeout(resolve, retryDelays[i]));
        continue;
      }

      return { status: 'network_error', data: error };
    }
  }

  return { status: 'network_error' };
};

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
        // Determine user type from stored auth
        const storedUser = (() => {
          try {
            const persisted = JSON.parse(localStorage.getItem('persist:auth') || '{}');
            // Check runner first, then user
            const runner = JSON.parse(persisted.runner || 'null');
            const user = JSON.parse(persisted.user || 'null');
            return runner || user;
          } catch {
            return null;
          }
        })();

        const isRunnerPath = window.location.pathname.startsWith('/raw') ||
          window.location.pathname.startsWith('/profile') ||
          window.location.pathname.startsWith('/wallet') ||
          window.location.pathname.startsWith('/disputes') ||
          window.location.pathname.startsWith('/payout') ||
          window.location.pathname.startsWith('/all-orders');

        const userType = isRunnerPath || storedUser?.userType === 'runner' || storedUser?.role === 'runner'
          ? 'runner'
          : 'user';

        // Check tokens first
        if (useTokenAuth) {
          const { accessToken, refreshToken } = await authStorage.getTokens();
          if (!accessToken && !refreshToken) {
            // No tokens - clear local storage
            const runnerId = (() => {
              try {
                const persisted = JSON.parse(localStorage.getItem('persist:auth') || '{}');
                return JSON.parse(persisted.runner || 'null')?._id;
              } catch {
                return undefined;
              }
            })();

            if (runnerId) {
              wipeRunnerLocalStorage(runnerId);
              localStorage.removeItem(`bot_messages_${runnerId}`);
            }

            dispatch(clearCredentials());
            localStorage.removeItem('auth_cleared');
            await persistor.purge();
            setIsReady(true);
            return;
          }
        }

        // Fetch user data based on type - only fetch the correct one
        let fetchResult;

        if (userType === 'runner') {
          fetchResult = await fetchWithRetry(() => dispatch(fetchRunnerMe()).unwrap(), 'runner');
        } else {
          fetchResult = await fetchWithRetry(() => dispatch(fetchUserMe()).unwrap(), 'user');
        }

        // Handle network errors
        if (fetchResult.status === 'network_error') {
          console.warn('[Bootstrap] server unreachable after retries — proceeding anyway');
          setIsReady(true);
          return;
        }

        // Handle auth failures (dead tokens)
        if (fetchResult.status === 'auth_failed') {
          const id = userType === 'runner'
            ? fetchResult.data?.payload?.runner?._id
            : fetchResult.data?.payload?.user?._id;

          if (userType === 'runner' && id) {
            wipeRunnerLocalStorage(id);
            localStorage.removeItem(`bot_messages_${id}`);
          }

          useOrderStore.getState()._reset();
          dispatch(clearCredentials());
          await persistor.purge();

          // Clear cookies
          if (!isCapacitor) {
            document.cookie = 'token=; Max-Age=0; path=/';
            document.cookie = 'refreshToken=; Max-Age=0; path=/';
            document.cookie = 'refreshToken=; Max-Age=0; path=/api/v1/auth/refresh-token';
          }

          await authStorage.clearTokens();

          // Prevent reload loop
          if (!localStorage.getItem('auth_cleared')) {
            localStorage.setItem('auth_cleared', '1');
            window.location.reload();
            return;
          }
          localStorage.removeItem('auth_cleared');

          const dest = userType === 'runner' ? '/raw' : '/';
          if (window.location.pathname !== dest) {
            window.location.href = dest;
            return;
          }

          setIsReady(true);
          return;
        }

        // Cleanup flags
        sessionStorage.removeItem('auth_cleared');
        localStorage.removeItem('auth_cleared');

        // Restore active chat
        const { chatId, orderId } = await chatStorage.getActiveChat();
        if (chatId) dispatch(setActiveChat({ chatId, orderId }));

      } catch (err) {
        console.error('[AuthBootstrap] Unexpected bootstrap error:', err);
      } finally {
        setIsReady(true);
      }
    };

    bootstrap();
  }, [dispatch]);

  return isReady;
};