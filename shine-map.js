
class ShineMapManager {
    constructor() {
        this.isTracking = false;
        this.watchId = null;
        this.lastPos = null; // { lat, lng, time }
        this.stationaryStartTime = null;
        this.pendingPulses = new Map(); // Key: gridId, Value: { lat, lng, type, intensity, floor }
        this.map = null;
        this.polygons = []; // Store AMap.Polygon instances
        this.livePolygons = []; // Store instant feedback polygons
        this.currentLocationMarker = null; // Pulsing marker for current location
        this.isMapVisible = false;
        
        // Config
        this.FLUSH_INTERVAL = 60000; // 60s
        this.RESTING_THRESHOLD_MS = 10 * 1000; // 10s (Demo Mode)
        this.SPEED_THRESHOLD = 0.5; // m/s
        this.STATIONARY_RADIUS = 100; // meters (Extreme Tolerance)
    }

    init(map) {
        this.map = map;
        this.loadConfig(); // Load dynamic config from admin
        this.startCircuitBreaker();
        // Load existing map data if visible
        if (this.isMapVisible) {
            this.refreshMap();
        }
    }

    async loadConfig() {
        try {
            const res = await fetch('/api/shine-config');
            if (res.ok) {
                const config = await res.json();
                console.log('[ShineMap] Config loaded:', config);
                
                if (config.restingThresholdMs) this.RESTING_THRESHOLD_MS = config.restingThresholdMs;
                if (config.stationaryRadius) this.STATIONARY_RADIUS = config.stationaryRadius;
                if (config.speedThreshold) this.SPEED_THRESHOLD = config.speedThreshold;
                
                // If flush interval changed, restart the circuit breaker
                if (config.flushInterval && config.flushInterval !== this.FLUSH_INTERVAL) {
                    this.FLUSH_INTERVAL = config.flushInterval;
                    this.startCircuitBreaker();
                }
            }
        } catch (e) {
            console.warn('[ShineMap] Failed to load config, using defaults', e);
        }
    }

    toggleLayer(visible) {
        this.isMapVisible = visible;
        if (visible) {
            this.refreshMap();
            // Start auto-refresh loop for view
            this.refreshTimer = setInterval(() => this.refreshMap(), 30000);
            
            // Re-render live path if exists
            this.renderLivePath();
            
            // Also render pending pulses (not yet uploaded) to avoid gaps
            this.pendingPulses.forEach(pulse => {
                this.addLivePulse(pulse.lat, pulse.lng, pulse.intensity, pulse.type);
            });
        } else {
            this.clearMap();
            if (this.refreshTimer) clearInterval(this.refreshTimer);
        }
    }

