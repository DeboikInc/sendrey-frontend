import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { authStorage } from '../utils/authStorage';
import { setCredentials, clearCredentials, setToken } from '../Redux/authSlice';
import api from '../utils/api';

export const useAuthBootstrap = () => {
    const dispatch = useDispatch();
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        const bootstrap = async () => {
            try {
                const { accessToken, refreshToken } = await authStorage.getTokens();

                if (!accessToken && !refreshToken) return;

                try {
                    // Inject token into Redux so interceptor picks it up
                    dispatch(setToken(accessToken));

                    const res = await api.get('/auth/me');
                    const user = res.data?.user || res.data?.runner || res.data;
                    dispatch(setCredentials({ user, token: accessToken, refreshToken }));

                } catch {
                    if (!refreshToken) throw new Error('No refresh token');

                    // Inject refresh token into Redux so interceptor handles it
                    dispatch(setToken(null)); // clear stale token so 401 fires
                    
                    // Let the 401 interceptor handle the refresh automatically
                    // by retrying with the refresh token already in Redux state
                    // But Redux doesn't have refreshToken accessible yet, so set it:
                    dispatch(setCredentials({ user: null, token: null, refreshToken }));

                    const res = await api.post('/auth/refresh-token', { refreshToken });
                    const newToken = res.data?.token;
                    const newRefresh = res.data?.refreshToken;
                    const user = res.data?.user || res.data?.runner;

                    await authStorage.setTokens(newToken, newRefresh);
                    dispatch(setCredentials({ user, token: newToken, refreshToken: newRefresh }));

                    // Get fresh user data with new token
                    dispatch(setToken(newToken));
                    const meRes = await api.get('/auth/me');
                    const freshUser = meRes.data?.user || meRes.data?.runner || meRes.data;
                    dispatch(setCredentials({ user: freshUser, token: newToken, refreshToken: newRefresh }));
                }
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