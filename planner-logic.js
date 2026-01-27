
window.PlannerApp = (function() {
    // Private State
    let map = null;
    let mapInitialized = false;
    let currentMode = 'map';
    let mapState = { days: [] };
    let mapAllItems = [];
    let currentMapRenderId = 0;
    let markerInstances = new Map(); // id -> marker
    let selectedMarkerIds = [];
    let editMode = 'none'; // 'none', 'date', 'order', 'transport'
    let lastHotspotClickTime = 0;
    let showRoute = true;
    let showTransportDetails = true;
    let mapGeocoder = null;
    let mapPlaceSearch = null;
    let homeMarker = null;

    // DOM Elements References
    let containerEl = null;

    // --- Core Methods ---

    async function init(container, planId) {
        containerEl = container;
        console.log('Initializing PlannerApp for plan:', planId);

        // Inject DOM
        injectDOM(container);
        
        // --- Restore Collaboration Module ---
        // Always inject UI placeholder, handles state internally
        const collabHTML = `
        <div class="collab-floating-module" id="collab-module" style="position: absolute; top: 80px; left: 20px; z-index: 1000;">
           <div class="collab-avatars" style="display: flex; gap: -8px;">
               <!-- Avatars injected here -->
               <div class="avatar-circle" title="You" style="width:32px;height:32px;background:#3b82f6;color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;border:2px solid white;">Me</div>
           </div>
           <button id="collab-invite-btn" style="margin-top:8px;background:white;border:1px solid #ddd;border-radius:20px;padding:4px 12px;font-size:12px;cursor:pointer;box-shadow:0 2px 5px rgba(0,0,0,0.1);">+ 邀请</button>
        </div>
        `;
        const wrapper = container.querySelector('.view-wrapper');
        if(wrapper) {
            const div = document.createElement('div');
            div.innerHTML = collabHTML;
            wrapper.appendChild(div.firstElementChild);
            
            // Bind Invite Button
            const inviteBtn = document.getElementById('collab-invite-btn');
            if (inviteBtn) {
                inviteBtn.onclick = () => {
                    const friendId = prompt("请输入好友ID进行邀请:");
                    if (friendId && typeof inviteFriend === 'function') {
                        inviteFriend(friendId);
                    } else if (friendId) {
                        alert("邀请功能暂不可用");
                    }
                };
            }
        }

        // Load Data
        if (typeof HKWL !== 'undefined') {
            HKWL.setCurrentPlan(planId);
            // Wait for data sync if needed, or just load local
            // For now, assume HKWL handles data loading
            if (HKWL.syncCurrentPlanFromCloud) {
                 await HKWL.syncCurrentPlanFromCloud().catch(console.error);
            }
            mapState = HKWL.loadPlanState() || { days: [] };
            mapAllItems = HKWL.loadWishlist() || [];
            console.log("Planner loaded data:", mapState, mapAllItems.length);
        } else {
            console.warn("HKWL global object not found!");
        }

        // Initialize Map Logic
        if (!mapInitialized) {
            await initMap();
            mapInitialized = true;
        } else {
            // Re-bind map to new container if needed? 
            // Actually AMap is bound to "map-container" ID.
            // Since we injected DOM with that ID, it might need re-creation or moving.
            // Simplest is to destroy old map and create new one if ID conflicts, 
            // but here we assume single instance usage or proper cleanup.
            if (map) {
                map.destroy();
                map = null;
            }
            await initMap();
        }

        // Initialize Block View (Wishlist/PlanList)
        if (HKWL.renderWishlistPage) {
            HKWL.renderWishlistPage();
        }

        // Bind Events
        bindEvents();
        
        // Setup Danger/Edit Buttons
        setupPlanDangerButton(planId);
        setupPlanNameEditButton(planId);

        // Switch to default mode
        switchMode('map');
    }

    function injectDOM(container) {
        container.innerHTML = `
        <div class="view-wrapper" style="height:100%; display:flex; flex-direction:column;">
            <!-- Header for Plan Title -->
            <div style="padding: 10px 20px; display: flex; align-items: center; justify-content: space-between; background: white; border-bottom: 1px solid #eee; z-index: 1001;">
                <div style="display: flex; align-items: center; gap: 15px;">
                     <button id="planner-back-btn" style="border:none; background:none; font-size:1.5rem; cursor:pointer;">&larr;</button>
                     <h1 id="plan-title" style="margin: 0; font-size: 1.2rem; font-weight: normal; color: #666;">Loading Plan...</h1>
                     <button id="plan-name-edit-btn" style="display:none; border:none; background:none; cursor:pointer; color:#999;" title="编辑计划名称">✎</button>
                     <select id="plan-status-select" style="margin-left: 10px; padding: 4px 8px; border-radius: 12px; border: 1px solid #ddd; font-size: 0.85rem;">
                        <option value="planning">筹备中</option>
                        <option value="in_progress">进行中</option>
                        <option value="completed">已结束</option>
                    </select>
                </div>
                <div class="mode-switcher">
                    <a href="javascript:void(0)" id="mode-map-btn" class="mode-btn active">地图模式</a>
                    <a href="javascript:void(0)" id="mode-block-btn" class="mode-btn">积木模式</a>
                </div>
            </div>

            <div class="view-slider" id="view-slider" style="transform: translateX(0); flex:1; overflow:hidden;">
                <!-- Map View -->
                <div class="view-slide" id="map-view">
                    <div class="map-container">
                        <div class="map-fullscreen-btn" id="map-fullscreen-btn" title="全屏模式" style="display:none;"><span>⛶</span></div>
                        
                        <div class="controls" id="map-controls">
                          <div class="controls-toggle" id="controls-toggle-btn">⚙️</div>
                          <div class="controls-content">
                            <!-- Search -->
                            <div class="map-module">
                                <div class="module-header">搜索</div>
                                <input id="map-search-input" type="text" placeholder="搜索地点..." style="width: 100%; padding: 5px; border: 1px solid #ddd; border-radius: 4px;">
                            </div>
                            <!-- View -->
                            <div class="map-module">
                                <div class="module-header">视图</div>
                                <div class="day-selector">
                                  <select id="day-select"><option value="all">全部行程</option></select>
                                </div>
                                <div style="margin-top: 8px; display: flex; flex-direction: column; gap: 4px;">
                                    <div style="display: flex; align-items: center;">
                                        <input type="checkbox" id="show-route-toggle" checked>
                                        <label for="show-route-toggle" style="margin-left: 5px; font-size: 14px;">显示路线</label>
                                    </div>
                                    <div style="display: flex; align-items: center;">
                                        <input type="checkbox" id="show-transport-toggle" checked>
                                        <label for="show-transport-toggle" style="margin-left: 5px; font-size: 14px;">显示交通</label>
                                    </div>
                                </div>
                            </div>
                            <!-- Edit -->
                            <div class="map-module">
                                <div class="module-header">编辑</div>
                                <div class="map-edit-wrapper">
                                    <button class="map-edit-btn" data-mode="date"><span>📅</span> 日期划分</button>
                                    <button class="map-edit-btn" data-mode="order"><span>🔢</span> 游玩顺序</button>
                                    <button class="map-edit-btn" data-mode="transport"><span>✨</span> 规划交通</button>
                                    <button class="map-edit-btn" data-mode="add-stay"><span>🏨</span> 添加住宿</button>
                                </div>
                            </div>
                          </div>
                        </div>
                        
                        <div id="edit-action-panel" class="edit-action-panel"></div>
                        <div id="map-container" style="height:100%; width:100%; position:relative;">
                             <div id="map-debug-overlay" style="position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(255,255,255,0.9); z-index:10000; display:flex; flex-direction:column; justify-content:center; align-items:center; color:#333; pointer-events:none;">
                                 <div style="font-size:18px; margin-bottom:10px;">地图加载中...</div>
                                 <div style="font-size:12px; color:#666;">Waiting for AMap...</div>
                             </div>
                        </div>
                    </div>
                </div>

                <!-- Block View -->
                <div class="view-slide layout-main" id="block-view">
                    <section class="main-column">
                      <h2>任务栏</h2>
                      <div id="wish-list" class="card-list"></div>
                    </section>
                
                    <aside class="side-column">
                      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                          <h2 style="margin: 0;">计划列表</h2>
                      </div>
                      <div id="plan-days" class="plan-days"></div>
                      <div id="plan-list" class="plan-list"></div>
                      <p class="plan-hint">将左侧的旅行项目拖动到此处，按天组成你的计划列表。</p>
                    </aside>
                </div>
            </div>
            
            <div class="floating-add-wrapper">
                <div class="floating-add-buttons">
                  <button id="plan-danger-btn" type="button" class="btn floating-add-btn" style="background:#f44336; color:#fff;">删除/退出计划</button>
                  <button id="add-menu-toggle" type="button" class="btn btn-primary floating-add-btn">添加项目</button>
                </div>
                <div id="add-menu" class="add-menu">
                   <a href="javascript:void(0)" class="btn btn-primary add-menu-item" data-type="transport">
                    <span class="add-menu-icon">+</span>
                    <span class="add-menu-type-label">交通</span>
                  </a>
                </div>
            </div>
        </div>
        `;
    }

    // --- Helper Functions ---
    
    function setupPlanDangerButton(planId) {
        const btn = document.getElementById('plan-danger-btn');
        if (btn) {
            btn.onclick = () => {
                if(confirm('确定要删除这个计划吗？')) {
                    if (typeof HKWL !== 'undefined' && HKWL.deletePlan) {
                         HKWL.deletePlan(planId).then(() => {
                             alert('计划已删除');
                             window.location.reload(); 
                         });
                    }
                }
            };
        }
    }

    function setupPlanNameEditButton(planId) {
         const btn = document.getElementById('plan-name-edit-btn');
         const title = document.getElementById('plan-title');
         if(btn && title) {
             btn.style.display = 'inline-block';
             btn.onclick = () => {
                 const newName = prompt('请输入新的计划名称:', title.textContent);
                 if(newName) {
                     title.textContent = newName;
                      if (typeof HKWL !== 'undefined' && HKWL.updatePlanTitle) {
                         HKWL.updatePlanTitle(planId, newName);
                      }
                 }
             }
         }
         // Initial title set (if not already set correctly)
         if (typeof HKWL !== 'undefined' && HKWL.getPlan) {
             const p = HKWL.getPlan(planId);
             if(p && title) title.textContent = p.title || '未命名计划';
         }
    }

    // --- Map Functions ---

    async function initMap() {
        try {
            // Force security config again just in case (Must be before AMap load/usage)
            if (!window._AMapSecurityConfig) {
                 window._AMapSecurityConfig = {
                    securityJsCode: "5fd8a936c191f539f49b6abf555b7f60",
                };
            }

            // Check if AMap is defined globally (from index.html script tag)
            let AMapObj = window.AMap;
            
            // If AMap is not available, try to ensure it loads
            if (!AMapObj) {
                // Wait for script to load if it's pending
                console.log("AMap not ready, waiting...");
                await new Promise(r => setTimeout(r, 1000));
                AMapObj = window.AMap;
                
                if (!AMapObj) {
                    // Try dynamic load as last resort
                     await new Promise((resolve, reject) => {
                        const script = document.createElement('script');
                        script.src = "https://webapi.amap.com/maps?v=2.0&key=d9c65691d03429f44f54c935d21a59a7";
                        script.onload = () => resolve();
                        script.onerror = () => reject(new Error("Failed to load AMap script"));
                        document.head.appendChild(script);
                    });
                    // Wait for window.AMap to be populated after script load
                    await new Promise(r => setTimeout(r, 500));
                    AMapObj = window.AMap;
                }
            }
            
            if (!AMapObj) {
                 const debugOverlay = document.getElementById('map-debug-overlay');
                 if (debugOverlay) debugOverlay.innerHTML = '<div style="color:red; font-size:16px;">AMap Load Failed. Check Console.</div>';
                 throw new Error("AMap failed to load after retry");
            }
            
            const AMap = AMapObj; 

            // IMPORTANT: Load plugins explicitly before using them
            await new Promise((resolve) => {
                AMap.plugin([
                    "AMap.Scale", 
                    "AMap.ToolBar", 
                    "AMap.ControlBar", 
                    "AMap.Driving", 
                    "AMap.Walking", 
                    "AMap.Transfer", 
                    "AMap.Geocoder", 
                    "AMap.PlaceSearch", 
                    "AMap.AutoComplete"
                ], resolve);
            });

            // Container Size Check & Fix
            const containerEl = document.getElementById("map-container");
            if (containerEl) {
                const rect = containerEl.getBoundingClientRect();
                console.log("Map Container Init Size:", rect.width, rect.height);
                if (rect.height === 0 || rect.width === 0) {
                     console.warn("Map container size is 0, forcing layout...");
                     containerEl.style.height = "100%";
                     containerEl.style.width = "100%";
                     if (containerEl.parentElement) {
                         containerEl.parentElement.style.height = "100%";
                         containerEl.parentElement.style.width = "100%";
                         containerEl.parentElement.style.flex = "1";
                     }
                }
            }
            
            console.log("Initializing Map (v2026-01-26-Force2D)...");
            
            map = new AMap.Map("map-container", {
                zoom: 4,
                center: [105.0, 35.0], 
                viewMode: '2D', // Force 2D for maximum compatibility
                features: ['bg', 'road', 'building', 'point'],
                doubleClickZoom: false,
                isHotspot: true
            });

            // Force resize after a delay to ensure container size is correct
            setTimeout(() => {
                map.resize();
            }, 500);
            
            // Continuous resize check (for 2 seconds)
            let resizeCount = 0;
            const resizeInterval = setInterval(() => {
                map.resize();
                resizeCount++;
                if (resizeCount > 10) clearInterval(resizeInterval);
            }, 200);
            
            map.on('complete', () => {
                console.log("Map loading completed");
                // Force resize to ensure tiles render
                map.resize();
                const debugOverlay = document.getElementById('map-debug-overlay');
                if (debugOverlay) debugOverlay.style.display = 'none';
            });

            map.addControl(new AMap.Scale());
            map.addControl(new AMap.ToolBar({ position: 'RB' }));

            // Search
            const auto = new AMap.AutoComplete({ input: "map-search-input", city: "香港" });
            const searchPlace = new AMap.PlaceSearch({ city: "香港" });
            
            auto.on("select", function(e) {
                const poi = e.poi;
                if (!poi) return;
                if (poi.location) {
                    map.setCenter(poi.location);
                    map.setZoom(15);
                    // setSelection(poi.name, poi.type, poi.address, poi.location); // Need to implement setSelection or import it
                } else {
                    searchPlace.search(poi.name, (status, result) => {
                        if (status === 'complete' && result.poiList && result.poiList.pois && result.poiList.pois.length > 0) {
                            const p = result.poiList.pois[0];
                            map.setCenter(p.location);
                            map.setZoom(15);
                            // setSelection(p.name, p.type, p.address, p.location);
                        }
                    });
                }
            });

            mapGeocoder = new AMap.Geocoder({ city: "香港" });
            mapPlaceSearch = new AMap.PlaceSearch({ city: "香港" });

            map.on('click', handleMapClick);
            map.on('dblclick', handleMapDoubleClick);
            // map.on('hotspotclick', handleHotspotClick);

            updateDaySelector();
            const daySelect = document.getElementById('day-select');
            if(daySelect) renderMap(daySelect.value);

            // loadHomeMarker(); 

        } catch (e) {
            console.error("Map Init Error", e);
            document.getElementById('map-container').innerHTML = 
                '<div style="display:flex;justify-content:center;align-items:center;height:100%;color:#666;">地图加载失败，请检查网络设置</div>';
        }
    }

    function renderMap(dayMode) {
        if (!map) return;
        currentMapRenderId++;
        const myRenderId = currentMapRenderId;
        
        map.clearMap();
        markerInstances.clear();
        
        // Re-add home marker if exists
        if (homeMarker) map.add(homeMarker);

        let items = [];
        if (dayMode === 'all') {
            // Flatten all days
            mapState.days.forEach(dayList => {
                dayList.forEach(id => {
                    const item = mapAllItems.find(i => i.id === id);
                    if (item) items.push(item);
                });
            });
        } else {
            const dayIndex = parseInt(dayMode) - 1;
            if (mapState.days[dayIndex]) {
                mapState.days[dayIndex].forEach(id => {
                     const item = mapAllItems.find(i => i.id === id);
                    if (item) items.push(item);
                });
            }
        }

        // Render Markers
        items.forEach((item, index) => {
            if (!item.location && (!item.coords || !item.coords.lat)) return;
            // Simplified rendering logic...
            // In a real implementation, we would copy the full render logic from planner.html
            // For now, let's just create basic markers to prove the concept
            const lat = item.location ? item.location.lat : item.coords.lat;
            const lng = item.location ? item.location.lng : item.coords.lng;
            
            const marker = new AMap.Marker({
                position: new AMap.LngLat(lng, lat),
                title: item.name
            });
            map.add(marker);
            markerInstances.set(item.id, marker);
        });
        
        map.setFitView();
    }
    
    // --- Interaction & Events ---

    function handleMapClick(e) {
        // Logic to handle map click (deselect, etc.)
    }
    
    function handleMapDoubleClick(e) {
        // Logic for adding stays
    }

    function bindEvents() {
        document.getElementById('mode-map-btn').addEventListener('click', () => switchMode('map'));
        document.getElementById('mode-block-btn').addEventListener('click', () => switchMode('block'));
        
        document.getElementById('day-select').addEventListener('change', (e) => {
            renderMap(e.target.value);
        });

        document.getElementById('planner-back-btn').addEventListener('click', () => {
             // Logic to close the planner view and return to home
             console.log('Planner back button clicked');
             // Default behavior: do nothing, let parent handle it.
             // window.location.reload(); // REMOVED: Caused unnecessary reload
        });
        
        // Add menu toggles
        document.getElementById('add-menu-toggle').addEventListener('click', () => {
            const menu = document.getElementById('add-menu');
            menu.classList.toggle('show');
        });

        // Toggle Route/Transport
        document.getElementById('show-route-toggle').addEventListener('change', (e) => {
            showRoute = e.target.checked;
            renderMap(document.getElementById('day-select').value);
        });
         document.getElementById('show-transport-toggle').addEventListener('change', (e) => {
            showTransportDetails = e.target.checked;
            renderMap(document.getElementById('day-select').value);
        });
        
        // Map Controls Toggle
         document.getElementById('controls-toggle-btn').addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent map click
            const controls = document.getElementById('map-controls');
            controls.classList.toggle('collapsed'); // Use 'collapsed' class instead of 'expanded' logic reverse
            
            // Or if CSS uses .expanded to show content, then toggle .expanded.
            // Let's check CSS. Assuming we want to toggle visibility of content.
            // If the original code was toggling .expanded, maybe default is collapsed?
            // "controls-content" is usually hidden or shown.
            
            // Let's assume a simple toggle class on the parent
            controls.classList.toggle('is-open');
        });

        // Edit Buttons
        document.querySelectorAll('.map-edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = btn.dataset.mode;
                toggleEditMode(mode);
            });
        });
    }

    function switchMode(mode) {
        currentMode = mode;
        const slider = document.getElementById('view-slider');
        const mapBtn = document.getElementById('mode-map-btn');
        const blockBtn = document.getElementById('mode-block-btn');
        const floatWrapper = document.querySelector('.floating-add-wrapper');

        if (mode === 'map') {
            slider.style.transform = 'translateX(0)';
            mapBtn.classList.add('active');
            blockBtn.classList.remove('active');
            if (floatWrapper) floatWrapper.style.display = 'none';
            
            // Resize map
            if (map) setTimeout(() => map.resize(), 300);
        } else {
            slider.style.transform = 'translateX(-50%)';
            mapBtn.classList.remove('active');
            blockBtn.classList.add('active');
             if (floatWrapper) floatWrapper.style.display = 'block';
        }
    }
    
    function updateDaySelector() {
        const daySelect = document.getElementById('day-select');
        if (!daySelect) return;
        
        // Clear except first
        while (daySelect.options.length > 1) daySelect.remove(1);
        
        mapState.days.forEach((_, index) => {
            const option = document.createElement('option');
            option.value = index + 1;
            option.textContent = `第 ${index + 1} 天`;
            daySelect.appendChild(option);
        });
    }

    function toggleEditMode(mode) {
        editMode = (editMode === mode) ? 'none' : mode;
        // Update UI buttons active state
        document.querySelectorAll('.map-edit-btn').forEach(btn => {
            if (btn.dataset.mode === editMode) btn.classList.add('active');
            else btn.classList.remove('active');
        });
        
        // Show/Hide Action Panel based on mode
        const panel = document.getElementById('edit-action-panel');
        if (editMode !== 'none') {
            panel.innerHTML = getActionPanelContent(editMode);
            panel.classList.add('show');
        } else {
            panel.classList.remove('show');
        }
    }

    function getActionPanelContent(mode) {
        if (mode === 'date') return `<span class="panel-text">点击地图上的项目进行日期划分</span><button class="panel-btn panel-btn-cancel" onclick="PlannerApp.cancelEdit()">完成</button>`;
        if (mode === 'order') return `<span class="panel-text">选择项目调整顺序</span><button class="panel-btn panel-btn-primary" onclick="PlannerApp.confirmOrder()">确认排序</button>`;
        return `<button class="panel-btn panel-btn-cancel" onclick="PlannerApp.cancelEdit()">退出</button>`;
    }
    
    // Public API
    return {
        init: init,
        cancelEdit: () => toggleEditMode('none'),
        confirmOrder: () => { alert('Sort logic here'); toggleEditMode('none'); }
    };

})();
