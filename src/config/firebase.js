import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
    apiKey: "AIzaSyB25zioy2uYOixC3CkGpqHRxAxChPL62bM",
    authDomain: "sendrey-cb4e6.firebaseapp.com",
    projectId: "sendrey-cb4e6",
    storageBucket: "sendrey-cb4e6.firebasestorage.app",
    messagingSenderId: "160371187185",
    appId: "1:160371187185:web:b282e7657aeb7079b4b850",
    // measurementId: "G-JMGWS9QRCT"
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

export { messaging, getToken, onMessage };