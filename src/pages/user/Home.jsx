import RoleSelectionScreen from "../../components/screens/RoleSelectionScreen";
import useDarkMode from "../../hooks/useDarkMode";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { verifyEmailToken } from "../../Redux/authSlice";

export const Home = () => {
    const [dark, setDark] = useDarkMode();
    const navigate = useNavigate();
    const dispatch = useDispatch();

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        let token = params.get('token');
        let inviteToken = params.get('invite');

        // strip ${ } wrapper if present (Postman/email client artifact)
        if (token?.startsWith('${')) token = token.slice(2, -1);
        if (inviteToken?.startsWith('${')) inviteToken = inviteToken.slice(2, -1);

        // ── Team invite flow ──
        if (inviteToken) {
            window.history.replaceState({}, '', '/');
            dispatch(verifyEmailToken(inviteToken))
                .unwrap()
                .then((payload) => {
                    const entityUser = payload.user || payload.runner;
                    const { invite } = payload;
                    navigate('/welcome', {
                        state: { isFromInvite: true, user: entityUser, invite },
                        replace: true,
                    });
                })
                .catch((err) => {
                    console.log('invite token error:', err);
                });
            return;
        }

        // ── Email verification flow ──
        if (!token) return;
        window.history.replaceState({}, '', '/');

        dispatch(verifyEmailToken(token))
            .unwrap()
            .then((payload) => {
                const entityUser = payload.user || payload.runner;
                const { isVerified } = payload;
                if (isVerified) {
                    navigate('/welcome', { replace: true });
                } else {
                    navigate('/auth', {
                        state: { isFromEmail: true, user: entityUser },
                        replace: true,
                    });
                }
            })
            .catch((err) => {
                console.log('verifyEmailToken error:', err);
            });
    }, [dispatch, navigate]);



    return (
        <>
            <div className={`fixed inset-0 overflow-hidden ${dark ? "dark" : ""}`}>
                <div className="w-full h-full bg-gradient-to-br from-slate-900 via-slate-950 to-black text-white">
                    <RoleSelectionScreen
                        onSelectRole={(type) => {
                            navigate("/auth", { state: { userType: "user" } });
                        }}
                        darkMode={dark}
                        toggleDarkMode={() => setDark(!dark)}

                    />
                </div>
            </div>
        </>
    )
}