let cachedConfig = null;
let fetchPromise = null;

const PEDESTRIAN_CONFIG_URL = `${process.env.REACT_APP_API_URL}/pedestrian/config`;

export async function getPedestrianConfig({ forceRefresh = false } = {}) {
    if (cachedConfig && !forceRefresh) return cachedConfig;

    if (!fetchPromise) {
        fetchPromise = fetch(PEDESTRIAN_CONFIG_URL)
            .then((res) => {
                console.log('[pedestrianConfig] status:', res.status, 'url:', res.url);
                if (!res.ok) throw new Error(`Pedestrian config fetch failed: ${res.status}`);
                if (!res.ok) throw new Error(`Pedestrian config fetch failed: ${res.status}`);
                return res.json();
            })
            .then((data) => {
                console.log('[pedestrianConfig] raw response:', data);
                cachedConfig = data.data || data;
                return data;
            })
            .finally(() => {
                fetchPromise = null;
            });
    }
    return fetchPromise;
}