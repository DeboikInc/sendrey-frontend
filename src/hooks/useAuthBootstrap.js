import { useEffect, useState, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { authStorage } from '../utils/authStorage';
import { isCapacitor, useTokenAuth, isMobileBrowser } from '../utils/api';
import { clearCredentials, fetchRunnerMe, fetchUserMe, wipeRunnerLocalStorage } from '../Redux/authSlice';
import { setActiveChat } from '../Redux/orderSlice';
import chatStorage from '../utils/chatStorage';
import { persistor } from '../store/store';
import useOrderStore from '../store/orderStore';

const RETRY_DELAYS = [4000, 8000, 12000];
const sleep = (ms) => new Promise(res => setTimeout(res, ms));

const getStatus = (result) => {
  if (result.status === 'rejected') return 'network_error';
  const value = result.value;
  const isRejected = fetchRunnerMe.rejected.match(value) || fetchUserMe.rejected.match(value);
  if (!isRejected) return 'ok';
  const code = value?.payload?.status ?? value?.payload?.statusCode;
  if (code === 401 || code === 403) return 'auth_failed';
  return 'network_error';
};

if (!isCapacitor && !isMobileBrowser) {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}

const tryFetchWithRetry = async (dispatch) => {
  let lastRunnerResult, lastUserResult;

  for (let i = 0; i <= RETRY_DELAYS.length; i++) {
    const [runnerResult, userResult] = await Promise.allSettled([
      dispatch(fetchRunnerMe()),
      dispatch(fetchUserMe()),
    ]);

    lastRunnerResult = runnerResult;
    lastUserResult = userResult;

    const runnerStatus = getStatus(runnerResult);
    const userStatus = getStatus(userResult);

    // At least one succeeded — done
    if (runnerStatus === 'ok' || userStatus === 'ok') {
      return { runnerResult, userResult, runnerStatus, userStatus };
    }

    // Network error — retry with backoff
    if (runnerStatus === 'network_error' || userStatus === 'network_error') {
      if (i < RETRY_DELAYS.length) {
        console.log(`[Bootstrap] network error, retrying in ${RETRY_DELAYS[i]}ms...`);
        await sleep(RETRY_DELAYS[i]);
        continue;
      }
      // All retries exhausted — don't wipe, just proceed
      return { runnerResult, userResult, runnerStatus: 'network_error', userStatus: 'network_error' };
    }

    // Both 401 — wait once before declaring dead (catches hot reload)
    if (runnerStatus === 'auth_failed' && userStatus === 'auth_failed') {
      if (i < 2) {
        const delay = i === 0 ? 5000 : 10000;
        console.log(`[Bootstrap] both 401 — waiting ${delay}ms before retry ${i + 1}...`);
        await sleep(delay);
        continue;
      }
      // Still 401 after retry — genuinely dead
      return { runnerResult, userResult, runnerStatus, userStatus };
    }
  }

  // Fallback — should never reach here
  return {
    runnerResult: lastRunnerResult,
    userResult: lastUserResult,
    runnerStatus: getStatus(lastRunnerResult),
    userStatus: getStatus(lastUserResult),
  };
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
        if (useTokenAuth) {
          const { accessToken, refreshToken } = await authStorage.getTokens();
          if (!accessToken && !refreshToken) {
            dispatch(clearCredentials());
            await persistor.purge();
            setIsReady(true);
            return;
          }
        }


        const { runnerResult, runnerStatus, userStatus } =
          await tryFetchWithRetry(dispatch);

        // Server unreachable after all retries — don't wipe, let them proceed
        if (runnerStatus === 'network_error' && userStatus === 'network_error') {
          console.warn('[Bootstrap] server unreachable after retries — proceeding anyway');
          setIsReady(true);
          return;
        }

        // Genuinely dead tokens
        if (runnerStatus === 'auth_failed' && userStatus === 'auth_failed') {
          const runnerId = runnerResult.value?.payload?.runner?._id
            ?? (() => {
              try {
                const persisted = JSON.parse(localStorage.getItem('persist:auth') || '{}');
                return JSON.parse(persisted.runner || 'null')?._id;
              } catch { return undefined; }
            })();

          wipeRunnerLocalStorage(runnerId);
          useOrderStore.getState()._reset();
          dispatch(clearCredentials());
          await persistor.purge();

          if (!isCapacitor) {
            document.cookie = 'token=; Max-Age=0; path=/';
            document.cookie = 'refreshToken=; Max-Age=0; path=/';
            document.cookie = 'refreshToken=; Max-Age=0; path=/api/v1/auth/refresh-token';
            await authStorage.clearTokens();
          } else {
            await authStorage.clearTokens();
          }

          if (!localStorage.getItem('auth_cleared')) {
            localStorage.setItem('auth_cleared', '1');
            window.location.reload();
            return;
          }
          localStorage.removeItem('auth_cleared');

          setIsReady(true);
          return;
        }

        sessionStorage.removeItem('auth_cleared');
        localStorage.removeItem('auth_cleared');

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