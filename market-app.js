
// Shineshone Market Console App
// Integrated HUD-style console for Truth Exchange

class MarketConsole {
    constructor() {
        this.map = null;
        this.h3Res = 12; // Grid Resolution
        this.selectedGrid = null; // Currently selected H3 index
        this.userLocation = null; // {lat, lng}
        this.grids = new Map(); // Store polygon instances: h3Index -> AMap.Polygon
        
        // State
        this.energy = 0;
        this.reputation = 0;
        this.currentTab = 'scanner';
        
        // DOM Elements
        this.ui = {
            energy: document.getElementById('console-energy'),
            rep: document.getElementById('console-rep'),
            pings: document.getElementById('console-pings'),
            viewport: document.getElementById('console-viewport'),
            tabs: document.querySelectorAll('.console-tab'),
            btnScan: document.getElementById('btn-scan'),
            btnTransmit: document.getElementById('btn-transmit'),
            modalCreate: document.getElementById('modal-create'),
            btnCancelCreate: document.getElementById('btn-cancel-create'),
            btnConfirmCreate: document.getElementById('btn-confirm-create'),
            inputContent: document.getElementById('create-content'),
            inputType: document.getElementById('create-type'),
            createCost: document.getElementById('create-cost')
        };

        this.init();
    }

    async init() {
        console.log('Market Console Initializing...');
        
        // 1. Init Map
        await this.initMap();
        
        // 2. Bind Events
        this.bindEvents();
        
        // 3. Load Initial Data
        this.updateBalance();
        
        // 4. Locate User
        this.locateUser();
    }

    async initMap() {
        return new Promise((resolve) => {
            AMapLoader.load({
                key: "8040299dec271ec2928477f709015d3d", // Consistent Web Key
                version: "2.0",
                plugins: ['AMap.Geolocation', 'AMap.Scale']
            }).then((AMap) => {
                this.map = new AMap.Map('market-map', {
                    viewMode: '2D', // 2D is better for grid interaction
                    zoom: 17,
                    mapStyle: 'amap://styles/dark', // Dark mode
                    center: [116.397428, 39.90923], // Default Beijing
                    pitch: 0,
                    rotateEnable: false,
                    pitchEnable: false
                });

                this.map.on('complete', () => {
                    console.log('Map Ready');
                    // Removed initial renderGridOverlay to keep map clean
                    resolve();
                });

                // Mousemove for flashlight effect
                this.map.on('mousemove', (e) => {
                    this.updateFlashlightGrids(e.lnglat);
                });
                
                this.map.on('click', (e) => {
                    // Deselect if clicking background
                    if (this.selectedGrid) {
                        // Check if click is on a grid polygon happens via polygon click handler
                        // If we click here, it might be outside any grid
                        // For now, let's keep selection if it's on a grid
                    }
                });

            }).catch(e => {
                console.error('Map Load Error:', e);
            });
        });
    }

    updateFlashlightGrids(lnglat) {
        if (!this.map || !window.h3) return;
        
        const zoom = this.map.getZoom();
        if (zoom < 15) {
            // Clear grids if zoomed out too far (except selected)
             for (const [h3Index, polygon] of this.grids) {
                if (this.selectedGrid !== h3Index) {
                    polygon.setMap(null);
                    this.grids.delete(h3Index);
                }
            }
            return;
        }

        // 1. Get Mouse H3 Cell
        const centerH3 = h3.latLngToCell(lnglat.lat, lnglat.lng, this.h3Res);
        
        // 2. Get Neighbors (Radius 3)
        let cells = [];
        try {
            cells = h3.gridDisk(centerH3, 3);
        } catch (e) {
            console.error('H3 gridDisk Error:', e);
            return;
        }

        const newGrids = new Set(cells);
        
        // 3. Remove old grids not in new set (and not selected)
        for (const [h3Index, polygon] of this.grids) {
            if (!newGrids.has(h3Index) && this.selectedGrid !== h3Index) {
                polygon.setMap(null);
                this.grids.delete(h3Index);
            }
        }
        
        // 4. Add new grids
        cells.forEach(h3Index => {
            if (!this.grids.has(h3Index)) {
                const hexBoundary = h3.cellToBoundary(h3Index);
                const path = hexBoundary.map(p => [p[1], p[0]]);
                
                const polygon = new AMap.Polygon({
                    path: path,
                    strokeColor: "#4FD1C5", // Cyan/Teal
                    strokeWeight: 1,
                    strokeOpacity: 0.3, 
                    fillColor: "#2C5282",   // Dark Blue fill
                    fillOpacity: 0.15,      // Slight fill for presence
                    zIndex: 10,
                    bubble: false,
                    cursor: 'pointer'
                });

                polygon.setMap(this.map);
                
                // Interaction
                polygon.on('click', (e) => {
                    // Stop propagation to map click
                    e.originEvent.stopPropagation(); 
                    this.selectGrid(h3Index, polygon);
                });

                this.grids.set(h3Index, polygon);
            }
        });

        // 5. Ensure selected grid stays highlighted
        if (this.selectedGrid && this.grids.has(this.selectedGrid)) {
            const p = this.grids.get(this.selectedGrid);
            p.setOptions({
                strokeOpacity: 1,
                fillOpacity: 0.3,
                strokeColor: "#FBD38D",
                strokeWeight: 2
            });
        }
    }

