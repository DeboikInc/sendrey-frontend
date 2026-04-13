import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { authStorage } from '../utils/authStorage';
import { isCapacitor } from '../utils/api';
import { clearCredentials, fetchRunnerMe, fetchUserMe } from '../Redux/authSlice';
import { setActiveChat } from '../Redux/orderSlice';
import chatStorage from '../utils/chatStorage';

export const useAuthBootstrap = () => {
  const dispatch = useDispatch();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        if (isCapacitor) {
          const { accessToken, refreshToken } = await authStorage.getTokens();
          if (!accessToken && !refreshToken) {
            dispatch(clearCredentials());
            return;
          }
        }

        await Promise.allSettled([
          dispatch(fetchRunnerMe()),
          dispatch(fetchUserMe()),
        ]);

        const { chatId, orderId } = await chatStorage.getActiveChat();
        if (chatId) dispatch(setActiveChat({ chatId, orderId }));

      } catch {
        await authStorage.clearTokens();
        dispatch(clearCredentials());
      } finally {
        setIsReady(true);
      }
    };

    bootstrap();
  }, [dispatch]);

  return isReady;
};