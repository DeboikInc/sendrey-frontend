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
        console.log('[AuthBootstrap] Already bootstrapped, skipping');
        setIsReady(true);
        return;
      }

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

        const runnerRejected =
          runnerResult.status === 'fulfilled' &&
          fetchRunnerMe.rejected.match(runnerResult.value);

        const userRejected =
          userResult.status === 'fulfilled' &&
          fetchUserMe.rejected.match(userResult.value);

        // Both 401 — no valid session at all, wipe everything
        if (runnerRejected && userRejected) {
          dispatch(clearCredentials());
          await persistor.purge();
          if (!isCapacitor) {
            document.cookie = 'token=; Max-Age=0; path=/';
            document.cookie = 'refreshToken=; Max-Age=0; path=/api/v1/auth/refresh-token';
          } else {
            await authStorage.clearTokens();
          }
        }

        const { chatId, orderId } = await chatStorage.getActiveChat();
        if (chatId) dispatch(setActiveChat({ chatId, orderId }));

      } catch {
        await authStorage.clearTokens();
        dispatch(clearCredentials());
        await persistor.purge();
      } finally {
        setIsReady(true);
      }
    };

    bootstrap();
  }, [dispatch]);

  return isReady;
};