    renderGridOverlay() {
        // Deprecated in favor of updateFlashlightGrids
        // Kept empty or redirect to a default center view if needed
    }

    selectGrid(h3Index, polygonInstance) {
        // Deselect previous
        this.deselectGrid();

        // Select new
        this.selectedGrid = h3Index;
        // Use passed instance or find it
        const poly = polygonInstance || this.grids.get(h3Index);
        if (poly) {
            poly.setOptions({ 
                fillOpacity: 0.2,
                strokeColor: "#FBD38D", // Gold highlight
                strokeWeight: 2,
                strokeOpacity: 1
            });
        }

        console.log('Selected Grid:', h3Index);
        
        // Auto-switch to scanner and scan
        this.switchTab('scanner');
        this.scanGrid(h3Index);
    }
    
    deselectGrid() {
        if (this.selectedGrid && this.grids.has(this.selectedGrid)) {
            // Revert to flashlight style
            this.grids.get(this.selectedGrid).setOptions({ 
                fillOpacity: 0.15,
                strokeColor: "#4FD1C5",
                strokeWeight: 1,
                strokeOpacity: 0.3
            });
        }
        this.selectedGrid = null;
    }

    bindEvents() {
        // Tabs
        this.ui.tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchTab(tab.dataset.tab);
            });
        });

        // Scan Button
        this.ui.btnScan.addEventListener('click', () => {
            if (this.selectedGrid) {
                this.scanGrid(this.selectedGrid);
            } else {
                this.scanCurrentSector();
            }
        });

        // Transmit Button (Open Modal)
        this.ui.btnTransmit.addEventListener('click', () => {
            this.openCreateModal();
        });

        // Create Modal Actions
        this.ui.btnCancelCreate.addEventListener('click', () => {
            this.ui.modalCreate.classList.remove('active');
        });

        this.ui.btnConfirmCreate.addEventListener('click', () => {
            this.transmitSpark();
        });
    }

    switchTab(tabName) {
        this.currentTab = tabName;
        
        // Update UI
        this.ui.tabs.forEach(t => t.classList.remove('active'));
        document.querySelector(`.console-tab[data-tab="${tabName}"]`).classList.add('active');
        
        // Clear Viewport
        this.ui.viewport.innerHTML = '<div class="empty-state" style="padding:20px; text-align:center; color:#666">Loading...</div>';

        if (tabName === 'scanner') {
            // If grid selected, show its content, else prompt
            if (this.selectedGrid) {
                this.scanGrid(this.selectedGrid);
            } else {
                this.ui.viewport.innerHTML = '<div class="empty-state" style="padding:20px; text-align:center; color:#666">Select a Grid to Scan or Click SCAN for current location</div>';
            }
        } else if (tabName === 'portfolio') {
            this.loadPortfolio();
        }
    }

    locateUser() {
        if (!this.map) return;
        
        this.map.plugin('AMap.Geolocation', () => {
            const geolocation = new AMap.Geolocation({
                enableHighAccuracy: true,
                timeout: 10000,
                zoomToAccuracy: true,
                buttonPosition: 'RB'
            });

            this.map.addControl(geolocation);
            
            geolocation.getCurrentPosition((status, result) => {
                if (status === 'complete') {
                    this.userLocation = {
                        lat: result.position.lat,
                        lng: result.position.lng
                    };
                    console.log('User Located:', this.userLocation);
                    this.renderGridOverlay();
                } else {
                    console.error('Geolocation failed', result);
                    this.ui.viewport.innerHTML = '<div class="empty-state" style="color:red">GPS Signal Lost</div>';
                }
            });
        });
    }

    // --- Core Logic: Grid System ---


    // --- API Interactions ---

    async updateBalance() {
        try {
            const data = await CloudSync.request('/market/balance');
            if (!data.error) {
                this.energy = data.energy;
                this.reputation = data.reputation;
                this.ui.energy.innerText = Math.floor(this.energy);
                this.ui.rep.innerText = Math.floor(this.reputation);
                // Free Quota Display
                const freeQuota = 5; // Default, ideally fetch from config
                const used = data.pingsToday || 0;
                this.ui.pings.innerText = `${used}/${freeQuota}`;
                this.ui.pings.style.color = used < freeQuota ? '#68d391' : '#fc8181';
            }
        } catch (e) {
            console.error('Balance update failed', e);
        }
    }

    async scanGrid(h3Index) {
        this.ui.viewport.innerHTML = '<div class="loading">Scanning Sector...</div>';
        
        try {
            // Determine if remote
            let isRemote = false;
            if (this.userLocation) {
                const center = h3.cellToLatLng(h3Index);
                const distance = AMap.GeometryUtil.distance(
                    [this.userLocation.lng, this.userLocation.lat],
                    [center[1], center[0]]
                );
                if (distance > 500) isRemote = true;
            }

            const data = await CloudSync.request('/market/ping', 'POST', {
                location: h3Index, // Send Grid ID directly
                isRemote
            });
            
            if (data.success) {
                this.updateBalance(); // Update energy cost
                this.renderSparks(data.sparks);
            } else {
                this.ui.viewport.innerHTML = `<div class="error">Scan Failed: ${data.error}</div>`;
            }

        } catch (e) {
            this.ui.viewport.innerHTML = `<div class="error">Network Error</div>`;
            console.error(e);
        }
    }

    async scanCurrentSector() {
        if (!this.userLocation) {
            this.ui.viewport.innerHTML = '<div class="error">Waiting for GPS...</div>';
            return;
        }

        this.ui.viewport.innerHTML = '<div class="loading">Scanning Local Area...</div>';
        
        try {
            const data = await CloudSync.request('/market/ping', 'POST', {
                location: [this.userLocation.lng, this.userLocation.lat], // GeoJSON
                isRemote: false
            });

            if (data.success) {
                this.updateBalance();
                this.renderSparks(data.sparks);
            } else {
                this.ui.viewport.innerHTML = `<div class="error">${data.error}</div>`;
            }
        } catch (e) {
            console.error(e);
        }
    }

    renderSparks(sparks) {
        if (!sparks || sparks.length === 0) {
            this.ui.viewport.innerHTML = '<div class="empty-state">No Sparks found in this sector. <br>Be the first to ignite truth!</div>';
            return;
        }

        let html = '<div class="spark-list">';
        sparks.forEach(s => {
            const confidence = Math.round(s.snapshot.confidence * 100);
            const isWithered = s.status === 'WITHERED';
            html += `
                <div class="spark-item ${isWithered ? 'withered' : ''}">
                    <div class="spark-header">
                        <span class="spark-type">${s.type}</span>
                        <span class="spark-conf">${confidence}% Truth</span>
                    </div>
                    <div class="spark-content">${s.content}</div>
                    <div class="spark-actions">
                        ${isWithered ? '<span class="label-dead">WITHERED</span>' : `
                        <button onclick="app.verify('${s._id}', 'CONFIRM')">Verify</button>
                        <button onclick="app.verify('${s._id}', 'CHALLENGE')">Challenge</button>
                        `}
                    </div>
                </div>
            `;
        });
        html += '</div>';
        this.ui.viewport.innerHTML = html;
    }

    async verify(sparkId, vote) {
        // Optimistic UI update? No, wait for result.
        try {
            const data = await CloudSync.request('/market/verify', 'POST', {
                sparkId,
                vote,
                meta: {
                    userLocation: this.userLocation
                }
            });
            if (data.success) {
                // Refresh scan?
                // Or just show toast
                alert(`Vote Recorded! Reward Pool: ${data.rewardPool}`);
                // Re-scan to update UI
                if (this.selectedGrid) this.scanGrid(this.selectedGrid);
                else this.scanCurrentSector();
            } else {
                alert(data.error || 'Verification failed');
            }
        } catch (e) {
            console.error(e);
        }
    }

    // --- Create / Transmit ---

    openCreateModal() {
        this.ui.modalCreate.classList.add('active');
        // Default to selected grid or current
        // Calculate cost preview?
        this.ui.createCost.innerText = "Calculated at submission...";
    }

    async transmitSpark() {
        const content = this.ui.inputContent.value;
        const type = this.ui.inputType.value;
        
        if (!content) return alert('Content required');

        // Determine location
        let coordinates = this.userLocation ? [this.userLocation.lng, this.userLocation.lat] : [0,0];
        let h3Indices = [];
        
        if (this.selectedGrid) {
            // If grid selected, center of grid?
            // Or if user is NOT in grid, can they post there? 
            // Yes, Remote Posting (allows covering fields).
            const center = h3.cellToLatLng(this.selectedGrid);
            coordinates = [center[1], center[0]]; // [lng, lat]
            h3Indices = [this.selectedGrid];
        } else {
            // Current location -> Current Grid
            if (this.userLocation) {
                const currentH3 = h3.latLngToCell(this.userLocation.lat, this.userLocation.lng, this.h3Res);
                h3Indices = [currentH3];
            }
        }

        try {
            const data = await CloudSync.request('/market/create', 'POST', {
                coordinates,
                content,
                type,
                marketH3Indices: h3Indices
            });

            if (data.success) {
                alert(`Spark Transmitted! Energy Cost: ${data.energy}`);
                this.ui.modalCreate.classList.remove('active');
                this.ui.inputContent.value = '';
                this.updateBalance();
                // Refresh
                if (this.selectedGrid) this.scanGrid(this.selectedGrid);
                else this.scanCurrentSector();
            } else {
                alert(data.error || 'Transmission failed');
            }
        } catch (e) {
            console.error(e);
            alert('Transmission error');
        }
    }

    // --- Portfolio ---

    async loadPortfolio() {
        this.ui.viewport.innerHTML = '<div class="loading">Loading Portfolio...</div>';
        try {
            const data = await CloudSync.request('/market/portfolio');
            
            if (data.success) {
                this.renderPortfolio(data.portfolio);
            }
        } catch (e) {
            this.ui.viewport.innerHTML = '<div class="error">Failed to load portfolio</div>';
        }
    }

    renderPortfolio(portfolio) {
        // portfolio: { created: [], invested: [] }
        let html = '<div class="portfolio-section"><h3>My Sparks</h3>';
        
        if (portfolio.created.length === 0) html += '<p>No sparks created.</p>';
        else {
            portfolio.created.forEach(s => {
                 html += `<div class="portfolio-item">
                    <span>${s.content.substring(0, 20)}...</span>
                    <span>Pool: ${Math.floor(s.verifierRewardPool)}</span>
                 </div>`;
            });
        }

        html += '<h3>Investments</h3>';
        if (portfolio.invested.length === 0) html += '<p>No investments yet.</p>';
        else {
            portfolio.invested.forEach(i => {
                const spark = i.spark || {};
                const pool = Math.floor(spark.verifierRewardPool || 0);
                // Only show Harvest if there is money in the pool
                const canHarvest = pool > 0;
                
                html += `<div class="portfolio-item">
                    <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
                        <div>
                            <div style="font-weight:bold; font-size:0.9rem;">${spark.content ? spark.content.substring(0, 20) : 'Unknown'}...</div>
                            <div style="font-size:0.8rem; color:#888;">Action: <span class="${i.action.toLowerCase()}">${i.action}</span></div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-size:0.8rem; margin-bottom:4px;">Pool: ${pool}</div>
                            ${canHarvest ? 
                                `<button class="console-btn-small" onclick="app.harvest('${spark._id}')">Harvest</button>` : 
                                '<span style="font-size:0.7rem; color:#666;">Empty</span>'
                            }
                        </div>
                    </div>
                </div>`;
            });
        }
        
        html += '</div>';
        this.ui.viewport.innerHTML = html;
    }

    async harvest(sparkId) {
        try {
            const data = await CloudSync.request('/market/harvest', 'POST', { sparkId });
            
            if (data.success) {
                if (data.claimed > 0) {
                    alert(`Harvested ${data.claimed} Energy!`);
                    this.updateBalance();
                    this.loadPortfolio(); // Refresh
                } else {
                    alert('Nothing to harvest yet (Share too small or pool empty).');
                }
            } else {
                alert(data.error || 'Harvest failed');
            }
        } catch (e) {
            console.error(e);
            alert('Harvest error');
        }
    }
}

// Start App
const app = new MarketConsole();
// Expose for onclick handlers
window.app = app;
