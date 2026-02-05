
class ShineMapManager {
    constructor() {
        this.isTracking = false;
        this.isAdmin = false; // Admin status for debug features
        this.watchId = null;
        this.lastPos = null; // { lat, lng, time }
        this.stationaryStartTime = null;
        this.stationaryEnergyEmitted = 0; // Track accumulated energy for current session (Exact Integral)
        this.pendingPulses = new Map(); // Key: gridId, Value: { lat, lng, type, intensity, floor }
        this.map = null;
        this.polygons = []; // Store AMap.Polygon instances
        this.livePolygons = []; // Store instant feedback polygons
        this.effectMarkers = []; // Store visual effect markers
        this.currentLocationMarker = null; // Pulsing marker for current location
        this.isMapVisible = false;
        
        // Social Physics Modules
        this.vectorField = new VectorField();
        // this.particleSystem = null; 
        this.lastRefreshTime = 0;

        // Config
        this.FLUSH_INTERVAL = 5000; // 5s (More aggressive for feedback)
        this.RESTING_THRESHOLD_MS = 10 * 1000; // 10s (Demo Mode)
        this.SPEED_THRESHOLD = 0.5; // m/s
        this.STATIONARY_RADIUS = 100; // meters (Extreme Tolerance)

        // Timeline Configuration (Visual Editor)
        this.timelineConfig = []; 
        this.loadTimelineConfig(); // Load immediately

        // --- SOCIAL PHYSICS ENGINE (Scientific Model) ---
        // Based on Alex Pentland's Social Physics (Exploration vs Engagement)
        // and Barabási's Human Mobility Scaling Laws (Nature, 2008)
        this.PHYSICS = {
            baseWeightPassing: 1.0,    // Base energy unit
            baseWeightResting: 5.0,    // Normalized target for 1 min resting
            
            // 1. Exploration Premium (Scarcity)
            // Based on Information Theory: Surprise = -log(P). 
            // Visiting rare places adds more entropy/value to the system.
            crowdDamping: 0.1,         
            silenceBonus: 0.2,         

            // 2. Dwell Time Power Law (Retention)
            // Human dwelling time follows a Power Law distribution: P(t) ~ t^(-beta)
            // where beta is approx 1.8 (Barabási et al.).
            // To incentivize rare long-stays, Value(t) should scale inversely to Probability.
            // Value(t) ~ t^(1.5) (Conservative scaling, slightly below 1.8 to prevent gaming)
            dwellPowerExponent: 1.5    
        };

        // Visual Config (Default)
        this.COLOR_PATH = { hue: 200, sat: 80 }; // Blue
        this.COLOR_RESTING = { hue: 340, sat: 80 }; // Pink/Red
        this.LIGHTNESS_RANGE = { min: 40, max: 70 };
        this.OPACITY_RANGE = { min: 0.2, max: 0.8 };

        // Dynamic Rendering Params (New)
        this.DYNAMIC_PARAMS = {
            vitalityDecayRate: 0.9,
            lambdaRoadMax: 0.3,
            lambdaHomeMin: 0.7,
            hueRoad: 180,
            hueHub: 35,
            hueHome: 250
        };

        this.displayMode = 'classic'; // 'classic', 'cycle', 'realtime'
        this.vectorMode = true; // Toggle for vector flow vs static blink
        this.dataScope = 'world'; // 'world' or 'me'
        this.activeMapStyle = 'amap://styles/dark'; // Default map style
        
        // Visual Effects Config
        this.breathingEnabled = localStorage.getItem('shine_breathing_enabled') !== 'false'; // Default true
        this.breathingFrameId = null;

        this.injectStyles();
    }

    injectStyles() {
        const styleId = 'shine-map-effects';
        if (document.getElementById(styleId)) return;

        const css = `
            /* Console Panel */
            .shine-console-panel {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%) scale(0.95);
                width: 90%;
                max-width: 600px;
                height: 80vh;
                background: rgba(10, 10, 15, 0.95);
                border: 1px solid rgba(0, 255, 200, 0.3);
                border-radius: 12px;
                box-shadow: 0 0 40px rgba(0, 255, 200, 0.1);
                display: flex;
                flex-direction: column;
                z-index: 3000;
                color: #0ff;
                font-family: 'Courier New', monospace;
                opacity: 0;
                pointer-events: none;
                transition: all 0.3s ease;
                backdrop-filter: blur(20px);
            }
            .shine-console-panel.active {
                opacity: 1;
                pointer-events: auto;
                transform: translate(-50%, -50%) scale(1);
            }
            .console-header {
                padding: 15px;
                border-bottom: 1px solid rgba(0, 255, 200, 0.2);
                display: flex;
                justify-content: space-between;
                align-items: center;
                background: rgba(0, 255, 200, 0.05);
            }
            .console-title { font-weight: bold; letter-spacing: 2px; text-transform: uppercase; }
            .console-close { cursor: pointer; color: #0ff; background: none; border: none; font-size: 20px; }
            .console-tabs {
                display: flex;
                border-bottom: 1px solid rgba(0, 255, 200, 0.2);
            }
            .console-tab {
                flex: 1;
                padding: 12px;
                text-align: center;
                cursor: pointer;
                border-right: 1px solid rgba(0, 255, 200, 0.1);
                transition: background 0.2s;
                opacity: 0.6;
            }
            .console-tab:hover { background: rgba(0, 255, 200, 0.1); opacity: 0.8; }
            .console-tab.active { background: rgba(0, 255, 200, 0.15); opacity: 1; font-weight: bold; }
            .console-content { flex: 1; overflow-y: auto; padding: 20px; }
            .console-section { display: none; }
            .console-section.active { display: block; }
            .console-input-group { margin-bottom: 20px; }
            .console-label { display: block; margin-bottom: 8px; opacity: 0.8; font-size: 12px; }
            .console-input { 
                width: 100%; background: rgba(0,0,0,0.5); border: 1px solid rgba(0, 255, 200, 0.3); 
                color: #fff; padding: 8px; font-family: 'Courier New', monospace; 
            }
            .console-editor {
                width: 100%;
                height: 300px;
                background: #050508;
                border: 1px solid #333;
                color: #aaddff;
                padding: 15px;
                font-family: 'Consolas', 'Monaco', monospace;
                font-size: 13px;
                line-height: 1.5;
                resize: none;
                outline: none;
            }
            .console-editor:focus { border-color: #0ff; }
            .console-footer {
                padding: 15px;
                border-top: 1px solid rgba(0, 255, 200, 0.2);
                display: flex;
                justify-content: flex-end;
                gap: 10px;
            }
            .console-btn {
                background: rgba(0, 255, 200, 0.1);
                border: 1px solid rgba(0, 255, 200, 0.5);
                color: #0ff;
                padding: 8px 20px;
                cursor: pointer;
                font-family: 'Courier New', monospace;
                transition: all 0.2s;
            }
            .console-btn:hover { background: rgba(0, 255, 200, 0.3); box-shadow: 0 0 10px rgba(0, 255, 200, 0.4); }
            
            @keyframes shine-flow-dust {
                0% { opacity: 0; transform: translateX(-5px) scale(0.5); }
                30% { opacity: 0.8; transform: translateX(0px) scale(1); }
                100% { opacity: 0; transform: translateX(15px) scale(0.2); }
            }
            @keyframes shine-blink {
                0%, 100% { opacity: 0.3; transform: scale(0.8); }
                50% { opacity: 0.9; transform: scale(1.2); }
            }
            .shine-effect-container {
                position: relative;
                width: 0; height: 0;
                overflow: visible;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            /* Flow Particle */
            .shine-flow-wrapper {
                position: absolute;
                width: 0; height: 0;
                pointer-events: none;
                /* Rotation will be applied inline */
            }
            .shine-dust {
                position: absolute;
                width: 6px; height: 6px;
                border-radius: 50%;
                background: radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 70%);
                animation: shine-flow-dust 2s infinite linear;
                margin-top: -3px; /* Center vertically */
                margin-left: -3px; /* Center horizontally */
            }
            .shine-blink {
                position: absolute;
                width: 6px; height: 6px;
                border-radius: 50%;
                background: radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 70%);
                animation: shine-blink 3s infinite ease-in-out;
                margin-top: -3px;
                margin-left: -3px;
            }

            .shine-separator {
                width: 1px;
                background: rgba(255,255,255,0.2);
                margin: 0 4px;
            }

            /* Mode Controls */
            .shine-mode-controls {
                position: absolute;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 1000;
                display: flex;
                background: rgba(0, 0, 0, 0.6);
                backdrop-filter: blur(10px);
                padding: 4px;
                border-radius: 20px;
                border: 1px solid rgba(255, 255, 255, 0.1);
            }
            .shine-mode-btn {
                padding: 6px 16px;
                font-size: 12px;
                color: rgba(255, 255, 255, 0.7);
                cursor: pointer;
                border-radius: 16px;
                transition: all 0.3s ease;
                font-family: 'Inter', sans-serif;
                font-weight: 500;
            }
            .shine-mode-btn.active {
                background: rgba(255, 255, 255, 0.2);
                color: #fff;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            }
            .shine-mode-btn:hover:not(.active) {
                background: rgba(255, 255, 255, 0.1);
                color: #fff;
            }
            
            /* Popover Settings */
            .timeline-popover {
                position: absolute;
                background: rgba(10, 15, 20, 0.95);
                border: 1px solid rgba(0, 255, 200, 0.4);
                border-radius: 8px;
                padding: 12px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6);
                z-index: 4000;
                width: 220px;
                display: none;
                backdrop-filter: blur(10px);
            }
            .timeline-popover.active { display: block; }
            .popover-arrow {
                position: absolute;
                bottom: -6px;
                left: 50%;
                transform: translateX(-50%);
                width: 10px; height: 10px;
                background: rgba(10, 15, 20, 0.95);
                border-right: 1px solid rgba(0, 255, 200, 0.4);
                border-bottom: 1px solid rgba(0, 255, 200, 0.4);
                transform: translateX(-50%) rotate(45deg);
            }
            .popover-row { display: flex; align-items: center; margin-bottom: 10px; gap: 8px; }
            .popover-label { font-size: 11px; color: #aaa; width: 40px; }
            
            /* Visual Timeline Bar - Enhanced Design */
            .timeline-visual-container {
                display: flex;
                align-items: stretch;
                width: 100%;
                height: 50px;
                /* Tech Hexagon Background (SVG Data URI) */
                background-color: rgba(10, 15, 20, 0.6);
                background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='49' viewBox='0 0 28 49'%3E%3Cg fill-rule='evenodd'%3E%3Cg id='hexagons' fill='%2300ffcc' fill-opacity='0.1' fill-rule='nonzero'%3E%3Cpath d='M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.9v12.7l10.99 6.34 11-6.35V17.9l-11-6.34L3 17.9zM0 15l12.98-7.5V0h-2v6.35L0 12.69v2.3zm0 18.5L12.98 41v8h-2v-6.85L0 35.81v-2.3zM15 0v7.5L27.99 15H28v-2.31h-.01L17 6.35V0h-2zm0 49v-8l12.99-7.5H28v2.31h-.01L17 42.15V49h-2z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
                border-radius: 25px; /* Pill shape */
                position: relative;
                margin-top: 25px;
                margin-bottom: 25px;
                border: 1px solid rgba(0, 255, 200, 0.3);
                box-shadow: 0 0 20px rgba(0, 255, 200, 0.05), inset 0 0 10px rgba(0,0,0,0.5);
                overflow: visible; /* Allow handles to protrude */
                box-sizing: border-box;
            }
            .timeline-segment-bar {
                position: relative;
                height: 100%;
                cursor: pointer;
                transition: all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
                min-width: 40px;
                box-sizing: border-box;
                border-right: 1px solid rgba(255,255,255,0.15); /* Solid thin line for cleaner cut */
            }
            .timeline-segment-bar:first-child { border-top-left-radius: 24px; border-bottom-left-radius: 24px; }
            .timeline-segment-bar.last { border-top-right-radius: 24px; border-bottom-right-radius: 24px; flex-grow: 1; border-right: none; }
            
            .timeline-segment-bar:hover { 
                filter: brightness(1.2) contrast(1.1); 
                z-index: 5;
                box-shadow: 0 0 15px rgba(0,255,255,0.3);
                /* Removed scaleY to fix "uneven" feeling, using shadow/brightness instead */
            }
            
            .timeline-node-handle {
                position: absolute;
                right: -10px;
                top: -30px;
                width: 40px; /* Hit area */
                height: 80px; /* Extend down through bar */
                display: flex;
                flex-direction: column;
                align-items: center;
                z-index: 20;
                cursor: col-resize;
                pointer-events: none; /* Let clicks pass to sub-elements */
            }
            /* Make the hit area interactable */
            .timeline-node-handle > * { pointer-events: auto; }

            .timeline-node-line {
                width: 1px;
                height: 100%;
                background: linear-gradient(to bottom, rgba(0,255,255,0), #0ff, rgba(0,255,255,0));
                opacity: 0.3;
            }
            .timeline-node-label {
                background: rgba(10, 20, 30, 0.9);
                border: 1px solid rgba(0,255,255,0.3);
                color: #0ff;
                font-size: 10px;
                padding: 3px 6px;
                border-radius: 10px;
                white-space: nowrap;
                font-family: 'Consolas', monospace;
                box-shadow: 0 2px 8px rgba(0,0,0,0.5);
                transition: all 0.2s;
                margin-bottom: 2px;
            }
            .timeline-node-label:hover {
                background: #0ff;
                color: #000;
                transform: scale(1.1);
                box-shadow: 0 0 10px #0ff;
            }

            @keyframes shine-panel-in {
                from { opacity: 0; transform: scale(0.95) translateY(-10px); }
                to { opacity: 1; transform: scale(1) translateY(0); }
            }
            .shine-me-panel h3 { margin: 0 0 16px 0; font-size: 16px; font-weight: 600; letter-spacing: -0.02em; }
            .panel-section { margin-bottom: 16px; }
            .panel-section label { display: block; font-size: 12px; opacity: 0.6; margin-bottom: 6px; }
            .panel-section input { 
                width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); 
                color: #fff; padding: 8px 12px; border-radius: 8px; font-size: 14px;
                transition: all 0.2s;
            }
            .panel-section input:focus { outline: none; border-color: rgba(255,255,255,0.3); background: rgba(255,255,255,0.1); }
            .panel-actions { display: flex; flex-direction: column; gap: 10px; margin-top: 24px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 20px; }
            .panel-header { display: flex; justify-content: space-between; align-items: center; }
            #close-me-panel { background: none; border: none; color: rgba(255,255,255,0.5); font-size: 24px; cursor: pointer; line-height: 1; padding: 0; }
            #close-me-panel:hover { color: #fff; }
        `;
        const style = document.createElement('style');
        style.id = styleId;
        style.type = 'text/css';
        style.appendChild(document.createTextNode(css));
        document.head.appendChild(style);
    }