    startTracking() {
        if (this.isTracking) return;
        
        if (!navigator.geolocation) {
            console.error("Geolocation not supported");
            return;
        }

        this.isTracking = true;
        this.watchId = navigator.geolocation.watchPosition(
            (pos) => this.handlePosition(pos),
            (err) => console.error("Geo Error:", err),
            { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
        );
        
        this.startHeartbeat(); // Start resting heartbeat
        console.log("ShineMap Tracking Started (Silent Mode)");
    }

    stopTracking() {
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
        if (this.heartbeatId) clearInterval(this.heartbeatId);
        this.isTracking = false;
    }

    startHeartbeat() {
        if (this.heartbeatId) clearInterval(this.heartbeatId);
        this.heartbeatId = setInterval(() => {
            this.checkHeartbeat();
        }, 1000);
    }

    checkHeartbeat() {
        if (!this.isTracking || !this.lastPos || !this.stationaryStartTime) return;
        
        const now = Date.now();
        // If we have been stationary long enough...
        if (now - this.stationaryStartTime > this.RESTING_THRESHOLD_MS) {
             // ...we should emit resting energy even if no GPS event fires.
             
             // 1. Visual Feedback
             if (this.isMapVisible && this.map) {
                 this.addLivePulse(this.lastPos.lat, this.lastPos.lng, 5, 'resting');
             }
             
             // 2. Data Accumulation (Circuit Breaker)
             const latKey = Math.round(this.lastPos.lat * 10000);
             const lngKey = Math.round(this.lastPos.lng * 10000);
             const gridId = `${latKey}_${lngKey}`;
             
             // Reuse pending logic roughly
             if (this.pendingPulses.has(gridId)) {
                 const existing = this.pendingPulses.get(gridId);
                 existing.intensity += 5; 
                 existing.type = 'resting';
             } else {
                 // If not in map (flushed?), add back
                 // Note: Floor might be missing if we don't store it in lastPos. 
                 // It's fine, default to 0.
                 this.pendingPulses.set(gridId, {
                     lat: this.lastPos.lat,
                     lng: this.lastPos.lng,
                     type: 'resting',
                     intensity: 5,
                     floor: 0
                 });
             }
        }
    }

    handlePosition(pos) {
        const { latitude: lat, longitude: lng, altitude, speed } = pos.coords;
        const now = Date.now();

        // 1. Calculate derived speed if null (some browsers don't return speed)
        let currentSpeed = speed;
        if (currentSpeed === null && this.lastPos) {
            const dist = this.getDistance(this.lastPos.lat, this.lastPos.lng, lat, lng);
            const timeDiff = (now - this.lastPos.time) / 1000; // seconds
            if (timeDiff > 0) currentSpeed = dist / timeDiff;
            else currentSpeed = 0;
        }
        if (currentSpeed === null) currentSpeed = 0;

        // 2. Resting Logic (Geofence Strategy)
        let type = 'path';
        let intensity = 1;
        let isWithinGeofence = false;

        if (this.stationaryAnchor) {
            const dist = this.getDistance(this.stationaryAnchor.lat, this.stationaryAnchor.lng, lat, lng);
            if (dist < this.STATIONARY_RADIUS) {
                isWithinGeofence = true;
            }
        }

        if (isWithinGeofence) {
            // Continued stationary
            if (now - this.stationaryStartTime > this.RESTING_THRESHOLD_MS) {
                type = 'resting';
                intensity = 5; // Higher energy for resting
            }
        } else {
            // Moved out of range or first point
            this.stationaryAnchor = { lat, lng };
            this.stationaryStartTime = now;
        }

        // 3. Circuit Breaker: Local Aggregation
        // Grid Key (approx 11m)
        const latKey = Math.round(lat * 10000);
        const lngKey = Math.round(lng * 10000);
        const gridId = `${latKey}_${lngKey}`;

        // Floor Estimate (Barometer not avail in web usually, use altitude if accurate, else 0)
        // Note: altitude is often null or inaccurate on web. We leave it as undefined for now unless valid.
        const floor = altitude ? Math.floor(altitude / 3) : 0; // Rough estimate 3m per floor

        if (this.pendingPulses.has(gridId)) {
            const existing = this.pendingPulses.get(gridId);
            existing.intensity += intensity;
            if (type === 'resting') existing.type = 'resting'; // Upgrade type
        } else {
            this.pendingPulses.set(gridId, {
                lat, lng, type, intensity, floor
            });
        }

        this.lastPos = { lat, lng, time: now };
        
        // 4. Instant Feedback (Live Painting)
        if (this.isMapVisible && this.map) {
            this.updateCurrentLocation(lat, lng);
            this.addLivePulse(lat, lng, intensity, type);
        }
    }

    startCircuitBreaker() {
        if (this.flushIntervalId) clearInterval(this.flushIntervalId);
        this.flushIntervalId = setInterval(() => {
            this.flushPulses();
        }, this.FLUSH_INTERVAL);
    }

    async flushPulses() {
        if (this.pendingPulses.size === 0) return;

        const pulses = Array.from(this.pendingPulses.values());
        this.pendingPulses.clear(); // Clear immediately to avoid double send

        console.log(`[Circuit Breaker] Flushing ${pulses.length} aggregated light points...`);

        try {
            // Retrieve token (reuse logic from home.js)
            let token = sessionStorage.getItem('hkwl_auth_token');
            if (window.CloudSync && window.CloudSync.getToken) {
                token = window.CloudSync.getToken();
            }

            if (!token) return; // Silent fail if no auth

            const res = await fetch('/api/shine/pulse', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token
                },
                body: JSON.stringify({ pulses })
            });
            
            if (!res.ok) throw new Error(res.statusText);
            console.log("[Circuit Breaker] Upload success. Light added to the world.");

        } catch (e) {
            console.error("[Circuit Breaker] Upload failed, data lost (privacy design):", e);
            // We intentionally DO NOT retry. If it fails, the data evaporates. 
            // This is part of the "Circuit Breaker" philosophy - no persistent logs of failed uploads.
        }
    }

    // --- Visualization ---

    async refreshMap() {
        if (!this.map || !this.isMapVisible) return;

        const bounds = this.map.getBounds();
        const north = bounds.northeast.lat;
        const south = bounds.southwest.lat;
        const east = bounds.northeast.lng;
        const west = bounds.southwest.lng;

        try {
            const res = await fetch(`/api/shine/map?north=${north}&south=${south}&east=${east}&west=${west}`);
            const data = await res.json();
            
            if (data.success) {
                this.renderGrids(data.cells);
                // Restore live paths on top of new grid data
                this.renderLivePath();
            }
        } catch (e) {
            console.error("Fetch ShineMap failed:", e);
        }
    }

    renderGrids(cells) {
        // Clear old polygons? Or diff them? 
        // For simplicity: clear all and redraw. (Optimize later)
        this.clearMap();

        if (!window.AMap) return;

        cells.forEach(cell => {
            // Calculate color based on energy/type
            let fillColor = '#3b82f6'; // Default Blue (Path)
            if (cell.stats.resting > cell.stats.passing) {
                fillColor = '#f59e0b'; // Amber (Resting)
            }
            if (cell.floors && Object.keys(cell.floors).length > 2) {
                 fillColor = '#ef4444'; // Red (High-rise/Stacking)
            }

            // Opacity based on energy (cap at 0.8)
            const opacity = Math.min(0.2 + (cell.energy / 100), 0.8);

            // Create Hexagon/Square approximation
            // Since we used rounding 10000, size is approx 0.0001 deg (~11m)
            const d = 0.00005;
            const path = [
                [cell.center.lng - d, cell.center.lat - d],
                [cell.center.lng + d, cell.center.lat - d],
                [cell.center.lng + d, cell.center.lat + d],
                [cell.center.lng - d, cell.center.lat + d]
            ];

            const polygon = new AMap.Polygon({
                path: path,
                strokeColor: fillColor,
                strokeWeight: 0,
                fillColor: fillColor,
                fillOpacity: opacity,
                zIndex: 50,
                bubble: true // Allow events to pass through?
            });

            polygon.setMap(this.map);
            this.polygons.push(polygon);
            
            // Optional: Click to see "Memory"
            polygon.on('click', () => {
                new AMap.InfoWindow({
                    content: `<div style="padding:5px;font-size:12px;">
                        <b>Shine Node</b><br>
                        Energy: ${cell.energy}<br>
                        Vibe: ${cell.stats.resting > cell.stats.passing ? 'Chill (Resting)' : 'Flow (Passing)'}
                    </div>`,
                    offset: new AMap.Pixel(0, -10)
                }).open(this.map, [cell.center.lng, cell.center.lat]);
            });
        });
    }

    clearMap() {
        if (this.polygons) {
            this.map.remove(this.polygons);
            this.polygons = [];
        }
        if (this.livePolygons) {
            this.map.remove(this.livePolygons);
            // Don't clear array, just remove from map, so we can re-add on toggle
        }
        if (this.currentLocationMarker) {
            this.map.remove(this.currentLocationMarker);
            this.currentLocationMarker = null;
        }
    }

    // --- Live Feedback Methods ---

    updateCurrentLocation(lat, lng) {
        if (!this.map || !window.AMap) return;

        // Draw a pulsing marker for "Me"
        if (!this.currentLocationMarker) {
            this.currentLocationMarker = new AMap.Marker({
                position: [lng, lat],
                content: `
                    <div style="
                        width: 20px; height: 20px;
                        background: #3b82f6;
                        border-radius: 50%;
                        box-shadow: 0 0 15px #3b82f6;
                        border: 2px solid white;
                        animation: pulse-ring 2s infinite;
                    "></div>
                    <style>
                        @keyframes pulse-ring {
                            0% { transform: scale(0.8); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); }
                            70% { transform: scale(1.1); box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); }
                            100% { transform: scale(0.8); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
                        }
                    </style>
                `,
                offset: new AMap.Pixel(-10, -10),
                zIndex: 100
            });
            this.currentLocationMarker.setMap(this.map);
        } else {
            this.currentLocationMarker.setPosition([lng, lat]);
        }
        
        // Center map if tracking (optional, maybe too aggressive)
        // this.map.setCenter([lng, lat]);
    }

    addLivePulse(lat, lng, intensity, type) {
        if (!this.map || !window.AMap) return;

        // Draw a temporary polygon for immediate feedback
        const d = 0.00005;
        const path = [
            [lng - d, lat - d],
            [lng + d, lat - d],
            [lng + d, lat + d],
            [lng - d, lat + d]
        ];

        const fillColor = type === 'resting' ? '#f59e0b' : '#3b82f6';
            const opacity = 0.6; // Slightly brighter for live
            const zIndex = type === 'resting' ? 100 : 60; // Resting on top

            const polygon = new AMap.Polygon({
                path: path,
                strokeColor: fillColor,
                strokeWeight: 0,
                fillColor: fillColor,
                fillOpacity: opacity,
                zIndex: zIndex
            });

        polygon.setMap(this.map);
        this.livePolygons.push(polygon);
        
        // Keep only last 50 live points to prevent memory leak before refresh
        if (this.livePolygons.length > 50) {
            const old = this.livePolygons.shift();
            this.map.remove(old);
        }
    }
    
    renderLivePath() {
        if (!this.map || !this.isMapVisible) return;
        this.livePolygons.forEach(p => p.setMap(this.map));
        if (this.currentLocationMarker) this.currentLocationMarker.setMap(this.map);
    }

    getDistance(lat1, lng1, lat2, lng2) {
        const R = 6371e3; // metres
        const φ1 = lat1 * Math.PI/180;
        const φ2 = lat2 * Math.PI/180;
        const Δφ = (lat2-lat1) * Math.PI/180;
        const Δλ = (lng2-lng1) * Math.PI/180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return R * c;
    }
}

// Export instance
window.ShineMap = new ShineMapManager();
