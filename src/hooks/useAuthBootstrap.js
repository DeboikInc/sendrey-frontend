    import { useEffect, useState } from 'react';
    import { useDispatch } from 'react-redux';
    import { authStorage } from '../utils/authStorage';
    import { isCapacitor } from '../utils/api';
    import { setCredentials, clearCredentials } from '../Redux/authSlice';
    import { setActiveChat } from '../Redux/orderSlice';
    import chatStorage from '../utils/chatStorage';
    import api from '../utils/api';

    export const useAuthBootstrap = () => {
        const dispatch = useDispatch();
        const [isReady, setIsReady] = useState(false);

        useEffect(() => {
            const bootstrap = async () => {
                try {
                    if (isCapacitor) {
                        // ── Mobile — token lives in secure storage ──────────────
                        const { accessToken, refreshToken } = await authStorage.getTokens();
                        if (!accessToken && !refreshToken) return;

                        let finalUser = null;

                        try {
                            const res = await api.get('/auth/me', { _skipInterceptor: true });
                            finalUser = res.data?.user || res.data?.runner || res.data;
                        } catch {
                            // access token expired — try refresh
                            if (!refreshToken) throw new Error('No refresh token');
                            const res = await api.post('/auth/refresh-token', { refreshToken }, { _skipInterceptor: true });
                            const newToken = res.data?.token;
                            const newRefresh = res.data?.refreshToken;
                            await authStorage.setTokens(newToken, newRefresh);

                            const meRes = await api.get('/auth/me');
                            finalUser = meRes.data?.user || meRes.data?.runner || meRes.data;
                        }

                        if (finalUser) {
                            const isRunner = finalUser.role === 'runner';
                            dispatch(setCredentials({
                                [isRunner ? 'runner' : 'user']: finalUser,
                            }));
                        }

                    } else {
                        // ── Web — token lives in HttpOnly cookie ────────────────
                        try {
                            const res = await api.get('/auth/me', { _skipInterceptor: true });
                            const finalUser = res.data?.user || res.data?.runner || res.data;

                            if (finalUser) {
                                const isRunner = finalUser.role === 'runner';
                                dispatch(setCredentials({
                                    [isRunner ? 'runner' : 'user']: finalUser,
                                }));
                            }
                        } catch {
                            // 401 means no valid cookie — user is logged out, that's fine
                            dispatch(clearCredentials());
                        }
                    }

                    // Restore active chat after successful auth
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