    injectConsole() {
        if (document.querySelector('.shine-console-panel')) return;

        const div = document.createElement('div');
        div.className = 'shine-console-panel';
        div.innerHTML = `
            <div class="console-header">
                <div class="console-title">Shine Console // Me</div>
                <div class="console-mode-switch" style="display:flex; gap:10px; margin-left:20px;">
                    <button class="console-tab active" data-view="timeline">Timeline</button>
                    <button class="console-tab" data-view="manage" style="color:#ff5050;">Manage</button>
                </div>
                <button class="console-close">&times;</button>
            </div>

            <!-- View: Timeline Editor -->
            <div class="console-view active" id="view-timeline" style="padding: 20px; overflow-y: auto;">
                <p style="font-size:12px; color:#aaa; margin-bottom:15px;">
                    Visual Timeline Editor: Click segments to edit style or split. Click markers to edit duration.
                </p>
                <div id="timeline-editor-container"></div>
                
                <div style="margin-top:15px; display:flex; align-items:center; gap:10px; background:rgba(0,255,200,0.05); padding:10px; border-radius:8px;">
                    <input type="checkbox" id="chk-breathing" ${this.breathingEnabled ? 'checked' : ''} style="accent-color:#00ffcc; width:16px; height:16px; cursor:pointer;">
                    <label for="chk-breathing" style="color:#0ff; font-size:12px; cursor:pointer; user-select:none;">Enable Fluorescent Breathing (Visual FX)</label>
                </div>

                <div style="margin-top:30px; border-top:1px solid rgba(0,255,200,0.2); padding-top:20px;">
                    <button class="console-btn" id="btn-save-timeline">Save & Apply Changes</button>
                </div>
            </div>

            <!-- View: Manage (Data) -->
            <div class="console-view" id="view-manage" style="display:none; padding: 20px;">
                <div class="console-section active" style="display:block;">
                    <h3 style="margin-top:0; color:#ff5050;">Data Management</h3>
                    <p style="font-size:12px; opacity:0.7; margin-bottom:20px;">Manage your personal map data here. Actions are irreversible.</p>
                    
                    <div class="console-input-group">
                        <label class="console-label" style="color:#ffa500;">Cycle Mode Data</label>
                        <button class="console-btn" id="btn-reset-cycle" style="width:100%; border-color:#ff5050; color:#ff5050;">重置周期 (Reset Cycle)</button>
                        <p style="font-size:10px; opacity:0.5; margin-top:5px;">Deletes only the current active cycle data.</p>
                    </div>

                    <div class="console-input-group" style="margin-top:30px;">
                        <label class="console-label" style="color:#ff0000;">All Map Data</label>
                        <button class="console-btn" id="btn-wipe-all" style="width:100%; background:rgba(255,0,0,0.2); border-color:#ff0000; color:#ff0000; font-weight:bold;">清除所有数据 (Clear All)</button>
                        <p style="font-size:10px; opacity:0.5; margin-top:5px;">Deletes ALL data including archived history (Classic Mode).</p>
                    </div>
                </div>
            </div>
        `;

        // Close
        div.querySelector('.console-close').onclick = () => this.toggleConsole(false);

        // View Switching
        div.querySelectorAll('.console-mode-switch .console-tab').forEach(btn => {
            btn.onclick = () => {
                div.querySelectorAll('.console-mode-switch .console-tab').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                const view = btn.dataset.view;
                div.querySelectorAll('.console-view').forEach(v => v.style.display = 'none');
                div.querySelector('#view-' + view).style.display = 'block';
            };
        });

        // Timeline Actions
        // div.querySelector('#btn-add-segment').onclick = () => this.addTimelineSegment(); // Deprecated
        div.querySelector('#btn-save-timeline').onclick = () => this.saveTimelineConfig();
        
        // Breathing Toggle
        const chkBreathing = div.querySelector('#chk-breathing');
        if (chkBreathing) {
            chkBreathing.onchange = (e) => this.toggleBreathing(e.target.checked);
        }

        // Data Actions
        div.querySelector('#btn-reset-cycle').onclick = () => this.resetMeData();
        div.querySelector('#btn-wipe-all').onclick = () => this.wipeMeData();

        document.body.appendChild(div);
        
        // Initial Render
        this.renderTimelineEditor();
    }

    // --- TIMELINE EDITOR LOGIC (VISUAL) ---

    loadTimelineConfig() {
        const saved = localStorage.getItem('shine_timeline_config');
        if (saved) {
            try {
                this.timelineConfig = JSON.parse(saved);
            } catch (e) {
                console.error("Timeline config corrupted", e);
                this.timelineConfig = [];
            }
        }
        
        // Default if empty
        if (!this.timelineConfig || this.timelineConfig.length === 0) {
            this.timelineConfig = [
                { maxMinutes: 10, color: '#ffff00', opacity: 0.4 },
                { maxMinutes: 60, color: '#ffa500', opacity: 0.6 },
                { maxMinutes: -1, color: '#ff0000', opacity: 0.8 } // -1 = Infinity
            ];
        }
    }

    saveTimelineConfig() {
        localStorage.setItem('shine_timeline_config', JSON.stringify(this.timelineConfig));
        
        if (typeof HKWL !== 'undefined' && HKWL.showToast) {
            HKWL.showToast("Timeline Updated", "success");
        }
        
        // Re-render editor to update visual widths/labels if changed
        this.renderTimelineEditor();
        
        // Refresh Map with new styles
        this.refreshMap();
    }

    renderTimelineEditor() {
        const container = document.getElementById('timeline-editor-container');
        if (!container) return;
        
        container.innerHTML = '';
        
        // 1. Create Visual Bar Container
        const barContainer = document.createElement('div');
        barContainer.className = 'timeline-visual-container';
        
        let prevMax = 0;
        
        // 2. Render Segments
        this.timelineConfig.forEach((seg, index) => {
            const isLast = index === this.timelineConfig.length - 1;
            
            // Calculate visual width
            // Since time is non-linear (10m vs 5h vs Infinity), we use a pseudo-scale
            // Simple approach: Base width + log scale of duration? 
            // Or just fixed flex for finite, flex-grow for infinity.
            
            const el = document.createElement('div');
            el.className = 'timeline-segment-bar' + (isLast ? ' last' : '');
            el.style.backgroundColor = seg.color;
            el.style.opacity = seg.opacity;
            
            // Width Logic:
            // Give finite segments some width so they are clickable
            // Give Infinity the rest
            if (!isLast) {
                // Heuristic: 10m -> small, 1h -> medium
                // Just uniform for now to ensure usability? 
                // Let's try proportional but clamped.
                const duration = seg.maxMinutes - prevMax;
                let flex = Math.max(1, Math.log10(duration)); 
                el.style.flex = `${flex} 0 auto`;
                el.style.width = '100px'; // Min width fallback
            } else {
                el.style.flex = '10 1 auto'; // Infinity takes remaining space
            }
            
            // Interaction: Click to Edit
            el.onclick = (e) => {
                e.stopPropagation();
                this.openSegmentPopover(index, el);
            };
            
            // Node Handle (The "Cutter")
            if (!isLast) {
                // CAPTURE prevMax CORRECTLY FOR THE CLOSURE
                const currentStart = prevMax; 

                const handle = document.createElement('div');
                handle.className = 'timeline-node-handle';
                handle.innerHTML = `
                    <div class="timeline-node-label" title="Click to Edit Time">${this.formatDuration(seg.maxMinutes)}</div>
                    <div class="timeline-node-line"></div>
                `;
                // Click label to edit time
                handle.querySelector('.timeline-node-label').onclick = (e) => {
                    e.stopPropagation();
                    const newTime = prompt(`Adjust duration boundary (${this.formatDuration(currentStart)} ~ ?)`, seg.maxMinutes);
                    if (newTime && !isNaN(newTime)) {
                        const val = parseInt(newTime);
                        
                        // Get valid bounds
                        const lowerBound = currentStart;
                        const upperBound = (index === this.timelineConfig.length - 2) ? Infinity : this.timelineConfig[index+1].maxMinutes;

                        if (val > lowerBound && (upperBound === Infinity || val < upperBound)) {
                            seg.maxMinutes = val;
                            this.saveTimelineConfig();
                        } else {
                            alert(`Invalid time: Must be between ${this.formatDuration(lowerBound)} and ${upperBound === Infinity ? 'Infinity' : this.formatDuration(upperBound)}.`);
                        }
                    }
                };
                el.appendChild(handle);
            }
            
            // Tooltip on Hover
            el.title = `${this.formatDuration(prevMax)} ~ ${isLast ? '∞' : this.formatDuration(seg.maxMinutes)}`;
            
            barContainer.appendChild(el);
            if (!isLast) prevMax = seg.maxMinutes;
        });
        
        container.appendChild(barContainer);
        
        // 3. Add "Popover" Container if not exists
        if (!document.getElementById('timeline-popover')) {
            const pop = document.createElement('div');
            pop.id = 'timeline-popover';
            pop.className = 'timeline-popover';
            pop.innerHTML = `
                <div class="popover-arrow"></div>
                <div class="popover-content"></div>
            `;
            document.body.appendChild(pop);
            
            // Close when clicking outside
            document.addEventListener('click', (e) => {
                if (!pop.contains(e.target) && !e.target.closest('.timeline-segment-bar')) {
                    pop.classList.remove('active');
                }
            });
        }
    }

