// utils/htmlMarker.js
import { createRoot } from 'react-dom/client';

export const createHtmlMarker = (map, position, reactComponent, options = {}) => {
    const container = document.createElement('div');
    container.className = 'custom-map-marker';
    container.style.transform = `rotate(${options.heading || 0}deg)`;
    container.style.transition = 'transform 0.2s ease-out';
    container.style.width = `${options.size || 44}px`;
    container.style.height = `${options.size || 44}px`;
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'center';

    const root = createRoot(container);
    root.render(reactComponent);

    // Use OverlayView for HTML content
    const overlay = new window.google.maps.OverlayView();
    
    overlay.onAdd = function () {
        const pane = this.getPanes().overlayMouseTarget;
        if (pane) {
            pane.appendChild(container);
        }
    };
    
    overlay.draw = function () {
        const projection = this.getProjection();
        if (!projection) return;
        
        const point = projection.fromLatLngToDivPixel(position);
        if (point) {
            const size = options.size || 44;
            const halfSize = size / 2;
            container.style.position = 'absolute';
            container.style.left = point.x - halfSize + 'px';
            container.style.top = point.y - halfSize + 'px';
            container.style.transform = `rotate(${options.heading || 0}deg)`;
        }
    };
    
    overlay.setMap(map);

    // Store references for cleanup
    overlay._reactRoot = root;
    overlay._container = container;
    overlay._position = position;

    return overlay;
};

export const destroyHtmlMarker = (marker) => {
    if (!marker) return;
    
    try {
        // Unmount React root first
        if (marker._reactRoot) {
            marker._reactRoot.unmount();
            marker._reactRoot = null;
        }
        
        // Remove container from DOM
        if (marker._container && marker._container.parentNode) {
            marker._container.parentNode.removeChild(marker._container);
            marker._container = null;
        }
    
        if (marker.setMap) {
            marker.setMap(null);
        }
    } catch (error) {
        console.error('Error destroying marker:', error);
    }
};