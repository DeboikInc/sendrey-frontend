import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { authStorage } from '../utils/authStorage';
import { setCredentials, clearCredentials, setToken } from '../Redux/authSlice';
import { setActiveChat } from '../Redux/orderSlice'
import chatStorage from '../utils/chatStorage';
import api from '../utils/api';

export const useAuthBootstrap = () => {
    const dispatch = useDispatch();
    const [isReady, setIsReady] = useState(false);


    useEffect(() => {
        const bootstrap = async () => {
            try {
                const { accessToken, refreshToken } = await authStorage.getTokens();
                if (!accessToken && !refreshToken) return;

                let finalToken = accessToken;
                let finalRefresh = refreshToken;
                let finalUser = null;

                try {
                    dispatch(setToken(accessToken));
                    const res = await api.get('/auth/me');
                    finalUser = res.data?.user || res.data?.runner || res.data;

                } catch {
                    if (!refreshToken) throw new Error('No refresh token');

                    const res = await api.post('/auth/refresh-token', { refreshToken });
                    finalToken = res.data?.token;
                    finalRefresh = res.data?.refreshToken;

                    await authStorage.setTokens(finalToken, finalRefresh);
                    dispatch(setToken(finalToken));

                    const meRes = await api.get('/auth/me');
                    finalUser = meRes.data?.user || meRes.data?.runner || meRes.data;
                }

                // Always dispatch credentials after successful auth
                dispatch(setCredentials({ user: finalUser, token: finalToken, refreshToken: finalRefresh }));

                // Always restore active chat after successful auth
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