    formatDuration(mins) {
        if (mins < 60) return mins + 'm';
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return m > 0 ? `${h}h${m}m` : `${h}h`;
    }

    openSegmentPopover(index, targetEl) {
        const pop = document.getElementById('timeline-popover');
        const content = pop.querySelector('.popover-content');
        const seg = this.timelineConfig[index];
        const isLast = index === this.timelineConfig.length - 1;
        
        content.innerHTML = `
            <div style="margin-bottom:10px; font-size:12px; color:#fff; border-bottom:1px solid #333; padding-bottom:5px;">
                <strong>Segment ${index + 1}</strong> 
                <span style="color:#aaa;">(${targetEl.title})</span>
            </div>
            
            <div class="popover-row">
                <span class="popover-label">Color</span>
                <input type="color" id="pop-color" value="${seg.color}" style="border:none; width:30px; height:30px; cursor:pointer; background:none;">
            </div>
            
            <div class="popover-row">
                <span class="popover-label">Opacity</span>
                <input type="range" id="pop-opacity" min="0" max="1" step="0.1" value="${seg.opacity}" style="flex:1;">
                <span id="pop-opacity-val" style="font-size:11px; width:25px;">${seg.opacity}</span>
            </div>
            
            <div style="margin-top:15px; display:flex; gap:10px;">
                <button id="btn-split-segment" class="console-btn" style="flex:1; font-size:11px; padding:4px;">✂ Split</button>
                ${!isLast ? `<button id="btn-merge-segment" class="console-btn" style="flex:1; font-size:11px; padding:4px; border-color:#ff5050; color:#ff5050;">🗑 Merge</button>` : ''}
            </div>
        `;
        
        // Bind Events
        const colorIn = content.querySelector('#pop-color');
        const opIn = content.querySelector('#pop-opacity');
        const opVal = content.querySelector('#pop-opacity-val');
        
        colorIn.oninput = () => {
            seg.color = colorIn.value;
            targetEl.style.backgroundColor = seg.color; // Live preview
        };
        colorIn.onchange = () => this.saveTimelineConfig(); // Commit
        
        opIn.oninput = () => {
            opVal.innerText = opIn.value;
            seg.opacity = parseFloat(opIn.value);
            targetEl.style.opacity = seg.opacity; // Live preview
        };
        opIn.onchange = () => this.saveTimelineConfig(); // Commit
        
        content.querySelector('#btn-split-segment').onclick = () => {
            // Logic to split: Insert a new node halfway
            let start = 0;
            if (index > 0) start = this.timelineConfig[index - 1].maxMinutes;
            
            let end = seg.maxMinutes;
            let newMax;
            
            if (end === -1) {
                // Splitting infinity: Default to start + 1 hour (or 10m if start is 0)
                newMax = start + 60; 
            } else {
                newMax = Math.floor(start + (end - start) / 2);
                if (newMax <= start) newMax = start + 1; // Min 1 min
            }
            
            const newSeg = { 
                maxMinutes: newMax, 
                color: seg.color, 
                opacity: seg.opacity 
            };
            
            // Insert AT current index (pushing current back)
            // Actually, if we split [0~10], we want [0~5] and [5~10].
            // Current segment is [0~10].
            // If we insert newSeg [0~5] at index, the old one becomes [5~10] (retaining its end max).
            this.timelineConfig.splice(index, 0, newSeg);
            this.saveTimelineConfig();
            pop.classList.remove('active');
        };
        
        if (content.querySelector('#btn-merge-segment')) {
            content.querySelector('#btn-merge-segment').onclick = () => {
                // Remove current segment, effectively merging its range into the NEXT one
                // (Since the previous max stays same, but this max is gone, so next one extends to prev max... wait)
                // If we have A(10) -> B(20) -> C(inf)
                // Remove A: B now covers 0~20. Correct.
                this.timelineConfig.splice(index, 1);
                this.saveTimelineConfig();
                pop.classList.remove('active');
            };
        }

        // Positioning
        pop.classList.add('active');
        const rect = targetEl.getBoundingClientRect();
        const popRect = pop.getBoundingClientRect();
        
        pop.style.top = (rect.bottom + 10) + 'px'; // Below bar
        pop.style.left = (rect.left + rect.width / 2 - popRect.width / 2) + 'px';
    }

    // (Old method removed/replaced)
    addTimelineSegment() {} 
    removeTimelineSegment(index) {}

    toggleConsole(show) {
        const panel = document.querySelector('.shine-console-panel');
        if (!panel) this.injectConsole();
        
        // Wait for DOM
        setTimeout(() => {
            const p = document.querySelector('.shine-console-panel');
            if (show) p.classList.add('active');
            else p.classList.remove('active');
        }, 10);
    }


    // User scripts removed in favor of Timeline Editor


    injectModeControls() {
        if (document.querySelector('.shine-mode-controls')) return;

        const div = document.createElement('div');
        div.className = 'shine-mode-controls';
        div.innerHTML = `
            <div class="shine-mode-btn active" data-scope="world">World</div>
            <div class="shine-mode-btn" data-scope="me">Me</div>
            <div class="shine-mode-btn" data-action="settings" title="Personal Settings" style="display:none; padding: 6px 10px;">⚙️</div>
            <div class="shine-separator"></div>
            
            <div class="shine-mode-btn active" data-mode="classic">Classic</div>
            <div class="shine-mode-btn" data-mode="cycle">Cycle</div>
            <div class="shine-mode-btn" data-mode="realtime">Live</div>
            <div class="shine-separator"></div>
            <div class="shine-mode-btn active" data-action="toggle-vector" title="Toggle Vector Flow">Vector</div>
        `;
        
        div.querySelectorAll('.shine-mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.target;
                
                // Handle Settings
                if (target.dataset.action === 'settings') {
                    this.toggleConsole(true);
                    return;
                }

                // Handle Vector Toggle
                if (target.dataset.action === 'toggle-vector') {
                    this.vectorMode = !this.vectorMode;
                    if (this.vectorMode) target.classList.add('active');
                    else target.classList.remove('active');
                    this.refreshMap();
                    return;
                }

                // Handle Scope Switch
                const scope = target.dataset.scope;
                if (scope) {
                    this.setScope(scope);
                    div.querySelectorAll('.shine-mode-btn[data-scope]').forEach(b => b.classList.remove('active'));
                    target.classList.add('active');
                    return;
                }

                // Handle Mode Switch
                const mode = target.dataset.mode;
                if (mode) {
                    this.setMode(mode);
                    // Update UI for modes only
                    div.querySelectorAll('.shine-mode-btn[data-mode]').forEach(b => b.classList.remove('active'));
                    target.classList.add('active');
                }
            });
        });

        // Append to map overlay if available, otherwise body
        const overlay = document.getElementById('shine-map-overlay');
        if (overlay) {
            overlay.appendChild(div);
            // Adjust style for embedded look if needed, but absolute bottom is fine for now
        } else {
            document.body.appendChild(div);
        }

        // Force UI update to match current scope
        this.updateUI();
    }

    updateUI() {
        const scope = this.dataScope;
        
        // Update Homepage Buttons
        document.querySelectorAll('.scope-btn').forEach(btn => {
            if (btn.dataset.scope === scope) btn.classList.add('active');
            else btn.classList.remove('active');
        });

        // Update Overlay Scope Buttons
        const overlayBtns = document.querySelectorAll('.shine-mode-btn[data-scope]');
        if (overlayBtns.length > 0) {
            overlayBtns.forEach(btn => {
                if (btn.dataset.scope === scope) btn.classList.add('active');
                else btn.classList.remove('active');
            });
        }

        // Show/Hide Settings Button
        const settingsBtn = document.querySelector('.shine-mode-btn[data-action="settings"]');
        if (settingsBtn) {
            settingsBtn.style.display = scope === 'me' ? 'block' : 'none';
        }

            // Toggle Controls for "Me" Scope
            // User Request: Enable Classic & Cycle modes for Me scope
            const modeControls = document.querySelectorAll('.shine-mode-btn[data-mode]');
            const vectorControl = document.querySelector('.shine-mode-btn[data-action="toggle-vector"]');
            const separators = document.querySelectorAll('.shine-separator');

            if (scope === 'me') {
                // Show Classic/Cycle, Hide Realtime/Live if desired (or keep all)
                // For now, we enable mode switching so users can access Classic (History) vs Cycle (Active)
                modeControls.forEach(el => {
                    if (el.dataset.mode === 'realtime') el.style.display = 'none'; // Hide Live for Me (optional, but cleaner)
                    else el.style.display = 'block';
                });
                
                // Hide Vector control for Me (optional, but keep simple)
                if (vectorControl) vectorControl.style.display = 'none';
                
                // Show separators
                separators.forEach(el => el.style.display = 'block');
                
            } else {
                modeControls.forEach(el => el.style.display = 'block');
                if (vectorControl) vectorControl.style.display = 'block';
                separators.forEach(el => el.style.display = 'block');
            }
    }

    async setScope(scope) {
        if (this.dataScope === scope) {
            // Even if scope is same, UI might need update (e.g. after init)
            this.updateUI();
            return;
        }
        
        this.dataScope = scope;
        console.log(`[ShineMap] Switching scope to: ${scope}`);
        
        // Map Style Isolation Logic
        if (this.map) {
            if (scope === 'world') {
                // Force World Style (Dark Standard)
                this.map.setMapStyle('amap://styles/dark');
            } else if (scope === 'me') {
                // Restore Me Style (User Preference or Default)
                // If activeMapStyle is not set, default to dark to match initial state
                const style = this.activeMapStyle || 'amap://styles/dark';
                this.map.setMapStyle(style);
            }
        }
        
        this.updateUI();

        // Reload config based on scope
        await this.loadConfig();
        
        // Refresh map
        this.refreshMap();
    }

    async resetMeData() {
        if (!confirm('危险操作：这将永久删除当前的周期数据（活跃数据）。\n此操作不可撤销。\n确定要重置周期吗？')) return;
        
        try {
            const token = sessionStorage.getItem('hkwl_auth_token');
            const res = await fetch('/api/shine/me/reset', {
                method: 'POST',
                headers: { 
                    'Authorization': token,
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({ type: 'active' })
            });
            
            if (res.ok) {
                if (window.HKWL && window.HKWL.showToast) window.HKWL.showToast('Map data reset', 'success');
                else alert('Map data reset successfully.');
                this.refreshMap();
                this.toggleConsole(false);
            } else {
                alert('Failed to reset data');
            }
        } catch (e) {
            console.error(e);
            alert('Error resetting data');
        }
    }

    async wipeMeData() {
        if (!confirm('严重警告：这将销毁所有 ShineMap-Me 数据，包括：\n- 所有活跃地图\n- 所有历史归档\n- 所有个人配置\n\n此操作绝对不可撤销。\n确定要清除所有数据吗？')) return;
        
        try {
            const token = sessionStorage.getItem('hkwl_auth_token');
            const res = await fetch('/api/shine/me/reset', {
                method: 'POST',
                headers: { 
                    'Authorization': token,
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({ type: 'full' })
            });
            
            if (res.ok) {
                if (window.HKWL && window.HKWL.showToast) window.HKWL.showToast('All data wiped. Factory reset complete.', 'success');
                else alert('All data wiped. Factory reset complete.');
                
                // Clear local storage too
                localStorage.removeItem('shine_user_scripts');
                
                // Reload page to reset state
                location.reload();
            } else {
                alert('Failed to wipe data');
            }
        } catch (e) {
            console.error(e);
            alert('Error wiping data');
        }
    }

    setMode(mode) {
        console.log(`[ShineMap] Switching to mode: ${mode}`);
        this.displayMode = mode;
        this.refreshMap();
    }

    async init(map) {
        this.map = map;
        this.injectModeControls(); // Inject UI

        // Initialize Particle System if map is available
        // if (this.map && typeof ParticleSystem !== 'undefined') {
        //     this.particleSystem = new ParticleSystem(this.map, this.vectorField);
        // }

        // Check admin status for debug features
        if (typeof Auth !== 'undefined' && Auth.refreshAdminStatus) {
            this.isAdmin = await Auth.refreshAdminStatus();
        } else {
            this.isAdmin = sessionStorage.getItem("hkwl_is_admin") === "true";
        }
        
        // Add listeners for dynamic loading (debounce to avoid spam)
        const debouncedRefresh = () => {
            if (this.debounceTimer) clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(() => this.refreshMap(), 800);
        };
        
        if (this.map && typeof this.map.on === 'function') {
            this.map.on('moveend', debouncedRefresh);
            this.map.on('zoomend', debouncedRefresh);
        } else {
            console.log("ShineMap initialized in headless mode (no map instance)");
        }

        this.loadConfig(); // Load dynamic config from admin
        this.startCircuitBreaker();
        // Load existing map data if visible
        if (this.isMapVisible && this.map) {
            this.refreshMap();
        }
    }

    async loadConfig() {
        try {
            let config = {};
            
            if (this.dataScope === 'me') {
                 const token = sessionStorage.getItem('hkwl_auth_token');
                 if (!token) {
                     console.warn('[ShineMap] No auth token for personal config');
                     return;
                 }
                 const res = await fetch(`/api/user/shine-config?t=${Date.now()}`, {
                     headers: { 'Authorization': token }
                 });
                 if (res.ok) {
                     const data = await res.json();
                     if (data.success && data.config) {
                        const p = data.config.physics || {};
                        const v = data.config.visuals || {};

                        // Normalize personal config to match global structure
                        config = {
                            restingThresholdMs: p.stationaryTime,
                            stationaryRadius: p.stationaryRadius,
                            physics: {
                                baseWeightPassing: p.baseEnergyPassing,
                                baseWeightResting: p.baseEnergyStaying,
                                dwellPowerExponent: p.dwellExponent
                            },
                            ...v
                        };
                    }
                 }
            } else {
                const res = await fetch(`/api/shine-config?t=${Date.now()}`);
                if (res.ok) {
                    config = await res.json();
                }
            }
            
            console.log(`[ShineMap] Config loaded (${this.dataScope}):`, config);
            
            if (config.restingThresholdMs !== undefined) this.RESTING_THRESHOLD_MS = config.restingThresholdMs;
            if (config.stationaryRadius !== undefined) this.STATIONARY_RADIUS = config.stationaryRadius;
            if (config.speedThreshold !== undefined) this.SPEED_THRESHOLD = config.speedThreshold;

            // Visual Config
            if (config.colorPath) this.COLOR_PATH = config.colorPath;
            if (config.colorResting) this.COLOR_RESTING = config.colorResting;
            if (config.lightnessRange) this.LIGHTNESS_RANGE = config.lightnessRange;
            if (config.opacityRange) this.OPACITY_RANGE = config.opacityRange;
            
            // Dynamic Rendering Params
            if (config.vitalityDecayRate !== undefined) this.DYNAMIC_PARAMS.vitalityDecayRate = config.vitalityDecayRate;
            if (config.lambdaRoadMax !== undefined) this.DYNAMIC_PARAMS.lambdaRoadMax = config.lambdaRoadMax;
            if (config.lambdaHomeMin !== undefined) this.DYNAMIC_PARAMS.lambdaHomeMin = config.lambdaHomeMin;
            if (config.hueRoad !== undefined) this.DYNAMIC_PARAMS.hueRoad = config.hueRoad;
            if (config.hueHub !== undefined) this.DYNAMIC_PARAMS.hueHub = config.hueHub;
            if (config.hueHome !== undefined) this.DYNAMIC_PARAMS.hueHome = config.hueHome;

            // Sync Flush Interval for accurate time calculation (Me Scope)
            if (config.flushInterval && config.flushInterval !== this.FLUSH_INTERVAL) {
                this.FLUSH_INTERVAL = config.flushInterval;
                this.startCircuitBreaker();
            }

            // If flush interval changed, restart the circuit breaker
            // (Merged with above)

            // Social Physics Parameters
            if (config.physics) {
                console.log('[ShineMap] Updating Physics Engine:', config.physics);
                if (config.physics.baseWeightPassing !== undefined) this.PHYSICS.baseWeightPassing = config.physics.baseWeightPassing;
                if (config.physics.baseWeightResting !== undefined) this.PHYSICS.baseWeightResting = config.physics.baseWeightResting;
                if (config.physics.crowdDamping !== undefined) this.PHYSICS.crowdDamping = config.physics.crowdDamping;
                if (config.physics.silenceBonus !== undefined) this.PHYSICS.silenceBonus = config.physics.silenceBonus;
                if (config.physics.dwellPowerExponent !== undefined) this.PHYSICS.dwellPowerExponent = config.physics.dwellPowerExponent;
            }

            // Force refresh map with new visuals if visible
            if (this.isMapVisible && this.map) {
                this.refreshMap();
            }
        } catch (e) {
            console.warn('[ShineMap] Failed to load config, using defaults', e);
        }
    }

    toggleLayer(visible) {
        this.isMapVisible = visible;
        
        // Toggle Particle System
        // if (this.particleSystem) {
        //     if (visible) this.particleSystem.start();
        //     else this.particleSystem.stop();
        // }

        if (visible) {
            // Check auth on entry
            const token = sessionStorage.getItem('hkwl_auth_token');
            if (!token) {
                 if (window.HKWL && window.HKWL.showToast) {
                     window.HKWL.showToast('请先登录，否则光迹无法上传', 'warning');
                 } else {
                     alert('请先登录，否则光迹无法上传');
                 }
            }

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
        
        this.isTracking = true;

        // PREFER AMap Geolocation if available (Fixes GPS drift/accuracy issues)
        if (window.AMap) {
             window.AMap.plugin('AMap.Geolocation', () => {
                if (!this.amapGeolocation) {
                    this.amapGeolocation = new AMap.Geolocation({
                        enableHighAccuracy: true,
                        timeout: 10000,
                        maximumAge: 0,
                        convert: true, // Auto convert to GCJ02
                        showButton: false,
                        showMarker: false,
                        showCircle: false,
                        panToLocation: false,
                        zoomToAccuracy: false
                    });
                }
                
                this.watchId = this.amapGeolocation.watchPosition((status, result) => {
                    if (status === 'complete') {
                        this.handleAMapPosition(result);
                    } else {
                        console.warn("AMap Geo Error:", result);
                    }
                });
             });
             console.log("ShineMap Tracking Started (AMap Mode)");
        } else if (navigator.geolocation) {
             // Fallback to native (with strict warnings)
             console.warn("AMap not found, falling back to native GPS (Low Accuracy Risk)");
             this.watchId = navigator.geolocation.watchPosition(
                (pos) => this.handlePosition(pos),
                (err) => console.error("Geo Error:", err),
                { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
            );
             console.log("ShineMap Tracking Started (Native Mode)");
        } else {
            console.error("Geolocation not supported");
            return;
        }
        
        this.startHeartbeat(); // Start resting heartbeat
    }

    stopTracking() {
        if (this.watchId !== null) {
            if (this.amapGeolocation) {
                this.amapGeolocation.clearWatch(this.watchId);
            } else {
                navigator.geolocation.clearWatch(this.watchId);
            }
            this.watchId = null;
        }
        if (this.heartbeatId) clearInterval(this.heartbeatId);
        
        // Try to flush remaining data before stopping
        this.flushPulses();
        
        this.isTracking = false;
    }

    handleAMapPosition(result) {
        const lat = result.position.lat;
        const lng = result.position.lng;
        const accuracy = result.accuracy;
        const speed = result.speed || 0; 
        const altitude = result.altitude || 0;
        const now = Date.now();

        // Stricter filtering for AMap (80m)
        if (accuracy && accuracy > 80) { 
             console.warn(`[ShineMap] Ignoring low accuracy AMap position: ${accuracy}m`);
             return;
        }

        // AMap result is already GCJ02, no need to convert
        this.updateCurrentLocation(lat, lng); // Sync UI
        this.processPosition(lat, lng, altitude, speed, now, accuracy);
    }

    startHeartbeat() {
        if (this.heartbeatId) clearInterval(this.heartbeatId);
        this.heartbeatId = setInterval(() => {
            this.checkHeartbeat();
        }, 1000);
    }

    getCellData(gridId) {
        if (!this.map || !this.map.cells) return null;
        return this.map.cells.find(c => c.gridId === gridId);
    }

    // --- Physics Calculation Core ---
    
    /**
     * Calculate TOTAL accumulated energy for a given duration.
     * Formula: E_total = BaseRate_per_min * (t_minutes ^ exponent)
     * This ensures E(1 min) = BaseRate.
     * We use this to calculate delta: E_delta = E_total(now) - E_total(prev)
     */
    calculateCumulativeRestingEnergy(durationMs) {
        // Convert to minutes
        const totalMinutes = Math.max(0.0, durationMs / 60000);
        
        // Base Energy for 1 minute
        const baseEnergy = this.PHYSICS.baseWeightResting;
        
        // Power Law: E ~ t^1.5
        // At t=1, E = baseEnergy * 1^1.5 = baseEnergy. Correct.
        let totalEnergy = baseEnergy * Math.pow(totalMinutes, this.PHYSICS.dwellPowerExponent);
        
        // Safety Cap: Don't let it explode for extremely long errors
        // e.g. if duration is 24 hours (1440 mins). 1440^1.5 ~ 54000.
        // Base=5. Total = 270,000. 
        // Reasonable? Yes, it's linear-ish scaling of value. 
        // But let's put a sanity cap per "session" to avoid integer overflows or abuse.
        // Cap at 12 hours of value?
        
        return totalEnergy;
    }

    checkHeartbeat() {
        if (!this.isTracking || !this.lastPos || !this.stationaryStartTime) return;
        
        // Strict Accuracy Check for Resting Logic
        // If we are stationary, we generate high-value "Resting" energy.
        // We must ensure we are actually in this grid, not drifting 100m away.
        // H3 Res 12 ~ 9m. 50m is already 5 grids away.
        if (this.lastPos.accuracy && this.lastPos.accuracy > 80) {
            // Do not accumulate resting energy if signal is weak
            return;
        }

        const now = Date.now();
        // If we have been stationary long enough...
        if (now - this.stationaryStartTime > this.RESTING_THRESHOLD_MS) {
             // ...we should emit resting energy even if no GPS event fires.
             
             // 1. Visual Feedback
             if (this.isMapVisible && this.map) {
                 // Visuals are cheap, just show a small pulse
                 this.addLivePulse(this.lastPos.lat, this.lastPos.lng, 1, 'resting');
             }
             
             // 2. Data Accumulation (Circuit Breaker)
             let gridId;
             // STABILITY FIX: Use stationaryAnchor instead of drifting lastPos
             const targetLat = this.stationaryAnchor ? this.stationaryAnchor.lat : this.lastPos.lat;
             const targetLng = this.stationaryAnchor ? this.stationaryAnchor.lng : this.lastPos.lng;

             if (window.h3) {
                 gridId = window.h3.latLngToCell(targetLat, targetLng, 12);
             } else {
                 const latKey = Math.round(targetLat * 100000);
                 const lngKey = Math.round(targetLng * 100000);
                 gridId = `${latKey}_${lngKey}`;
             }
             
             // Calculate scientifically (Integral Method) OR User Script
        // We calculate the Total Target Energy for the current duration,
        // then subtract what we have already emitted.
        const duration = now - this.stationaryStartTime;
        let intensity = 0;

        // User Script Override (Me Scope Only)
        if (this.dataScope === 'me' && this.userScripts && this.userScripts.deltaE) {
            try {
                const cell = this.getCellData(gridId);
                const Etotal = cell ? cell.energy : 0;
                const Last = cell ? (cell.lastPulse ? new Date(cell.lastPulse).getTime() : 0) : 0;
                const Pass = cell ? (cell.stats && cell.stats.passing) || 0 : 0;
                const Stay = cell ? (cell.stats && cell.stats.resting) || 0 : 0;
                
                // Execute User Script
                // Args: Etotal, Last, Pass, Stay, tnow, deltat
                const userVal = this.userScripts.deltaE(Etotal, Last, Pass, Stay, now, duration);
                
                if (typeof userVal === 'number' && !isNaN(userVal)) {
                    intensity = userVal;
                }
                
                // Sync stationaryEnergyEmitted to avoid "surge" if switching back to default
                // We assume we kept up with the default curve effectively
                this.stationaryEnergyEmitted = this.calculateCumulativeRestingEnergy(duration);
                
            } catch (e) {
                console.warn("User deltaE script error:", e);
                // Fallback to default
                const targetTotal = this.calculateCumulativeRestingEnergy(duration);
                intensity = targetTotal - this.stationaryEnergyEmitted;
                if (intensity > 0) this.stationaryEnergyEmitted = targetTotal;
            }
        } else {
            // Default Physics
            const targetTotal = this.calculateCumulativeRestingEnergy(duration);
            intensity = targetTotal - this.stationaryEnergyEmitted;
            
            if (intensity > 0) {
                this.stationaryEnergyEmitted = targetTotal;
            } else {
                intensity = 0; 
            }
        }
        
        // Update state
        if (intensity > 0) {

             // Reuse pending logic roughly
             if (this.pendingPulses.has(gridId)) {
                 const existing = this.pendingPulses.get(gridId);
                 existing.intensity += intensity; 
                 existing.type = 'resting';
             } else {
                 // If not in map (flushed?), add back
                 this.pendingPulses.set(gridId, {
                     lat: this.lastPos.lat,
                     lng: this.lastPos.lng,
                     type: 'resting',
                     intensity: intensity,
                     floor: 0
                 });
             }
        }
    }
    }

    handlePosition(pos) {
        const { latitude: lat, longitude: lng, altitude, speed, accuracy } = pos.coords;
        const now = Date.now();

        // Filter out low accuracy points to prevent "ghost" grids
        // H3 Res 12 is ~9m. If accuracy is poor (e.g. > 80m), we might be in a totally wrong grid.
        if (accuracy && accuracy > 80) {
            console.warn(`[ShineMap] Ignoring low accuracy position: ${accuracy}m`);
            return;
        }

        // Check if we need conversion (AMap loaded?)
        // Note: browser geolocation returns WGS84, but AMap uses GCJ02.
        if (window.AMap) {
             AMap.convertFrom([lng, lat], 'gps', (status, result) => {
                if (status === 'complete' && result.locations && result.locations.length) {
                    const corrected = result.locations[0];
                    // Pass original accuracy as conversion doesn't improve GPS precision
                    this.processPosition(corrected.lat, corrected.lng, altitude, speed, now, accuracy);
                } else {
                    // Fallback to raw if conversion fails
                    this.processPosition(lat, lng, altitude, speed, now, accuracy);
                }
            });
        } else {
            this.processPosition(lat, lng, altitude, speed, now, accuracy);
        }
    }

    processPosition(lat, lng, altitude, speed, now, accuracy) {
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
        let intensity = this.PHYSICS.baseWeightPassing; // Default to configured base
        let isWithinGeofence = false;

        if (this.stationaryAnchor) {
            const dist = this.getDistance(this.stationaryAnchor.lat, this.stationaryAnchor.lng, lat, lng);
            if (dist < this.STATIONARY_RADIUS) {
                isWithinGeofence = true;
            }
        }

        let targetLat = lat;
        let targetLng = lng;
        let duration = 0;

        // 1. Determine Type & Anchor
        if (isWithinGeofence) {
            duration = now - this.stationaryStartTime;
            if (duration > this.RESTING_THRESHOLD_MS) {
                type = 'resting';
                if (this.stationaryAnchor) {
                     targetLat = this.stationaryAnchor.lat;
                     targetLng = this.stationaryAnchor.lng;
                }
            }
        } else {
             this.stationaryAnchor = { lat, lng };
             this.stationaryStartTime = now;
             this.stationaryEnergyEmitted = 0; 
        }

        // 2. Get GridId Early
        let gridId;
        if (window.h3) {
            gridId = window.h3.latLngToCell(targetLat, targetLng, 12);
        } else {
            const latKey = Math.round(targetLat * 100000); 
            const lngKey = Math.round(targetLng * 100000);
            gridId = `${latKey}_${lngKey}`;
        }
        
        // 3. Calculate Velocity & Floor
        let dx = 0, dy = 0;
        if (this.lastPos) {
            dx = lng - this.lastPos.lng;
            dy = lat - this.lastPos.lat;
        }
        const floor = altitude ? Math.floor(altitude / 3) : 0;

        // 4. Energy Calculation (User Script OR Default)
        let handled = false;
        
        // --- USER SCRIPT HOOK ---
        if (this.dataScope === 'me' && this.userScripts && this.userScripts.deltaE) {
             try {
                 const cell = this.getCellData(gridId);
                 const Etotal = cell ? cell.energy : 0;
                 const Last = cell ? (cell.lastPulse ? new Date(cell.lastPulse).getTime() : 0) : 0;
                 const Pass = cell ? (cell.stats && cell.stats.passing) || 0 : 0;
                 const Stay = cell ? (cell.stats && cell.stats.resting) || 0 : 0;
                 
                 // If passing, duration is 0? Or maybe small?
                 const dt = (type === 'resting' ? duration : 0);
                 
                 const dE = this.userScripts.deltaE(Etotal, Last, Pass, Stay, now, dt);
                 if (typeof dE === 'number' && !isNaN(dE)) {
                     intensity = dE;
                     handled = true;
                     // Sync stationary state to prevent jumps if switching back
                     if (type === 'resting') {
                          this.stationaryEnergyEmitted = this.calculateCumulativeRestingEnergy(duration);
                     }
                 }
             } catch(e) { console.warn("User Script Error", e); }
        }

        if (!handled) {
            // Default Logic
            if (type === 'resting') {
                const targetTotal = this.calculateCumulativeRestingEnergy(duration);
                intensity = targetTotal - this.stationaryEnergyEmitted;
                if (intensity > 0) this.stationaryEnergyEmitted = targetTotal;
                else intensity = 0;
            }
            
            // Apply Scarcity & Silence (Default Only)
            let scarcityFactor = 1.0;
            let silenceMultiplier = 1.0;
    
            if (this.vectorField && this.vectorField.gridIndex) {
                 const cachedCell = this.vectorField.cells.find(c => c.gridId === gridId);
                 if (cachedCell) {
                     const normalizedEnergy = Math.min(cachedCell.energy, 100);
                     scarcityFactor = 1.0 / (1.0 + this.PHYSICS.crowdDamping * normalizedEnergy);
                     
                     // Silence Bonus
                     if (cachedCell.energy < 10) {
                         silenceMultiplier = 1.0 + this.PHYSICS.silenceBonus;
                     }
                 } else {
                     silenceMultiplier = 1.0 + (this.PHYSICS.silenceBonus * 2);
                 }
            }
            intensity = intensity * scarcityFactor * silenceMultiplier;
            intensity = Math.max(0.1, intensity);
        }

        if (this.pendingPulses.has(gridId)) {
            const existing = this.pendingPulses.get(gridId);
            existing.intensity += intensity;
            if (type === 'resting') existing.type = 'resting'; // Upgrade type
            // Accumulate vector
            if (!existing.velocity) existing.velocity = { dx: 0, dy: 0 };
            existing.velocity.dx += dx;
            existing.velocity.dy += dy;
        } else {
            this.pendingPulses.set(gridId, {
                lat, lng, type, intensity, floor,
                velocity: { dx, dy }
            });
        }

        this.lastPos = { lat, lng, time: now, accuracy };
        
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

            if (!token) {
                console.warn("[Circuit Breaker] No token found. Data cannot be uploaded.");
                if (window.HKWL && window.HKWL.showToast) {
                    // Use HKWL toast if available
                    // window.HKWL.showToast('未登录，光迹无法上传', 'warning'); 
                    // Commented out to avoid spamming toast every 5s. 
                    // User is warned on entry.
                }
                return;
            }

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
        if (!bounds) {
            console.warn("ShineMap: Map bounds not available");
            return;
        }

        // Robustness for AMap versions (1.x methods vs 2.x properties) or unready state
        const ne = bounds.northeast || (bounds.getNorthEast && bounds.getNorthEast());
        const sw = bounds.southwest || (bounds.getSouthWest && bounds.getSouthWest());

        if (!ne || !sw) {
            console.warn("ShineMap: Map bounds incomplete");
            return;
        }

        const north = ne.lat !== undefined ? ne.lat : (ne.getLat ? ne.getLat() : 0);
        const south = sw.lat !== undefined ? sw.lat : (sw.getLat ? sw.getLat() : 0);
        const east = ne.lng !== undefined ? ne.lng : (ne.getLng ? ne.getLng() : 0);
        const west = sw.lng !== undefined ? sw.lng : (sw.getLng ? sw.getLng() : 0);
        
        const zoom = this.map.getZoom(); // Get zoom level

        try {
            // Determine endpoint and headers
            let endpoint = '/api/shine/map';
            const headers = {};
            
            if (this.dataScope === 'me') {
                endpoint = '/api/shine/me/map';
                const token = sessionStorage.getItem('hkwl_auth_token');
                if (token) headers['Authorization'] = token;
                else {
                    console.warn("[ShineMap] No auth token for personal map");
                    // Optionally switch back to world or show error
                }
            }

            // Append a timestamp to prevent caching
            // ADDED: Pass 'mode' parameter for Me scope (classic vs cycle)
            let url = `${endpoint}?north=${north}&south=${south}&east=${east}&west=${west}&zoom=${zoom}&t=${Date.now()}`;
            if (this.dataScope === 'me') {
                url += `&mode=${this.displayMode}`;
            }

            const res = await fetch(url, { headers });
            const data = await res.json();
            
            if (data.success) {
                // Check for empty personal data
                if (this.dataScope === 'me' && data.cells.length === 0) {
                     if (typeof HKWL !== 'undefined' && HKWL.showToast) {
                         if (!this._hasShownEmptyToast) {
                             HKWL.showToast("暂无个人数据，快去探索吧！", 'info');
                             this._hasShownEmptyToast = true;
                         }
                     }
                }
                if (this.dataScope === 'me' && data.cells.length > 0) {
                    this._hasShownEmptyToast = false;
                }

                // Update Vector Field FIRST so renderGrids can use dynamics
                if (this.vectorField) {
                    const now = Date.now();
                    const deltaTime = this.lastRefreshTime ? (now - this.lastRefreshTime) / 1000 : 0;
                    this.vectorField.setData(data.cells, deltaTime);
                    this.lastRefreshTime = now;
                }

                this.renderGrids(data.cells);
                
                // Restore live paths on top of new grid data
                this.renderLivePath();
                
                // Update UI count
                // Fix: Count active nodes based on current display mode logic
                let activeCount = 0;
                if (this.displayMode === 'cycle') {
                     // In Cycle Mode, only count cells with non-negligible cycle energy
                     activeCount = data.cells.filter(c => (c.cycleEnergy || 0) >= 0.1).length;
                } else if (this.displayMode === 'realtime') {
                     // In Realtime Mode, count cells with dynamic changes
                     // (Logic mirrors render loop: check velocity/dynamics)
                     // For simplicity, we can count cells that have non-zero velocity or recent pulse
                     activeCount = data.cells.filter(c => c.velocity && (c.velocity.dx !== 0 || c.velocity.dy !== 0)).length;
                } else {
                     // Classic Mode: Count all returned cells (usually filtered by bounds/limit)
                     activeCount = data.cells.length;
                }

                this.updateStatus(activeCount);

                // Debug log only, no toast to avoid spam
                console.log(`[ShineMap] Loaded ${data.cells.length} sparks`);
            } else {
                 console.warn("ShineMap fetch success=false");
            }
        } catch (e) {
            console.error("Fetch ShineMap failed:", e);
            if (typeof HKWL !== 'undefined' && HKWL.showToast) {
                HKWL.showToast("光迹加载失败", 'error');
            }
        }
    }

    // --- Breathing Effect (ShineMap-Me) ---
    startBreathingLoop() {
        this.stopBreathingLoop();
        if (this.dataScope === 'me' && this.breathingEnabled) {
            this.animateBreathing();
        }
    }

    stopBreathingLoop() {
        if (this.breathingFrameId) {
            cancelAnimationFrame(this.breathingFrameId);
            this.breathingFrameId = null;
        }
    }

    animateBreathing() {
        if (!this.map || this.dataScope !== 'me' || !this.breathingEnabled) return;

        const now = Date.now();
        // Slow breathing: 4s period (2s in, 2s out)
        // Sine wave from -1 to 1 -> map to 0.8 to 1.2 multiplier?
        // Or 0.5 to 1.0 of base opacity?
        // User said "slow fluorescent breathing".
        // Let's vary opacity between base * 0.6 and base * 1.0 ? 
        // Or add a glow?
        // Let's do a smooth sine wave on opacity: 
        // Factor = 0.7 + 0.3 * sin(t) -> range [0.4, 1.0] multiplier.
        
        const period = 4000;
        const phase = (now % period) / period * 2 * Math.PI;
        const factor = 0.85 + 0.15 * Math.sin(phase); // Variation +/- 15% around 85%
        
        this.polygons.forEach(p => {
            const ext = p.getExtData();
            if (ext && ext.baseOpacity) {
                p.setOptions({
                    fillOpacity: ext.baseOpacity * factor,
                    strokeOpacity: (ext.baseOpacity * factor) * 0.8
                });
            }
        });

        this.breathingFrameId = requestAnimationFrame(() => this.animateBreathing());
    }

    toggleBreathing(enabled) {
        this.breathingEnabled = enabled;
        localStorage.setItem('shine_breathing_enabled', enabled);
        if (enabled) this.startBreathingLoop();
        else {
            this.stopBreathingLoop();
            // Reset to base opacity
            this.polygons.forEach(p => {
                const ext = p.getExtData();
                if (ext && ext.baseOpacity) {
                    p.setOptions({
                        fillOpacity: ext.baseOpacity,
                        strokeOpacity: ext.baseOpacity * 0.5
                    });
                }
            });
        }
    }

    renderGrids(cells) {
        // Clear old overlays
        this.clearMap();

        if (!window.AMap || !this.map) return;

        const zoom = this.map.getZoom();
        // H3 Res 12 is ~9m. 
        // At zoom < 16, it's very small. 
        // Use CircleMarker for wider zoom ranges to ensure visibility.
        const isLowZoom = zoom < 16; 

        cells.forEach(cell => {
            // STRICT FILTER: Only allow Resolution 12 cells
            // This prevents "Large Hexagon" (Res 9) ghosts from appearing
            if (window.h3 && cell.gridId && !cell.gridId.includes('_')) {
                try {
                    const res = window.h3.getResolution(cell.gridId);
                    if (res !== 12) return; // Skip non-Res-12
                } catch (e) {
                    return; // Skip invalid
                }
            } else {
                return; // Skip legacy/non-H3
            }

            // --- Dynamic Visual Calculation (Functional Spectrum & Thermodynamics) ---
            
            // 1. Calculate Functional Ratio (Spectral Ratio)
            // lambda = Resting / (Resting + Passing)
            
            // Determine which stats to use based on mode
            let stats;
            if (this.displayMode === 'cycle' && cell.cycleStats) {
                // Use Cycle-specific stats if available and in cycle mode
                stats = cell.cycleStats;
            } else {
                // Use Global stats (Classic / Realtime / Fallback)
                stats = cell.stats || { resting: 0, passing: 0 };
            }

            const totalEvents = (stats.resting || 0) + (stats.passing || 0);
            const lambda = totalEvents > 0 ? ((stats.resting || 0) / totalEvents) : 0;

            let fillColor, opacity, zIndex;

            // --- BRANCH: ME SCOPE (Timeline View) ---
            if (this.dataScope === 'me') {
                // Strictly Time-Based Rendering
                // Ignore Energy/Scarcity/Social Physics

                // stats.resting/passing are counts of FLUSH_INTERVAL
                const intervalSec = (this.FLUSH_INTERVAL || 5000) / 1000;
                const restingCount = (stats.resting || 0);
                const passingCount = (stats.passing || 0);
                
                // Calculate Total Minutes (Resting + Passing)
                const totalSeconds = (restingCount + passingCount) * intervalSec;
                const totalMinutes = totalSeconds / 60;

                if (totalMinutes <= 0) return; // Don't render empty cells

                // Default Style (Fallback)
                fillColor = '#888888';
                opacity = 0.5;

                if (this.timelineConfig && this.timelineConfig.length > 0) {
                    // Find matching segment
                    let match = null;
                    for (const seg of this.timelineConfig) {
                        // -1 means Infinity
                        if (seg.maxMinutes === -1 || totalMinutes <= seg.maxMinutes) {
                            match = seg;
                            break;
                        }
                    }
                    
                    // Fallback to last if no match (shouldn't happen if infinity is last)
                    if (!match) match = this.timelineConfig[this.timelineConfig.length - 1];

                    if (match) {
                        fillColor = match.color;
                        opacity = match.opacity;
                    }
                }

                // Z-Index based on Duration (Longer stay = Higher layer)
                // Cap at 200 + 100 = 300
                zIndex = 200 + Math.min(Math.floor(totalMinutes), 100);

            } else {
                // --- BRANCH: WORLD SCOPE (Social Physics / Energy View) ---
                // 2. Determine Energy & Visual Mode - REFACTORED
            let effectiveEnergy = 0;
            let visualType = 'standard'; // 'standard' (Spectral) or 'velocity' (Thermodynamic Shift)

            if (this.displayMode === 'realtime') {
                // STRICT REALTIME: Use computed dynamics from VectorField (dE/dt)
                // If dynamics are not ready (e.g. first load), use 0 to avoid false "ghost" colors.
                // The user expects "Realtime" to mean "Right Now", not "This Hour vs Last Hour".
                if (cell.dynamics && cell.dynamics.velocity !== undefined) {
                    effectiveEnergy = cell.dynamics.velocity;
                } else {
                    effectiveEnergy = 0;
                }
                
                visualType = 'velocity';
                
            } else if (this.displayMode === 'cycle') {
                effectiveEnergy = cell.cycleEnergy || 0;
                visualType = 'standard';
                
            } else {
                // Classic Mode (Default)
                effectiveEnergy = cell.energy;
                if (cell.lastPulse) {
                    const now = Date.now();
                    const lastPulseTime = new Date(cell.lastPulse).getTime();
                    const daysSince = (now - lastPulseTime) / (1000 * 60 * 60 * 24);
                    const decayRate = this.DYNAMIC_PARAMS ? this.DYNAMIC_PARAMS.vitalityDecayRate : 0.9;
                    const decayFactor = Math.pow(decayRate, daysSince); 
                    effectiveEnergy = cell.energy * decayFactor;
                }
            }

            // 3. Visual Calculation
            // let fillColor, opacity; // Removed to avoid shadowing outer variables


            if (visualType === 'velocity') {
                // Real-time Velocity Visualization (Redshift / Blueshift)
                if (Math.abs(effectiveEnergy) < 0.1) return; // Skip negligible change

                const isHeating = effectiveEnergy > 0;
                const magnitude = Math.abs(effectiveEnergy);
                
                // Logarithmic scaling for velocity (Sensitivity)
                const intensityRatio = Math.min(Math.log10(magnitude + 1) / 2.5, 1.0); 

                let hue, sat, light;
                
                if (isHeating) {
                    // Heating (Positive): Amber (45) -> Red (0) -> White-Hot
                    hue = 45 - (45 * intensityRatio);
                    sat = 100;
                    light = 50 + (50 * Math.max(0, intensityRatio - 0.8) * 5); // Boost lightness at top end
                    light = Math.min(light, 95);
                } else {
                    // Cooling (Negative): Cyan (180) -> Blue (240) -> Deep Violet (270)
                    hue = 180 + (90 * intensityRatio);
                    sat = 80;
                    light = 60 + (20 * intensityRatio); // Icy Bright
                }

                opacity = 0.4 + (0.5 * intensityRatio);
                fillColor = `hsl(${hue.toFixed(1)}, ${sat}%, ${light.toFixed(1)}%)`;

            } else {
                // Standard Spectral Mapping (Classic / Cycle)
                // Filter: If energy is negligible, do not render.
                // This ensures Cycle Mode is completely blank after reset (hiding 0-energy ghosts).
                // Exception: In 'me' scope (Timeline View), we allow rendering regardless of energy/decay.
                if (effectiveEnergy < 0.1 && this.dataScope !== 'me') return;

                // 3. Determine Visual Ranges based on Function
                let baseHue, targetHue, minOp, maxOp, minL, maxL;

                // Use Dynamic Params for Classification
                const lambdaRoadMax = this.DYNAMIC_PARAMS ? this.DYNAMIC_PARAMS.lambdaRoadMax : 0.3;
                const lambdaHomeMin = this.DYNAMIC_PARAMS ? this.DYNAMIC_PARAMS.lambdaHomeMin : 0.7;
                
                // Use Dynamic Params for Hues
                const hRoad = this.DYNAMIC_PARAMS ? this.DYNAMIC_PARAMS.hueRoad : 180;
                const hHub = this.DYNAMIC_PARAMS ? this.DYNAMIC_PARAMS.hueHub : 35;
                const hHome = this.DYNAMIC_PARAMS ? this.DYNAMIC_PARAMS.hueHome : 250;
    
                if (lambda < lambdaRoadMax) {
                    // TYPE: ROAD / TRANSPORT (Cyan Flow)
                    baseHue = hRoad; targetHue = hRoad + 30;
                    minOp = 0.3; maxOp = 0.85; 
                    minL = 40;   maxL = 75;   
                } else if (lambda > lambdaHomeMin) {
                    // TYPE: RESIDENTIAL / PRIVATE (Violet Nebula)
                    baseHue = hHome; targetHue = hHome + 25;
                    minOp = 0.2; maxOp = 0.6;
                    minL = 30;   maxL = 60;
                } else {
                    // TYPE: COMMERCIAL / PUBLIC (Gold Star)
                    baseHue = hHub; targetHue = hHub + 25;
                    minOp = 0.4; maxOp = 1.0;
                    minL = 50;   maxL = 95;
                }
    
                // 4. Calculate Visual Intensity
                // Use Weber-Fechner (Log/Root) mapping on Effective Energy
                const baseThreshold = 100;
                let intensityRatio = 0;
    
                if (effectiveEnergy <= baseThreshold) {
                    // Trace Phase: Square Root for sensitivity (0.0 -> 1.0)
                    intensityRatio = Math.min(Math.pow(effectiveEnergy / baseThreshold, 0.5), 1);
                } else {
                    // Stellar Phase: Logarithmic growth (1.0 -> 2.0+)
                    const logE = Math.log10(effectiveEnergy);
                    intensityRatio = 1 + (logE - 2) * 0.333;
                }
                
                // Normalize intensityRatio to 0.0 -> 1.0 for interpolation
                const normalizedIntensity = Math.min(intensityRatio / 2.0, 1.0);
    
                // 5. Final HSL Composition
                const hue = baseHue + (targetHue - baseHue) * normalizedIntensity;
                
                // Saturation Damping at high intensity
                let sat = 90;
                if (normalizedIntensity > 0.9) {
                    sat = 90 - (normalizedIntensity - 0.9) * 200; // Dip to ~70%
                }
    
                const lightness = minL + (maxL - minL) * normalizedIntensity;
                opacity = minOp + (maxOp - minOp) * normalizedIntensity;
    
            if (visualType === 'velocity') {
                // ... (Existing Velocity Logic) ...
                // Note: I am not replacing this block via tool, just referencing position.
                // Since SearchReplace requires exact match, I will insert AFTER the velocity/spectral block
            } 
            
            // ... (The SearchReplace will target the lines below)
            
                fillColor = `hsl(${hue.toFixed(1)}, ${sat.toFixed(1)}%, ${lightness.toFixed(1)}%)`;
            }

            // Default Z-Index for World Scope
            zIndex = cell.energy > 100 ? 201 : 200;

            } // END BRANCH: WORLD SCOPE

            // Create Hexagon (H3) or Square (Legacy)
            let path;
            if (window.h3 && cell.gridId && !cell.gridId.includes('_')) {
                // H3 Hexagon (gridId is H3 index string, not lat_lng)
                try {
                    const boundary = window.h3.cellToBoundary(cell.gridId);
                    // boundary is [ [lat, lng], ... ] -> Need [ [lng, lat], ... ]
                    path = boundary.map(p => [p[1], p[0]]);
                } catch (e) {
                    // Fallback if invalid gridId
                    const d = 0.00005;
                    path = [
                        [cell.center.lng - d, cell.center.lat - d],
                        [cell.center.lng + d, cell.center.lat - d],
                        [cell.center.lng + d, cell.center.lat + d],
                        [cell.center.lng - d, cell.center.lat + d]
                    ];
                }
            } else {
                // Legacy/Fallback Square
                const d = 0.00005;
                path = [
                    [cell.center.lng - d, cell.center.lat - d],
                    [cell.center.lng + d, cell.center.lat - d],
                    [cell.center.lng + d, cell.center.lat + d],
                    [cell.center.lng - d, cell.center.lat + d]
                ];
            }

            const polygon = new AMap.Polygon({
                path: path,
                strokeColor: fillColor, 
                strokeWeight: 1, // Slight stroke for definition
                // FIX: Me Scope uses full opacity for stroke to match user config strictly
                strokeOpacity: this.dataScope === 'me' ? opacity : opacity * 0.5,
                fillColor: fillColor,
                fillOpacity: opacity, 
                zIndex: zIndex, // Layering (Calculated per scope)
                bubble: false, // Prevent event propagation
                cursor: 'pointer', // Indicate interactivity
                // Store baseOpacity for breathing effect
                extData: { gridId: cell.gridId, baseOpacity: opacity, baseColor: fillColor } 
            });

            polygon.setMap(this.map);
            this.polygons.push(polygon);
            
            // --- Visual Effects (Vector Flow Only) ---
            // Removed heavy DOM Markers for "Stars". 
            // Only keeping lightweight vector flow indicators if needed.
            
            // [MODIFIED] Dust/Flow only for WORLD scope. ME scope uses Breathing Effect.
            // Only render when vectorMode is enabled (User requested to remove static blink)
            if (this.vectorMode && this.dataScope !== 'me' && (zoom >= 14 || cell.energy > 500) && cell.velocity && (Math.abs(cell.velocity.dx) > 0.000001 || Math.abs(cell.velocity.dy) > 0.000001)) {
                // Vector Mode: Flowing dust with rotation
                const angle = Math.atan2(cell.velocity.dy, cell.velocity.dx);
                const effectContent = `
                    <div class="shine-flow-wrapper" style="transform: rotate(${angle}rad)">
                        <div class="shine-dust"></div>
                    </div>
                `;
                
                const marker = new AMap.Marker({
                    position: [cell.center.lng, cell.center.lat],
                    content: `<div class="shine-effect-container">${effectContent}</div>`,
                    offset: new AMap.Pixel(0, 0),
                    zIndex: 210, 
                    clickable: false,
                    bubble: true
                });
                marker.setMap(this.map);
                this.effectMarkers.push(marker);
            }
            
            // Admin Debug: Click to see detailed stats
            polygon.on('click', (e) => {
                // Debug Log
                console.log('[ShineMap] Polygon Click Event Fired!', cell.gridId);

                // Dynamic check: Always check latest status from storage/Auth
                const isRealAdmin = (typeof Auth !== 'undefined' && Auth.isAdmin()) || sessionStorage.getItem("hkwl_is_admin") === "true";
                
                if (!isRealAdmin) {
                    return; 
                }

                console.log('[ShineMap] Opening InfoWindow...');

                let dynamicsHtml = '';
                if (cell.dynamics) {
                    dynamicsHtml = `
                        <div style="margin-top: 4px; border-top: 1px dashed #eee; padding-top: 4px;">
                            <div><b>Velocity:</b> ${cell.dynamics.velocity.toFixed(3)} /s</div>
                            <div><b>Accel:</b> ${cell.dynamics.acceleration.toFixed(3)} /s²</div>
                        </div>
                    `;
                }

                // Calculate Category Label for Display
                let categoryLabel = 'Unknown';
                let categoryColor = '#888';

                // Fix: Define thresholds in local scope to avoid ReferenceError
                const lambdaRoadMax = this.DYNAMIC_PARAMS ? this.DYNAMIC_PARAMS.lambdaRoadMax : 0.3;
                const lambdaHomeMin = this.DYNAMIC_PARAMS ? this.DYNAMIC_PARAMS.lambdaHomeMin : 0.7;

                if (lambda < lambdaRoadMax) {
                    categoryLabel = 'Road / Flow';
                    categoryColor = '#00bcd4'; // Cyan
                } else if (lambda > lambdaHomeMin) {
                    categoryLabel = 'Home / Stasis';
                    categoryColor = '#673ab7'; // Deep Purple
                } else {
                    categoryLabel = 'Hub / Activity';
                    categoryColor = '#ffc107'; // Amber
                }
                
                // Calculate Decay Info
                let decayText = 'Fresh';
                let decayFactor = 1.0;
                if (cell.lastPulse) {
                    const now = Date.now();
                    const lastPulseTime = new Date(cell.lastPulse).getTime();
                    const daysSince = (now - lastPulseTime) / (1000 * 60 * 60 * 24);
                    const decayRate = this.DYNAMIC_PARAMS ? this.DYNAMIC_PARAMS.vitalityDecayRate : 0.9;
                    decayFactor = Math.pow(decayRate, daysSince);
                    decayText = `${daysSince.toFixed(1)} days ago`;
                }

                const content = `
                    <div style="padding: 10px; min-width: 200px; color: #333; font-family: sans-serif;">
                        <h4 style="margin: 0 0 8px 0; border-bottom: 2px solid ${categoryColor}; padding-bottom: 5px; font-size: 14px; display: flex; justify-content: space-between;">
                            <span>⚡ Shine Node</span>
                            <span style="font-size:10px; background:${categoryColor}; color:#fff; padding:2px 6px; border-radius:4px;">${categoryLabel}</span>
                        </h4>
                        <div style="font-size: 12px; line-height: 1.6;">
                            <div style="margin-bottom: 4px; color: #888; font-family: monospace; font-size: 10px;">ID: ${cell.gridId || 'N/A'}</div>
                            
                            <div style="background:#f5f5f5; padding:8px; border-radius:4px; margin-bottom:8px;">
                                <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                                    <span>Vitality (E_eff):</span>
                                    <span style="font-weight:bold; color:${categoryColor}">${Math.round(effectiveEnergy)}</span>
                                </div>
                                <div style="display:flex; justify-content:space-between; color:#888; font-size:11px;">
                                    <span>${this.displayMode === 'cycle' ? 'Cycle Energy:' : 'Total Energy:'}</span>
                                    <span>${Math.round(this.displayMode === 'cycle' ? (cell.cycleEnergy || 0) : cell.energy)}</span>
                                </div>
                                <div style="display:flex; justify-content:space-between; color:#888; font-size:11px;">
                                    <span>Decay (${decayFactor.toFixed(2)}):</span>
                                    <span>${decayText}</span>
                                </div>
                            </div>

                            <div style="display: flex; gap: 15px; margin: 5px 0;">
                                <span title="Passing Events">🏃 ${stats.passing || 0}</span>
                                <span title="Resting Events">🛌 ${stats.resting || 0}</span>
                                <span title="Lambda (Resting Ratio)">λ ${lambda.toFixed(2)}</span>
                            </div>
                            ${dynamicsHtml}
                            <div style="color: #666; font-size: 11px; margin-top: 4px;">
                                Last: ${cell.lastPulse ? new Date(cell.lastPulse).toLocaleTimeString() : '-'}
                            </div>
                        </div>
                    </div>
                `;

                const infoWindow = new AMap.InfoWindow({
                    content: content,
                    offset: new AMap.Pixel(0, -10),
                    closeWhenClickMap: true
                });
                
                const center = cell.center ? [cell.center.lng, cell.center.lat] : polygon.getPath()[0];
                infoWindow.open(this.map, center);
            });
        });

        // Trigger Breathing Loop for Me Scope
        if (this.dataScope === 'me') {
            this.startBreathingLoop();
        }
    }

    updateStatus(count) {
        if (!this.map) return;

        // Create status element if missing
        if (!this.statusEl) {
            this.statusEl = document.createElement('div');
            this.statusEl.className = 'shine-status-indicator';
            this.statusEl.style.cssText = `
                position: absolute;
                bottom: 30px; 
                left: 10px;
                background: rgba(0,0,0,0.6);
                color: #e2e8f0;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                pointer-events: none;
                z-index: 150;
                backdrop-filter: blur(4px);
                border: 1px solid rgba(255,255,255,0.1);
                font-family: 'Inter', sans-serif;
            `;
            const container = this.map.getContainer();
            if (container) container.appendChild(this.statusEl);
        }

        this.statusEl.innerHTML = `<span style="color:#3b82f6">●</span> Active Sparks: <b>${count}</b>`;
        this.statusEl.style.display = 'block';
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
        if (this.effectMarkers) {
            this.map.remove(this.effectMarkers);
            this.effectMarkers = [];
        }
        // FIX: Do not remove currentLocationMarker here. 
        // It should persist across grid refreshes and only be updated by geolocation.
        /*
        if (this.currentLocationMarker) {
            this.map.remove(this.currentLocationMarker);
            this.currentLocationMarker = null;
        }
        */

        // Hide status indicator
        if (this.statusEl) {
            this.statusEl.style.display = 'none';
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
                zIndex: 999 // FIX: Ensure marker is above all grid polygons (zIndex 200-300)
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
        let path;
        if (window.h3) {
             const gridId = window.h3.latLngToCell(lat, lng, 12); // Use Res 12 for live preview too
             const boundary = window.h3.cellToBoundary(gridId);
             path = boundary.map(p => [p[1], p[0]]);
        } else {
             const d = 0.00001; // Smaller fallback for Res 12
             path = [
                 [lng - d, lat - d],
                 [lng + d, lat - d],
                 [lng + d, lat + d],
                 [lng - d, lat + d]
             ];
        }

        // Dynamic Visual Calculation for Live Pulse
        let fillColor, opacity, zIndex;

        if (this.dataScope === 'me') {
            // --- ME SCOPE: Timeline Color ---
            // Use the first segment color (representing "Now" / Short duration)
            let match = null;
            if (this.timelineConfig && this.timelineConfig.length > 0) {
                match = this.timelineConfig[0];
            }
            fillColor = match ? match.color : '#ffffff';
            opacity = 0.8; // High visibility for pulse
            zIndex = 300;
        } else {
            // --- WORLD SCOPE: Energy Color ---
            let hue = this.DYNAMIC_PARAMS ? this.DYNAMIC_PARAMS.hueRoad : 200;
            let sat = 80;
            
            if (type === 'resting') {
                hue = this.DYNAMIC_PARAMS ? this.DYNAMIC_PARAMS.hueHome : 340;
            } else if (type === 'hub') {
                hue = this.DYNAMIC_PARAMS ? this.DYNAMIC_PARAMS.hueHub : 35;
            }
    
            const maxEnergy = 100;
            const ratio = Math.min(intensity / maxEnergy, 1);
            
            const lightness = this.LIGHTNESS_RANGE.min + (this.LIGHTNESS_RANGE.max - this.LIGHTNESS_RANGE.min) * ratio;
            opacity = this.OPACITY_RANGE.min + (this.OPACITY_RANGE.max - this.OPACITY_RANGE.min) * ratio;
            opacity = Math.min(opacity, 0.9);
    
            fillColor = `hsl(${hue}, ${sat}%, ${lightness}%)`;
            zIndex = type === 'resting' ? 100 : 60;
        }

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

// --- Social Physics Engine ---

class VectorField {
    constructor() {
        this.cells = [];
        this.gridIndex = new Map(); // Spatial Hash for fast lookup
        this.resolution = 0.005; // Coarse grid for interpolation (~500m)
        this.previousState = new Map(); // History for time-derivative calculation
        this.alpha = 0.3; // EMA smoothing factor
    }

    setData(cells, deltaTime) {
        this.cells = cells.filter(c => c.velocity && (c.velocity.dx !== 0 || c.velocity.dy !== 0));
        this.buildIndex();
        
        // Compute Time Derivatives (Energy Velocity & Acceleration)
        if (deltaTime > 0) {
            this.computeDynamics(cells, deltaTime);
        } else {
            // First run: just initialize history
            const now = Date.now();
            cells.forEach(cell => {
                this.previousState.set(cell.gridId, {
                    energy: cell.energy,
                    velocity: 0,
                    timestamp: now
                });
            });
        }
        
        console.log(`[VectorField] Initialized with ${this.cells.length} vectors. Dynamics updated.`);
    }

    computeDynamics(currentCells, deltaTime) {
        const now = Date.now();
        const maxTimeGap = 600; // Reset history if gap > 10 mins

        currentCells.forEach(cell => {
            const prev = this.previousState.get(cell.gridId);
            
            let energyVelocity = 0;
            let energyAcceleration = 0;

            if (prev && (now - prev.timestamp) / 1000 < maxTimeGap) {
                // 1. Calculate Raw Velocity: (E_now - E_prev) / dt
                const rawVelocity = (cell.energy - prev.energy) / deltaTime;
                
                // 2. Smooth Velocity (EMA)
                // V_smooth = alpha * V_raw + (1-alpha) * V_prev_smooth
                energyVelocity = this.alpha * rawVelocity + (1 - this.alpha) * prev.velocity;
                
                // 3. Calculate Acceleration: (V_now - V_prev) / dt
                energyAcceleration = (energyVelocity - prev.velocity) / deltaTime;
            }

            // Attach to cell data for external use
            cell.dynamics = {
                velocity: energyVelocity,       // dE/dt
                acceleration: energyAcceleration // d^2E/dt^2
            };

            // Update History
            this.previousState.set(cell.gridId, {
                energy: cell.energy,
                velocity: energyVelocity,
                timestamp: now
            });
            
            // Debug Log for High Dynamics
            if (Math.abs(energyAcceleration) > 0.5) {
                console.log(`[Dynamics] Cell ${cell.gridId}: Vel=${energyVelocity.toFixed(2)}, Acc=${energyAcceleration.toFixed(2)}`);
            }
        });
    }

    buildIndex() {
        this.gridIndex.clear();
        this.cells.forEach(cell => {
            const key = this.getKey(cell.center.lat, cell.center.lng);
            if (!this.gridIndex.has(key)) this.gridIndex.set(key, []);
            this.gridIndex.get(key).push(cell);
        });
    }

    getKey(lat, lng) {
        const i = Math.floor(lat / this.resolution);
        const j = Math.floor(lng / this.resolution);
        return `${i}_${j}`;
    }

    // Inverse Distance Weighting (IDW) to get vector at any point
    getVector(lat, lng) {
        // Optimization: Check local grid and neighbors
        const i = Math.floor(lat / this.resolution);
        const j = Math.floor(lng / this.resolution);
        
        let nearby = [];
        for (let di = -1; di <= 1; di++) {
            for (let dj = -1; dj <= 1; dj++) {
                const key = `${i+di}_${j+dj}`;
                if (this.gridIndex.has(key)) {
                    nearby.push(...this.gridIndex.get(key));
                }
            }
        }

        if (nearby.length === 0) return { dx: 0, dy: 0 };

        let sumDx = 0, sumDy = 0, sumWeight = 0;
        const p = 2; // Power parameter

        for (const cell of nearby) {
            const d = Math.sqrt(Math.pow(lat - cell.center.lat, 2) + Math.pow(lng - cell.center.lng, 2));
            if (d < 0.00001) return { dx: cell.velocity.dx, dy: cell.velocity.dy }; // Exact match

            const weight = 1 / Math.pow(d, p);
            sumDx += cell.velocity.dx * weight;
            sumDy += cell.velocity.dy * weight;
            sumWeight += weight;
        }

        if (sumWeight === 0) return { dx: 0, dy: 0 };

        return { 
            dx: sumDx / sumWeight, 
            dy: sumDy / sumWeight 
        };
    }
    
    // Calculate Divergence (Source/Sink)
    // Div F = dFx/dx + dFy/dy
    getDivergence(lat, lng) {
        const delta = 0.0001; // Small step (~10m)
        const v_right = this.getVector(lat, lng + delta); // (x+h, y)
        const v_left  = this.getVector(lat, lng - delta); // (x-h, y)
        const v_up    = this.getVector(lat + delta, lng); // (x, y+h)
        const v_down  = this.getVector(lat - delta, lng); // (x, y-h)
        
        // d(Fx)/dx ~ (v_right.dx - v_left.dx) / (2*delta)
        // d(Fy)/dy ~ (v_up.dy - v_down.dy) / (2*delta)
        
        const dFx_dx = (v_right.dx - v_left.dx) / (2 * delta);
        const dFy_dy = (v_up.dy - v_down.dy) / (2 * delta);
        
        return dFx_dx + dFy_dy;
    }

    // Calculate Curl (Vorticity)
    // Curl F = dFy/dx - dFx/dy
    getCurl(lat, lng) {
        const delta = 0.0001; // Small step
        const v_right = this.getVector(lat, lng + delta); // (x+h, y)
        const v_left  = this.getVector(lat, lng - delta); // (x-h, y)
        const v_up    = this.getVector(lat + delta, lng); // (x, y+h)
        const v_down  = this.getVector(lat - delta, lng); // (x, y-h)

        // d(Fy)/dx ~ (v_right.dy - v_left.dy) / (2*delta)
        // d(Fx)/dy ~ (v_up.dx - v_down.dx) / (2*delta)
        
        const dFy_dx = (v_right.dy - v_left.dy) / (2 * delta);
        const dFx_dy = (v_up.dx - v_down.dx) / (2 * delta);

        return dFy_dx - dFx_dy;
    }
}

// Export instance
window.ShineMap = new ShineMapManager();
