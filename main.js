const HKWL = (() => {
  console.log("Main.js v106 loaded");
  // Auth Check
  if (typeof Auth !== 'undefined' && 
      !window.location.pathname.endsWith('login.html')) {
      Auth.requireLogin();
  }

  function getPlanIndexKey() {
      return (typeof Auth !== 'undefined') ? Auth.getUserKey("hkwl_plans_index") : "hkwl_plans_index";
  }

  let currentPlanId = "hk"; // Default to 'hk' for backward compatibility
  let internalRefresh = () => {}; // Exposed for refreshing block view

  function getStorageKey() { return Auth.getUserKey(`${currentPlanId}_wishlist`); }
  function getPlanKey() { return Auth.getUserKey(`${currentPlanId}_wishlist_plan`); }
  function getCollapsedKey() { return Auth.getUserKey(`${currentPlanId}_wishlist_collapsed`); }
  function getSettingsKey() { return Auth.getUserKey(`${currentPlanId}_wishlist_settings`); }

  // --- User Feature Helper Functions ---
  function getUserId() {
        // Use Auth manager if available, or parse token manually as fallback
        if (typeof Auth !== 'undefined' && Auth.getUserId) { 
            // Note: Auth.getUserId() doesn't exist yet, we only saw getCurrentUser()
            // So we use the manual token parsing method
        }
        const token = sessionStorage.getItem('hkwl_auth_token');
        if (!token) return null;
        return token.split(':')[0];
    }

    function getCurrentPlanCollaborators() {
        if (!currentPlanId) return [];
        try {
            const plans = getPlans();
            const p = plans.find(x => x.id === currentPlanId);
            // If p.collaborators is populated (objects), map to standardized structure
            // If it's IDs (strings), we might need to fetch info, but for now assume objects if available
            // Note: CloudSync/API usually populates this
            if (p && Array.isArray(p.collaborators)) {
                return p.collaborators.map(c => {
                    if (!c) return null;
                    if (typeof c === 'object') {
                        return { id: c._id || c.id || c.friendId, name: c.nickname || c.username || c.friendId, avatar: c.avatar };
                    }
                    return { id: c, name: c, avatar: null }; // Fallback for raw IDs
                }).filter(Boolean);
            }
        } catch(e) { console.error("Error getting collaborators", e); }
        return [];
    }

    function getFeatureEnabled(item, type) {
      // 1. Check strict user-scoped features first (New Object Format)
      if (item.features && typeof item.features === 'object' && !Array.isArray(item.features)) {
              const userId = getUserId();
              if (!userId) return false;
              const userFeatures = item.features[userId] || [];
              return userFeatures.includes(type);
      }
      
      // 2. Fallback to legacy array (Global Shared)
      if (Array.isArray(item.features)) {
          return item.features.includes(type);
      }
      
      // 3. Fallback to data existence (Legacy implicit)
      // Only if features is completely undefined
      if (!item.features) {
          if (type === 'tickets' && item.tickets && item.tickets.length > 0) return true;
          if (type === 'reminders' && item.reminders && item.reminders.length > 0) return true;
      }
      
      return false;
  }

  function setFeatureEnabled(item, type, isEnabled) {
      const userId = getUserId();
      if (!userId) return; // Guard against no user

      // Initialize features object if needed
      if (!item.features || Array.isArray(item.features)) {
          const oldFeatures = Array.isArray(item.features) ? item.features : [];
          item.features = {};
          // Migrate legacy features to current user so they don't disappear for the editor
          item.features[userId] = [...oldFeatures];
      }

      if (!item.features[userId]) {
          item.features[userId] = [];
      }

      if (isEnabled) {
          if (!item.features[userId].includes(type)) {
              item.features[userId].push(type);
          }
      } else {
          item.features[userId] = item.features[userId].filter(f => f !== type);
      }
  }
  // --- End User Feature Helper Functions ---


  // Init Header Profile
  document.addEventListener("DOMContentLoaded", () => {
      const header = document.querySelector('.site-header');
      if (!header) return;

      if (typeof Auth !== 'undefined' && Auth.getCurrentUser()) {
          const userDiv = document.createElement('div');
          userDiv.style.marginLeft = 'auto';
          userDiv.style.display = 'flex';
          userDiv.style.alignItems = 'center';
          userDiv.style.gap = '1rem';
          
          const userAvatar = document.createElement('div');
          userAvatar.style.width = '32px';
          userAvatar.style.height = '32px';
          userAvatar.style.borderRadius = '50%';
          userAvatar.style.background = 'rgba(0,0,0,0.05)';
          userAvatar.style.display = 'flex';
          userAvatar.style.alignItems = 'center';
          userAvatar.style.justifyContent = 'center';
          userAvatar.style.marginRight = '0.5rem';
          userAvatar.style.fontSize = '1.2rem';
          userAvatar.style.overflow = 'hidden';
          userAvatar.style.cursor = 'pointer'; // Make clickable
          userAvatar.title = '个人信息与设置'; // Tooltip
          
          // Click to go to profile
          userAvatar.onclick = () => {
              window.location.href = 'profile.html';
          };

          const userName = document.createElement('span');
          userName.style.fontSize = '0.9rem';
          
          const updateUserInfo = () => {
              const fid = Auth.getFriendId();
              const nickname = Auth.getNickname();
              const avatar = Auth.getAvatar();
              const displayVal = nickname || Auth.getCurrentUser();
              
              userName.innerHTML = `你好, ${displayVal}${fid ? ` <span style="opacity:0.7; font-size:0.8em; margin-left:4px; cursor:help;" title="这是你的好友ID，分享给朋友以添加好友">#${fid}</span>` : ''}`;
              
              if (avatar && (avatar.startsWith('http') || avatar.startsWith('data:'))) {
                   userAvatar.innerHTML = `<img src="${avatar}" style="width:100%; height:100%; object-fit:cover;">`;
              } else {
                   userAvatar.textContent = avatar || "👤";
              }
          };
          updateUserInfo();
          
          // Always refresh to get the latest profile info (avatar/nickname)
          Auth.refreshAdminStatus().then(updateUserInfo);

          userDiv.appendChild(userAvatar);
          userDiv.appendChild(userName);

          // Only show System Settings button on Index page (Home)
          const path = window.location.pathname;
          // Flexible check for home page
          const isHomePage = path === '/' || path.endsWith('/index.html') || path.endsWith('/index');
          
          if (isHomePage) {
              
              const createIconButton = (svg, title, onClick) => {
                  const btn = document.createElement('button');
                  btn.innerHTML = svg;
                  btn.title = title;
                  btn.style.background = 'rgba(0,0,0,0.05)';
                  btn.style.border = 'none';
                  btn.style.color = '#555';
                  btn.style.width = '32px';
                  btn.style.height = '32px';
                  btn.style.padding = '0';
                  btn.style.borderRadius = '4px';
                  btn.style.display = 'flex';
                  btn.style.alignItems = 'center';
                  btn.style.justifyContent = 'center';
                  btn.style.cursor = 'pointer';
                  btn.onclick = onClick;
                  return btn;
              };

              // Manual Button
              const manualBtn = createIconButton(
                  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
                  '使用说明',
                  () => { if (typeof Manual !== 'undefined') Manual.open(); }
              );
              userDiv.appendChild(manualBtn);

              // Mailbox Button
              const mailboxBtn = createIconButton(
                  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
                  '信箱',
                  () => { if (typeof Mailbox !== 'undefined') Mailbox.open(); }
              );
              mailboxBtn.style.position = 'relative';
              
              // Badge for unread messages
              const badge = document.createElement('div');
              badge.style.position = 'absolute';
              badge.style.top = '-5px';
              badge.style.right = '-5px';
              badge.style.backgroundColor = '#ff4d4f';
              badge.style.color = 'white';
              badge.style.fontSize = '0.7rem';
              badge.style.height = '16px';
              badge.style.minWidth = '16px';
              badge.style.padding = '0 4px';
              badge.style.borderRadius = '8px';
              badge.style.display = 'none'; // Hidden by default
              badge.style.alignItems = 'center';
              badge.style.justifyContent = 'center';
              badge.style.fontWeight = 'bold';
              badge.style.boxShadow = '0 1px 2px rgba(0,0,0,0.2)';
              mailboxBtn.appendChild(badge);
              userDiv.appendChild(mailboxBtn);

              // Notice Board Button
              const noticeBtn = createIconButton(
                  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
                  '告示栏',
                  () => { if (typeof NoticeViewer !== 'undefined') NoticeViewer.openNoticeBoard(); }
              );
              noticeBtn.style.position = 'relative';

              // Badge for new notices
              const noticeBadge = document.createElement('div');
              noticeBadge.style.position = 'absolute';
              noticeBadge.style.top = '-5px';
              noticeBadge.style.right = '-5px';
              noticeBadge.style.backgroundColor = '#ff4d4f';
              noticeBadge.style.color = 'white';
              noticeBadge.style.fontSize = '0.7rem';
              noticeBadge.style.height = '16px';
              noticeBadge.style.minWidth = '16px';
              noticeBadge.style.padding = '0 4px';
              noticeBadge.style.borderRadius = '8px';
              noticeBadge.style.display = 'none'; // Hidden by default
              noticeBadge.style.alignItems = 'center';
              noticeBadge.style.justifyContent = 'center';
              noticeBadge.style.fontWeight = 'bold';
              noticeBadge.style.boxShadow = '0 1px 2px rgba(0,0,0,0.2)';
              noticeBtn.appendChild(noticeBadge);
              
              userDiv.appendChild(noticeBtn);
              
              // Initialize Badge
              if (typeof Mailbox !== 'undefined') {
                  Mailbox.setBadge(badge);
              }
              if (typeof NoticeViewer !== 'undefined') {
                  NoticeViewer.setBadge(noticeBadge);
                  // Check immediately for popup (autoPopup=true)
                  NoticeViewer.checkAndShowNotice(true);
                  // Start polling for new notices (every 60 seconds)
                  NoticeViewer.startPolling(60000);
              }


          }
          
          // Insert before the last child if it's nav-link, or append
          header.appendChild(userDiv);
          
              // Trigger Initial Sync
              // Block saves during initial sync to prevent race conditions (e.g. UI rendering stale data and saving it)
              isReloading = true; 
              syncFromCloud().then(changed => {
                  if (changed) {
                      console.log("Data synced from cloud, reloading...");
                      
                      // Loop Protection
                      let reloadCount = 0;
                      const lastReloadTime = parseInt(sessionStorage.getItem('hkwl_reload_time') || '0');
                      const now = Date.now();
                      
                      if (now - lastReloadTime < 5000) { // If reloaded within last 5 seconds
                          reloadCount = parseInt(sessionStorage.getItem('hkwl_reload_count') || '0') + 1;
                      }
                      
                      sessionStorage.setItem('hkwl_reload_time', now.toString());
                      sessionStorage.setItem('hkwl_reload_count', reloadCount.toString());
                      
                      if (reloadCount > 3) {
                          console.error("Reload loop detected! Stopping auto-reload.");
                          showToast("检测到同步循环，停止自动刷新。请手动刷新页面。", "error");
                          isReloading = false;
                      } else {
                          window.location.reload();
                      }
                  } else {
                      isReloading = false; // Release lock if no reload needed
                  }
              }).catch(() => {
                  isReloading = false; // Release lock on error
              });
      } else {
          // Not logged in
          const loginBtn = document.createElement('a');
          loginBtn.href = 'login.html';
          loginBtn.textContent = '登录 / 注册';
          loginBtn.style.color = 'white';
          loginBtn.style.textDecoration = 'none';
          loginBtn.style.fontWeight = 'bold';
          loginBtn.style.border = '1px solid rgba(255,255,255,0.5)';
          loginBtn.style.padding = '0.5rem 1rem';
          loginBtn.style.borderRadius = '4px';
          loginBtn.style.marginLeft = 'auto'; // Push to right
          
          header.appendChild(loginBtn);
      }
  });

  function setCurrentPlan(id) {
    if (id) currentPlanId = id;
  }

  // --- Cloud Sync Helpers ---
  let lastLocalWriteTime = 0;
  let isPulling = false; // Lock to prevent push during pull
  let isReloading = false; // Lock to prevent any saves during reload
  let pushDebounceTimer = null; // Timer for debouncing push
  
  function markLocalDirty() {
      if (isReloading) return; // Don't mark dirty if we are in middle of reload
      lastLocalWriteTime = Date.now();
      try {
          sessionStorage.setItem('hkwl_local_dirty_time', lastLocalWriteTime.toString());
      } catch(e) {}
  }

  function isLocalDirty() {
      if (Date.now() - lastLocalWriteTime < 2000) return true; 
      try {
          const stored = sessionStorage.getItem('hkwl_local_dirty_time');
          if (stored) {
              const t = parseInt(stored, 10);
              if (!isNaN(t) && (Date.now() - t < 2000)) {
                  lastLocalWriteTime = t; 
                  return true;
              }
          }
      } catch(e) {}
      return false;
  }

  // --- Merge Helper ---
  function mergeItems(baseItems, mineItems, theirsItems) {
    const baseMap = new Map(baseItems.map(i => [i.id, i]));
    const mineMap = new Map(mineItems.map(i => [i.id, i]));
    const theirsMap = new Map(theirsItems.map(i => [i.id, i]));
    
    const allIds = new Set([...baseMap.keys(), ...mineMap.keys(), ...theirsMap.keys()]);
    const result = [];
    
    for (const id of allIds) {
        const inBase = baseMap.has(id);
        const inMine = mineMap.has(id);
        const inTheirs = theirsMap.has(id);
        
        if (inMine) {
            if (inTheirs) {
                // Both have it. Check for changes.
                const mineItem = mineMap.get(id);
                const theirsItem = theirsMap.get(id);
                const baseItem = baseMap.get(id);
                
                // If base is missing (new item in both?), assume mine wins conflict
                if (!baseItem) {
                     result.push(mineItem);
                     continue;
                }

                const mineChanged = JSON.stringify(mineItem) !== JSON.stringify(baseItem);
                const theirsChanged = JSON.stringify(theirsItem) !== JSON.stringify(baseItem);

                if (mineChanged) {
                    if (theirsChanged) {
                        // Conflict: Both changed. Prioritize Local (Mine).
                        // Optional: Could add conflict flag or merge properties
                        result.push(mineItem);
                    } else {
                        // Only Mine changed. Keep Mine.
                        result.push(mineItem);
                    }
                } else {
                    if (theirsChanged) {
                        // Only Theirs changed. Keep Theirs.
                        result.push(theirsItem);
                    } else {
                        // Neither changed. Keep Mine (same as Theirs).
                        result.push(mineItem);
                    }
                }
            } else {
                // Mine has it, Theirs doesn't.
                if (inBase) {
                    // It was in Base, so Theirs deleted it.
                    // Action: Delete (Exclude).
                } else {
                    // Not in Base. So Mine added it.
                    // Action: Keep.
                    result.push(mineMap.get(id));
                }
            }
        } else {
            // Not in Mine.
            if (inTheirs) {
                if (inBase) {
                    // Was in Base. So Mine deleted it.
                    // Action: Delete (Exclude).
                } else {
                    // Not in Base. So Theirs added it.
                    // Action: Keep (Take Theirs).
                    result.push(theirsMap.get(id));
                }
            } else {
                // Not in Mine, Not in Theirs. (Only in Base).
                // Both deleted it.
                // Action: Delete.
            }
        }
    }
    return result;
  }

  async function syncToCloud() {
    if (typeof CloudSync === 'undefined' || !CloudSync.isLoggedIn()) return;
    if (isReloading) return;
    
    markLocalDirty(); 

    // Debounce Logic:
    // If a push is already pending, clear it and restart timer.
    // This aggregates rapid changes (like typing) into a single push.
    if (pushDebounceTimer) {
        clearTimeout(pushDebounceTimer);
    }

    return new Promise((resolve) => {
        pushDebounceTimer = setTimeout(async () => {
            if (isReloading) { resolve(); return; }

            // Wait if Pull is in progress (Reader-Writer Lock)
            // We poll until lock is released
            while(isPulling) {
                if (isReloading) { resolve(); return; }
                await new Promise(r => setTimeout(r, 100));
            }

            const username = Auth.getCurrentUser();
            if (!username) {
                resolve();
                return;
            }

            const isEditingContext = typeof window !== 'undefined' && (
                window.location.pathname.includes('planner.html') || 
                window.location.pathname.includes('settings.html') ||
                window.location.pathname.includes('manage.html')
            );

            let sharedSyncPromise = Promise.resolve();

            if (isEditingContext && currentPlanId) {
                const plans = getPlans();
                const currentPlan = plans.find(p => p.id === currentPlanId);
                
                if (currentPlan && (currentPlan.isCloud || currentPlan.cloudId)) {
                    const cloudId = currentPlan.cloudId || currentPlan.id;
                    
                    // Fetch-Merge-Push Strategy to prevent overwriting deletions
                    sharedSyncPromise = (async () => {
                        try {
                            // 1. Fetch Latest Cloud Data
                            const cloudRes = await CloudSync.getPlan(cloudId);
                            let mergedItems = [];
                            let finalPlanState = {};
                            
                            if (cloudRes.success && cloudRes.plan) {
                                const cloudContent = cloudRes.plan.content || {};
                                const cloudItems = cloudContent.items || [];
                                // const cloudState = cloudContent.planState || {}; // Merge state if needed later
                                
                                const localItems = loadWishlist();
                                finalPlanState = loadPlanState();
                                
                                // 2. Load Snapshot (Base)
                                const snapshotKey = Auth.getUserKey(`${currentPlanId}_wishlist_snapshot`);
                                let baseItems = [];
                                try {
                                    const rawSnap = localStorage.getItem(snapshotKey);
                                    if (rawSnap) baseItems = JSON.parse(rawSnap);
                                    else baseItems = cloudItems; // Init snapshot from cloud if missing
                                } catch(e) { baseItems = cloudItems; }
                                
                                // 3. Merge
                                mergedItems = mergeItems(baseItems, localItems, cloudItems);
                                
                                // 4. Update Local Storage & Snapshot with Merged Data
                                saveWishlistLocal(mergedItems, true);
                                localStorage.setItem(snapshotKey, JSON.stringify(mergedItems));
                                
                            } else {
                                // Offline or fetch failed: Fallback to Blind Push
                                mergedItems = loadWishlist();
                                finalPlanState = loadPlanState();
                            }

                            const content = {
                                planState: finalPlanState,
                                items: mergedItems
                            };
                            
                            // 5. Push Merged Content
                            // Pass null for title to avoid "rename" permission check
                            const res = await CloudSync.updatePlan(cloudId, null, content);
                            if (res.error) console.warn("Shared plan background sync warning:", res.error);
                            return res;
                        } catch (e) {
                            console.error("Shared plan background sync error:", e);
                            return { error: e.message };
                        }
                    })();
                }
            }
            
            const prefix = `${username}_`;
            const data = {};
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(prefix)) {
                    data[key] = localStorage.getItem(key);
                }
            }
            const indexKey = getPlanIndexKey();
            if (indexKey.startsWith(prefix)) {
                data[indexKey] = localStorage.getItem(indexKey);
            }
            
            const [pushRes] = await Promise.all([
                CloudSync.pushData(data),
                sharedSyncPromise
            ]);

            resolve(pushRes);
        }, 1000); // 1s Debounce
    });
  }

  async function syncFromCloud() {
    if (typeof CloudSync === 'undefined' || !CloudSync.isLoggedIn()) return;
    
    // If local was modified very recently, SKIP pull to prevent overwriting new local data with old cloud data.
    if (isLocalDirty()) {
        console.log("Local data modified recently. Skipping pull to prevent overwrite.");
        // Optional: Trigger a push to ensure cloud catches up, but don't await it here to block UI
        syncToCloud().catch(console.error);
        return false;
    }

    // Set Lock
    isPulling = true;

    try {
        const res = await CloudSync.pullData();

        // Check if local was modified DURING the pull (Race condition fix)
        if (isLocalDirty()) {
            console.warn("Local data modified during pull. Discarding cloud data to prevent overwrite.");
            return false;
        }

        if (res.success && res.data) {
            let changed = false;
            const cloudKeys = new Set(Object.keys(res.data));
            const username = Auth.getCurrentUser();
            const prefix = username ? `${username}_` : "";

            // 1. Update/Add from Cloud
            for (const [key, value] of Object.entries(res.data)) {
                const localVal = localStorage.getItem(key);
                // Strict check: if strings are identical, skip
                if (localVal === value) continue;

                // Semantic check: try to parse as JSON and compare structure
                // This prevents infinite reload loops caused by JSON formatting differences (spaces, key order)
                let isSemanticallyEqual = false;
                try {
                    // Only attempt parsing if both look like JSON objects/arrays
                    if (value && localVal && 
                        (value.startsWith('{') || value.startsWith('[')) && 
                        (localVal.startsWith('{') || localVal.startsWith('['))) {
                        
                        const cloudObj = JSON.parse(value);
                        const localObj = JSON.parse(localVal);
                        // Quick canonicalization via stringify (not perfect but good enough for most stable JSON engines)
                        if (JSON.stringify(cloudObj) === JSON.stringify(localObj)) {
                            isSemanticallyEqual = true;
                        }
                    }
                } catch(e) {
                    // Ignore parse errors, fall back to string comparison (which already failed)
                }

                if (!isSemanticallyEqual) {
                    console.log(`Cloud sync update for key: ${key}`);
                    // console.log(`Old: ${localVal?.slice(0, 50)}...`);
                    // console.log(`New: ${value?.slice(0, 50)}...`);
                    localStorage.setItem(key, value);
                    
                    // NEW: Update snapshot if this is a wishlist (for 3-way merge base)
                    if (key.endsWith('_wishlist')) {
                         const snapshotKey = key + '_snapshot';
                         localStorage.setItem(snapshotKey, value);
                    }
                    
                    changed = true;
                }
            }

            // 2. Remove local keys not in Cloud (for this user) - Handles deletions
            if (prefix) {
                const keysToRemove = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith(prefix) && !cloudKeys.has(key)) {
                        keysToRemove.push(key);
                    }
                }
                
                if (keysToRemove.length > 0) {
                    keysToRemove.forEach(k => localStorage.removeItem(k));
                    changed = true;
                }
            }

            return changed;
        }
    } catch (e) {
        console.error("Sync failed", e);
    } finally {
        isPulling = false; // Release Lock
    }
    return false;
  }
  // --------------------------

  function getPlans() {
    try {
      const raw = window.localStorage.getItem(getPlanIndexKey());
      
      // First time initialization (only if key doesn't exist)
      if (raw === null) {
          const plans = [];
          return plans;
      }
      
      const plans = JSON.parse(raw);
      // Return all plans, including local-only ones, so users can see what they added
      return plans;
    } catch (e) {
      console.error("Failed to load plans", e);
      return [];
    }
  }

  async function savePlans(plans) {
      try {
          window.localStorage.setItem(getPlanIndexKey(), JSON.stringify(plans));
          markLocalDirty();
          await syncToCloud();
      } catch (e) {
          console.error("Failed to save plans", e);
      }
  }

  async function createPlan(title) {
      // Ensure CloudSync is available and user is logged in
      if (typeof CloudSync === 'undefined' || !CloudSync.isLoggedIn()) {
          alert("请先登录以创建云端计划");
          // Redirect to login or settings?
          // For now just stop.
          return null;
      }

      try {
          const res = await CloudSync.createPlan(title || '新计划', { 
              planState: { days: [[]], titles: [] }, 
              items: [] 
          }, 'planning');
          
          if (res.success && res.plan) {
              const newPlan = {
                  id: res.plan._id,
                  title: res.plan.title,
                  updatedAt: res.plan.updatedAt,
                  isCloud: true,
                  cloudId: res.plan._id,
                  status: res.plan.status || 'planning',
                  owner: res.plan.owner,
                  collaborators: res.plan.collaborators || []
              };
              
              const plans = getPlans();
              plans.push(newPlan);
              savePlans(plans);
              
              return res.plan._id;
          }
          
          if (res.error) {
              alert("创建失败: " + res.error);
          }
      } catch(e) {
          console.error("Cloud creation exception:", e);
          alert("创建时发生错误");
      }
      return null;
  }

  async function updatePlanStatus(id, status) {
      if (!status) return false;
      
      const plans = getPlans();
      const plan = plans.find(p => p.id === id);
      if (!plan) return false;
      
      plan.status = status;
      window.localStorage.setItem(getPlanIndexKey(), JSON.stringify(plans));
      markLocalDirty();
      
      if (plan.isCloud || plan.cloudId) {
          const cloudId = plan.cloudId || plan.id;
          try {
              if (typeof CloudSync !== 'undefined' && CloudSync.isLoggedIn()) {
                  // Pass null for title/content to avoid side effects/permission errors
                  const res = await CloudSync.updatePlan(cloudId, null, null, status);
                  if (res.error) {
                      console.error("Cloud status update failed:", res.error);
                      showToast("云端状态更新失败: " + res.error, "error");
                  }
              }
          } catch(e) {
              console.error("Failed to update cloud plan status", e);
          }
      }
      
      return await syncToCloud();
  }

  async function renamePlan(id, newTitle) {
      if (!newTitle) return false;
      
      // 1. Update Index
      const plans = getPlans();
      const plan = plans.find(p => p.id === id);
      if (!plan) return false;
      
      plan.title = newTitle;
      window.localStorage.setItem(getPlanIndexKey(), JSON.stringify(plans));
      markLocalDirty();

      // 2. Update Settings for that plan
      const settingsKey = Auth.getUserKey(`${id}_wishlist_settings`);
      let settings = {};
      try {
          const raw = window.localStorage.getItem(settingsKey);
          if (raw) settings = JSON.parse(raw);
      } catch(e) {}
      
      settings.title = newTitle;
      window.localStorage.setItem(settingsKey, JSON.stringify(settings));

      // 3. Update Cloud Plan Metadata (Title)
      if (plan.isCloud || plan.cloudId) {
          const cloudId = plan.cloudId || plan.id;
          try {
              if (typeof CloudSync !== 'undefined' && CloudSync.isLoggedIn()) {
                  await CloudSync.updatePlan(cloudId, newTitle);
              }
          } catch(e) {
              console.error("Failed to update cloud plan title", e);
          }
      }

      // 4. Sync storage
      return await syncToCloud();
  }

  async function deletePlan(id) {
      let plans = getPlans();
      const index = plans.findIndex(p => p.id === id);
      if (index !== -1) {
          const planToDelete = plans[index];
          
          // If it is a cloud plan, delete from cloud first
          if (planToDelete.isCloud || planToDelete.cloudId) {
             const cloudId = planToDelete.cloudId || planToDelete.id;
             try {
                 if (typeof CloudSync !== 'undefined' && CloudSync.isLoggedIn()) {
                     const res = await CloudSync.deletePlan(cloudId);
                     if (res.error) {
                         alert("云端删除失败: " + res.error);
                         return false;
                     }
                 }
             } catch(e) {
                 console.error("Cloud delete error", e);
                 alert("云端删除出错，请检查网络");
                 return false;
             }
          }

          plans.splice(index, 1);
          // Save local index (syncToCloud inside savePlans is for storage-sync, 
          // but we just did API delete, so it's fine)
          window.localStorage.setItem(getPlanIndexKey(), JSON.stringify(plans));
          markLocalDirty();
          
          // Cleanup storage
          window.localStorage.removeItem(Auth.getUserKey(`${id}_wishlist`));
          window.localStorage.removeItem(Auth.getUserKey(`${id}_wishlist_plan`));
          window.localStorage.removeItem(Auth.getUserKey(`${id}_wishlist_collapsed`));
          window.localStorage.removeItem(Auth.getUserKey(`${id}_wishlist_settings`));
          
          await syncToCloud(); // Push the updated index (deletion) to server immediately
          return true;
      }
      return false;
  }

  async function leavePlan(id) {
      let plans = getPlans();
      const index = plans.findIndex(p => p.id === id);
      if (index !== -1) {
          const planToLeave = plans[index];
          
          if (!planToLeave.isCloud && !planToLeave.cloudId) {
              return deletePlan(id); // If local, just delete
          }

          const cloudId = planToLeave.cloudId || planToLeave.id;
          const myId = Auth.getFriendId();

          try {
             if (typeof CloudSync !== 'undefined' && CloudSync.isLoggedIn()) {
                 // Try new self-removal endpoint first
                 let res;
                 if (CloudSync.leavePlan) {
                     res = await CloudSync.leavePlan(cloudId);
                 } else {
                     // Fallback for older clients? (Should not happen with bundled deploy)
                     res = await CloudSync.removeCollaborator(cloudId, myId);
                 }

                 if (res.error) {
                     // If plan not found (already deleted/left), treat as success to allow local cleanup
                     if (res.error === 'Plan not found') {
                         console.warn("Plan not found in cloud, removing locally anyway.");
                     } else {
                         alert("退出失败: " + res.error);
                         return false;
                     }
                 }
             }
          } catch(e) {
             console.error("Cloud leave error", e);
             alert("退出出错，请检查网络");
             return false;
          }

          // Remove locally
          plans.splice(index, 1);
          window.localStorage.setItem(getPlanIndexKey(), JSON.stringify(plans));
          markLocalDirty();
          
          // Cleanup storage
          window.localStorage.removeItem(Auth.getUserKey(`${id}_wishlist`));
          window.localStorage.removeItem(Auth.getUserKey(`${id}_wishlist_plan`));
          window.localStorage.removeItem(Auth.getUserKey(`${id}_wishlist_collapsed`));
          window.localStorage.removeItem(Auth.getUserKey(`${id}_wishlist_settings`));
          
          await syncToCloud(); // Push the updated index (deletion) to server immediately
          return true;
      }
      return false;
  }

  function loadSettings() {
    try {
      const raw = window.localStorage.getItem(getSettingsKey());
      if (!raw) return {};
      return JSON.parse(raw);
    } catch (e) {
      console.error("读取设置失败", e);
      return {};
    }
  }

  async function saveSettings(settings, planId) {
    try {
      window.localStorage.setItem(getSettingsKey(), JSON.stringify(settings));
      markLocalDirty();
      
      const targetId = planId || currentPlanId;

      // Update plan title in index unconditionally to ensure consistency
      if (settings.title) {
          const plans = getPlans();
          const plan = plans.find(p => p.id === targetId);
          
          if (plan) {
              plan.title = settings.title;
              window.localStorage.setItem(getPlanIndexKey(), JSON.stringify(plans));
          } else {
              console.warn(`Plan ${targetId} not found in index, reloading plans...`);
              // Double check with fresh read
              const freshPlans = JSON.parse(window.localStorage.getItem(getPlanIndexKey()) || '[]');
              const freshPlan = freshPlans.find(p => p.id === targetId);
              if (freshPlan) {
                  freshPlan.title = settings.title;
                  window.localStorage.setItem(getPlanIndexKey(), JSON.stringify(freshPlans));
              }
          }

          // Force update Cloud Plan Metadata (Title) regardless of local plan existence
          // In cloud-only mode, targetId is the cloudId.
          if (typeof CloudSync !== 'undefined' && CloudSync.isLoggedIn()) {
              const cloudId = (plan && plan.cloudId) ? plan.cloudId : targetId;
              try {
                  // Update title in cloud DB so it reflects in project list
                  console.log(`Syncing title to cloud for ${cloudId}: ${settings.title}`);
                  await CloudSync.updatePlan(cloudId, settings.title);
              } catch(e) {
                  console.error("Failed to sync title to cloud plan metadata", e);
              }
          }
      }
      return await syncToCloud();
    } catch (e) {
      console.error("保存设置失败", e);
      return { error: e.message };
    }
  }

  function loadWishlist() {
    try {
      const raw = window.localStorage.getItem(getStorageKey());
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed;
    } catch (e) {
      console.error("读取旅行清单失败", e);
      return [];
    }
  }

  function saveWishlistLocal(list, force = false) {
    if (!force && isReloading) {
        console.warn("Skipping saveWishlistLocal during reload");
        return;
    }
    try {
      window.localStorage.setItem(getStorageKey(), JSON.stringify(list));
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('hkwl:updated', { detail: { type: 'wishlist', planId: currentPlanId } }));
      }
    } catch (e) {
      console.error("保存旅行清单失败", e);
    }
  }

  async function saveWishlist(list) {
    saveWishlistLocal(list);
    markLocalDirty();
    await syncToCloud();
  }

  function createEmptyPlanState() {
    return {
      currentDay: 1,
      days: [[]],
      titles: [""],
      baseDate: new Date().toISOString().slice(0, 10),
    };
  }

  function normalizePlanState(raw) {
    if (!raw || typeof raw !== "object") {
      return createEmptyPlanState();
    }
    const rawDays = Array.isArray(raw.days) ? raw.days : [];
    const days = rawDays.map((day) =>
      Array.isArray(day) ? day.filter((id) => typeof id === "string") : []
    );
    const safeDays = days.length ? days : [[]];
    const total = safeDays.length;
    let currentDay = raw.currentDay;
    if (typeof currentDay !== "number" || currentDay < 1 || currentDay > total) {
      currentDay = 1;
    }
    let titles = Array.isArray(raw.titles)
      ? raw.titles.map((t) => (typeof t === "string" ? t : ""))
      : [];
    if (titles.length < total) {
      const diff = total - titles.length;
      for (let i = 0; i < diff; i++) {
        titles.push("");
      }
    } else if (titles.length > total) {
      titles = titles.slice(0, total);
    }
    const baseDateRaw = typeof raw.baseDate === "string" ? raw.baseDate : "";
    const baseDate =
      /^\d{4}-\d{2}-\d{2}$/.test(baseDateRaw) && !isNaN(Date.parse(baseDateRaw))
        ? baseDateRaw
        : new Date().toISOString().slice(0, 10);
    return {
      currentDay,
      days: safeDays,
      titles,
      baseDate,
    };
  }

  function formatDayTitle(day, state) {
    const titles = Array.isArray(state.titles) ? state.titles : [];
    const raw =
      day - 1 >= 0 && day - 1 < titles.length ? titles[day - 1] : "";
    
    // 1. If explicit title exists, use it
    if (typeof raw === "string" && raw) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        const [y, m, d] = raw.split('-').map(Number);
        return `${m}月${d}日`;
      }
      return raw;
    }
    
    // 2. If baseDate exists, calculate date
    if (state.baseDate && /^\d{4}-\d{2}-\d{2}$/.test(state.baseDate)) {
        const [y, m, d] = state.baseDate.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        date.setDate(date.getDate() + (day - 1));
        return `${date.getMonth() + 1}月${date.getDate()}日`;
    }

    // 3. Fallback
    return `第 ${day} 天`;
  }

  function loadPlanState() {
    try {
      const raw = window.localStorage.getItem(getPlanKey());
      if (!raw) return createEmptyPlanState();
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return {
          currentDay: 1,
          days: [parsed.filter((id) => typeof id === "string")],
          titles: [""],
          baseDate: new Date().toISOString().slice(0, 10),
        };
      }
      return normalizePlanState(parsed);
    } catch (e) {
      console.error("读取计划列表失败", e);
      return createEmptyPlanState();
    }
  }

  function savePlanStateLocal(state, force = false) {
    if (!force && isReloading) {
        console.warn("Skipping savePlanStateLocal during reload");
        return;
    }
    try {
      const normalized = normalizePlanState(state);
      window.localStorage.setItem(getPlanKey(), JSON.stringify(normalized));
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('hkwl:updated', { detail: { type: 'planState', planId: currentPlanId } }));
      }
    } catch (e) {
      console.error("保存计划列表失败", e);
    }
  }

  async function savePlanState(state) {
    savePlanStateLocal(state);
    markLocalDirty();
    await syncToCloud();
  }

  function getAllPlanIdsFromState(state) {
    const result = [];
    if (!state || !Array.isArray(state.days)) {
      return result;
    }
    state.days.forEach((day) => {
      if (Array.isArray(day)) {
        day.forEach((id) => {
          if (typeof id === "string" && !result.includes(id)) {
            result.push(id);
          }
        });
      }
    });
    return result;
  }

  function findPlanItemDay(state, id) {
    if (!state || !Array.isArray(state.days)) {
      return null;
    }
    for (let i = 0; i < state.days.length; i++) {
      const dayIds = state.days[i];
      if (Array.isArray(dayIds)) {
        const index = dayIds.indexOf(id);
        if (index !== -1) {
          return { day: i + 1, index };
        }
      }
    }
    return null;
  }

  // --- Data Manipulation Helpers (Exposed for SSOT) ---

  async function deleteItemData(itemId) {
    if (isReloading) return false;
    const currentList = loadWishlist();
    const nextList = currentList.filter((x) => x.id !== itemId);
    saveWishlistLocal(nextList);

    const planState = loadPlanState();
    if (!Array.isArray(planState.days)) {
      planState.days = [[]];
    }
    planState.days = planState.days.map((dayIds) =>
      Array.isArray(dayIds) ? dayIds.filter((id) => id !== itemId) : []
    );
    if (planState.days.length === 0) {
      planState.days = [[]];
    }
    savePlanStateLocal(planState);
    
    markLocalDirty();
    await syncToCloud();
    return true;
  }

  async function copyItemData(itemId) {
    if (isReloading) return null;
    const currentList = loadWishlist();
    const index = currentList.findIndex((x) => x.id === itemId);
    if (index === -1) return null;

    const originalItem = currentList[index];
    const newItem = {
      ...originalItem,
      id: Date.now().toString(),
      name:
        typeof originalItem.name === "string" &&
        originalItem.name.trim().length > 0
          ? originalItem.name
          : originalItem.type === "note"
          ? "批注"
          : originalItem.name,
    };

    currentList.splice(index + 1, 0, newItem);
    saveWishlistLocal(currentList);

    // Update Plan State if the item is in a plan
    const planState = loadPlanState();
    const position = findPlanItemDay(planState, itemId);
    
    // Also handle collapsed state for new item
    if (newItem.type !== "note") {
        const collapsedIds = new Set(loadCollapsedIds());
        collapsedIds.add(newItem.id);
        saveCollapsedIds(Array.from(collapsedIds));
    }

    if (position) {
      const dayIndex = position.day - 1;
      if (!Array.isArray(planState.days)) {
        planState.days = [[]];
      }
      while (planState.days.length <= dayIndex) {
        planState.days.push([]);
      }
      const dayIds = planState.days[dayIndex].slice();
      dayIds.splice(position.index + 1, 0, newItem.id);
      planState.days[dayIndex] = dayIds;
      savePlanStateLocal(planState);
    }
    
    markLocalDirty();
    await syncToCloud();
    return newItem;
  }
  
  async function moveItemData(itemId, targetDayIndex) {
    if (isReloading) return;
    const planState = loadPlanState();
    if (!planState.days) planState.days = [[]];
    
    // Remove from old location
    let found = false;
    for(let i=0; i<planState.days.length; i++) {
      if (Array.isArray(planState.days[i])) {
        const idx = planState.days[i].indexOf(itemId);
        if (idx !== -1) {
          planState.days[i].splice(idx, 1);
          found = true;
        }
      }
    }
    
    // Ensure target day exists
    while(planState.days.length <= targetDayIndex) {
        planState.days.push([]);
        if (planState.titles) planState.titles.push("");
    }
    
    if (!planState.days[targetDayIndex]) planState.days[targetDayIndex] = [];
    
    // Add to new location (append)
    planState.days[targetDayIndex].push(itemId);
    
    savePlanStateLocal(planState);
    markLocalDirty();
    await syncToCloud();
    return true;
  }

  function navigateEdit(id) {
    window.location.href = `manage.html?id=${encodeURIComponent(id)}&planId=${encodeURIComponent(currentPlanId)}`;
  }

  function loadCollapsedIds() {
    try {
      const raw = window.localStorage.getItem(getCollapsedKey());
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed;
    } catch (e) {
      console.error("读取折叠状态失败", e);
      return [];
    }
  }

  function saveCollapsedIds(ids) {
    try {
      window.localStorage.setItem(getCollapsedKey(), JSON.stringify(ids));
    } catch (e) {
      console.error("保存折叠状态失败", e);
    }
  }

  function createWish(data) {
    const now = new Date().toISOString();
    return {
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      createdAt: now,
      ...data,
    };
  }

  function parseKeywords(input) {
    if (!input) return [];
    return input
      .split(/[，,]/)
      .map((k) => k.trim())
      .filter(Boolean);
  }

  function showToast(message, type = "info") {
    let container = document.querySelector(".toast-container");
    if (!container) {
      container = document.createElement("div");
      container.className = "toast-container";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    // Force reflow
    void toast.offsetWidth;

    requestAnimationFrame(() => {
      toast.classList.add("show");
    });

    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => {
        if (toast.parentElement) {
          toast.parentElement.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }

  function renderWishlistPage() {
    const settings = loadSettings();
    let title = settings.title;
    
    // Fallback: Try to find title from plan index if not in settings
    if (!title && currentPlanId) {
        try {
            const plans = getPlans();
            const p = plans.find(x => x.id === currentPlanId);
            if (p && p.title) title = p.title;
        } catch(e) {}
    }

    // Default title if still missing
    if (!title) {
        title = "未命名计划";
    }

    if (title) {
      document.title = title;
      // Try specific ID first (planner.html), then generic selector
      const titleEl = document.getElementById("plan-title") || document.querySelector(".site-header h1");
      if (titleEl) {
        titleEl.textContent = title;
      }

      // --- Edit Plan Name Button Logic ---
      const editBtn = document.getElementById('plan-name-edit-btn');
      if (editBtn) {
          editBtn.style.display = 'inline-block';
          const newEditBtn = editBtn.cloneNode(true);
          editBtn.parentNode.replaceChild(newEditBtn, editBtn);
          
          newEditBtn.onclick = async () => {
               const newName = prompt('请输入新的计划名称:', title);
               if(newName && newName !== title) {
                   if (titleEl) titleEl.textContent = newName;
                   document.title = newName;
                   
                   const settings = loadSettings();
                   settings.title = newName;
                   saveSettings(settings);
                   
                   // Update Local Plan Index if possible
                   try {
                       const plans = getPlans();
                       const p = plans.find(x => x.id === currentPlanId);
                       if (p) {
                           p.title = newName;
                           savePlans(plans);
                       }
                   } catch(e) {}
                   
                   if (currentPlanId && typeof CloudSync !== 'undefined' && CloudSync.isLoggedIn()) {
                        try {
                            await CloudSync.updatePlan(currentPlanId, newName, null, null);
                            showToast('计划名称已更新', 'success');
                        } catch(e) {
                            showToast('同步名称失败: ' + e.message, 'error');
                        }
                   }
               }
          };
      }
    }

    // --- Delete/Leave Plan Button Logic ---
    const dangerBtn = document.getElementById('plan-danger-btn');
    if (dangerBtn && currentPlanId) {
        let isOwner = true;
        try {
            const plans = getPlans();
            const p = plans.find(x => x.id === currentPlanId);
            if (p && (p.isCloud || p.cloudId)) {
                const currentUser = Auth.getCurrentUser();
                const currentFriendId = Auth.getFriendId();
                if (p.owner) {
                    if (typeof p.owner === 'object') {
                        isOwner = (p.owner.username === currentUser);
                    } else {
                        isOwner = (p.owner === currentUser) || (p.owner === currentFriendId);
                    }
                }
            }
        } catch(e) {}

        dangerBtn.style.display = 'block';
        dangerBtn.textContent = isOwner ? '删除计划' : '退出计划';
        
        const newDangerBtn = dangerBtn.cloneNode(true);
        dangerBtn.parentNode.replaceChild(newDangerBtn, dangerBtn);
        
        newDangerBtn.onclick = async () => {
            const action = isOwner ? '删除' : '退出';
            if (confirm(`确定要${action}这个计划吗？此操作不可撤销。`)) {
                try {
                    if (isOwner) {
                        await CloudSync.deletePlan(currentPlanId);
                    } else {
                        await CloudSync.leavePlan(currentPlanId);
                    }
                    
                    // Cleanup Local Data
                    const plans = getPlans();
                    const newPlans = plans.filter(x => x.id !== currentPlanId);
                    // We must save plans to local storage to update the index
                    window.localStorage.setItem(getPlanIndexKey(), JSON.stringify(newPlans));
                    markLocalDirty();
                    
                    // Force sync to update cloud index immediately before redirect
                    await syncToCloud();
                    
                    localStorage.removeItem(getStorageKey());
                    localStorage.removeItem(getPlanKey());
                    localStorage.removeItem(getCollapsedKey());
                    localStorage.removeItem(getSettingsKey());
                    
                    alert(`计划已${action}`);
                    window.location.href = 'index.html';
                } catch(e) {
                    showToast(`${action}失败: ` + e.message, 'error');
                }
            }
        };
    }

    // Status Dropdown Logic
    const statusSelect = document.getElementById("plan-status-select");
    if (statusSelect && currentPlanId) {
        try {
            const plans = getPlans();
            const p = plans.find(x => x.id === currentPlanId);
            if (p) {
                statusSelect.value = p.status || 'planning';
                
                // Remove existing listeners to avoid duplicates (naive approach, better to use named handler but anonymous is fine if we re-render page)
                const newSelect = statusSelect.cloneNode(true);
                statusSelect.parentNode.replaceChild(newSelect, statusSelect);
                
                newSelect.addEventListener('change', async (e) => {
                    const newStatus = e.target.value;
                    await updatePlanStatus(currentPlanId, newStatus);
                    showToast(`计划状态已更新为: ${newSelect.options[newSelect.selectedIndex].text}`, 'success');
                });
            }
        } catch(e) {
            console.error("Error setting status dropdown", e);
        }
    }

    let list = loadWishlist();
    const listEl = document.getElementById("wish-list");
    const planListEl = document.getElementById("plan-list");
    const planDaysEl = document.getElementById("plan-days");
    if (planDaysEl) {
      planDaysEl.addEventListener(
        "wheel",
        (e) => {
          if (e.deltaY !== 0) {
            e.preventDefault();
            planDaysEl.scrollLeft += e.deltaY;
          }
        },
        { passive: false }
      );
    }
    const mainColumnEl = document.querySelector(".main-column");
    const addMenuToggle = document.getElementById("add-menu-toggle");
    const addMenu = document.getElementById("add-menu");
    const addNoteBtn = document.getElementById("add-note-btn");
    let planState = loadPlanState();
    let currentDay =
      typeof planState.currentDay === "number" && planState.currentDay >= 1
        ? planState.currentDay
        : 1;
    if (!Array.isArray(planState.days) || planState.days.length === 0) {
      planState.days = [[]];
      currentDay = 1;
      planState.currentDay = 1;
      savePlanState(planState);
    }
    function ensureDayIndex(day) {
      let d = day;
      if (d < 1) d = 1;
      if (!Array.isArray(planState.days)) {
        planState.days = [[]];
      }
      while (planState.days.length < d) {
        planState.days.push([]);
      }
      if (!Array.isArray(planState.titles)) {
        planState.titles = [];
      }
      while (planState.titles.length < planState.days.length) {
        planState.titles.push("");
      }
      return d;
    }



    function openDatePicker(initialValue, onSelected, anchorEl) {
      const input = document.createElement("input");
      input.type = "date";
      input.style.position = "fixed";
      input.style.opacity = "0";
      input.style.zIndex = "99999";
      input.style.cursor = "pointer";
      if (anchorEl) {
        const rect = anchorEl.getBoundingClientRect();
        input.style.left = `${rect.left}px`;
        input.style.top = `${rect.top}px`;
        input.style.width = `${rect.width}px`;
        input.style.height = `${rect.height}px`;
      } else {
        input.style.left = "0";
        input.style.top = "0";
      }
      if (
        typeof initialValue === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(initialValue)
      ) {
        input.value = initialValue;
      }
      document.body.appendChild(input);

      // Force layout update so browser acknowledges the position before showPicker
      void input.offsetWidth;

      function cleanup() {
        if (input.parentElement) {
          input.parentElement.removeChild(input);
        }
      }

      input.addEventListener("change", () => {
        const v = input.value;
        cleanup();
        if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
          onSelected(v);
        }
      });

      input.addEventListener(
        "blur",
        () => {
          cleanup();
        },
        { once: true }
      );

      try {
        if (typeof input.showPicker === "function") {
          input.showPicker();
        } else {
          input.click();
        }
      } catch (e) {
        input.click();
      }
    }
    currentDay = ensureDayIndex(currentDay);
    planState.currentDay = currentDay;
    let planIds = planState.days[currentDay - 1] || [];
    const collapsedIds = new Set(loadCollapsedIds());

    if (!listEl) {
      return;
    }

    function getPlanListContent() {
      const planListEl = document.getElementById("plan-list");
      if (!planListEl) return null;
      let content = planListEl.querySelector(".plan-list-content:not(.exiting)");
      if (!content) {
        content = document.createElement("div");
        content.className = "plan-list-content";
        planListEl.appendChild(content);
      }
      return content;
    }

    function getAllPlanIds() {
      return getAllPlanIdsFromState(planState);
    }

    async function applyPlanIds(nextIds) {
      if (isReloading) return;
      currentDay = ensureDayIndex(currentDay);
      planIds = Array.isArray(nextIds) ? nextIds.slice() : [];
      planState.days[currentDay - 1] = planIds;
      planState.currentDay = currentDay;
      savePlanStateLocal(planState);
      markLocalDirty();
      await syncToCloud();
    }

    function renderPlanListFromState(targetContentEl) {
      const planListEl = document.getElementById("plan-list");
      if (!planListEl) return;
      const contentEl = targetContentEl || getPlanListContent();
      contentEl.innerHTML = "";
      const itemMap = new Map(list.map(item => [item.id, item]));
      
      planIds.forEach((id, index) => {
        const item = itemMap.get(id);
        if (item) {
          const el = renderPlanItem(item, index + 1);
          contentEl.appendChild(el);
        }
      });
    }

    function switchDay(newDay) {
      if (isReloading) return;
      if (newDay === currentDay) return;
      const oldDay = currentDay;
      const direction = newDay > oldDay ? "left" : "right";
      
      currentDay = ensureDayIndex(newDay);
      planIds = planState.days[currentDay - 1] || [];
      planState.currentDay = currentDay;
      savePlanState(planState);

      const allBtns = planDaysEl.querySelectorAll(".plan-day-btn");
      allBtns.forEach((b) => {
        if (b.dataset.dayIndex === String(currentDay)) {
          b.classList.add("active");
        } else {
          b.classList.remove("active");
        }
      });

      const oldContent = getPlanListContent();
      const style = window.getComputedStyle(planListEl);
      const vPad = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
      
      // Fix height for transition
      planListEl.style.height = planListEl.offsetHeight + "px";

      const newContent = document.createElement("div");
      newContent.className = "plan-list-content";
      newContent.style.position = "absolute";
      newContent.style.top = "0";
      newContent.style.width = "100%";
      newContent.style.transform = direction === "left" ? "translateX(100%)" : "translateX(-100%)";
      
      planListEl.appendChild(newContent);
      
      renderPlanListFromState(newContent);
      
      // Calculate new height
      const newHeight = newContent.offsetHeight;
      
      oldContent.classList.add("exiting");
      oldContent.style.position = "absolute";
      oldContent.style.top = "0";
      oldContent.style.width = "100%";
      oldContent.style.transform = "translateX(0)";
      
      // Force reflow
      void newContent.offsetWidth;
      
      oldContent.style.transition = "transform 0.3s ease";
      newContent.style.transition = "transform 0.3s ease";
      
      oldContent.style.transform = direction === "left" ? "translateX(-100%)" : "translateX(100%)";
      newContent.style.transform = "translateX(0)";
      
      planListEl.style.height = (newHeight + vPad) + "px";

      setTimeout(() => {
        if (oldContent.parentNode === planListEl) {
          planListEl.removeChild(oldContent);
        }
        newContent.style.position = "";
        newContent.style.top = "";
        newContent.style.width = "100%";
        newContent.style.transform = "";
        newContent.style.transition = "";
        planListEl.style.height = "";
      }, 300);
    }

    function renderPlanDayTabs() {
      const planDaysEl = document.getElementById("plan-days");
      if (!planDaysEl) return;
      planDaysEl.innerHTML = "";
      const total =
        Array.isArray(planState.days) && planState.days.length > 0
          ? planState.days.length
          : 1;
      for (let day = 1; day <= total; day++) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "plan-day-btn";
        if (day === currentDay) {
          btn.classList.add("active");
        }
        const titleText = formatDayTitle(day, planState);
        btn.textContent = titleText;

        // Ensure year information is available via tooltip
        const titles = Array.isArray(planState.titles) ? planState.titles : [];
        const raw = day - 1 >= 0 && day - 1 < titles.length ? titles[day - 1] : "";
        if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
          btn.title = raw;
        }

        btn.addEventListener("click", () => {
          switchDay(day);
        });
        btn.addEventListener("dblclick", (e) => {
          e.stopPropagation();
          const titlesLocal = Array.isArray(planState.titles)
            ? planState.titles
            : [];
          const existing =
            day - 1 >= 0 && day - 1 < titlesLocal.length
              ? titlesLocal[day - 1]
              : "";
          const initialIso =
            typeof existing === "string" &&
            /^\d{4}-\d{2}-\d{2}$/.test(existing)
              ? existing
              : "";
          openDatePicker(initialIso, (iso) => {
            if (!Array.isArray(planState.titles)) {
              planState.titles = [];
            }
            while (planState.titles.length < planState.days.length) {
              planState.titles.push("");
            }
            planState.titles[day - 1] = iso;
            savePlanState(planState);
            renderPlanDayTabs();
          }, btn);
        });
        btn.dataset.dayIndex = String(day);
        planDaysEl.appendChild(btn);
      }
      /* Hidden as requested
      if (total > 1) {
        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "plan-day-remove-btn";
        removeBtn.textContent = "删除当前天";
        removeBtn.addEventListener("click", () => {
          if (
            !window.confirm(
              "确定要删除当前这一天的计划列表吗？当中的项目会回到左侧清单。"
            )
          ) {
            return;
          }
          if (!Array.isArray(planState.days) || planState.days.length <= 1) {
            return;
          }
          const dayIndex = currentDay - 1;
          if (dayIndex < 0 || dayIndex >= planState.days.length) {
            return;
          }
          const removedIds = Array.isArray(planState.days[dayIndex])
            ? planState.days[dayIndex].slice()
            : [];
          planState.days.splice(dayIndex, 1);
        if (Array.isArray(planState.titles)) {
          if (dayIndex >= 0 && dayIndex < planState.titles.length) {
            planState.titles.splice(dayIndex, 1);
          }
          if (!planState.titles.length && planState.days.length) {
            planState.titles.push("");
          }
        }
          if (!planState.days.length) {
            planState.days = [[]];
          planState.titles = [""];
            currentDay = 1;
          } else if (currentDay > planState.days.length) {
            currentDay = planState.days.length;
          }
          planState.currentDay = currentDay;
          planIds = planState.days[currentDay - 1] || [];
          savePlanState(planState);
          if (listEl && removedIds.length) {
            const allPlanIdsAfter = getAllPlanIds();
            const allPlanIdSetAfter = new Set(allPlanIdsAfter);
            removedIds.forEach((id) => {
              if (!allPlanIdSetAfter.has(id)) {
                const exists = listEl.querySelector(`[data-id="${id}"]`);
                const item = list.find((x) => x.id === id);
                if (!exists && item) {
                  const el = createCardDom(item);
                  listEl.appendChild(el);
                }
              }
            });
          }
          renderPlanDayTabs();
          renderPlanListFromState();
        });
        planDaysEl.appendChild(removeBtn);
      }
      */
      /* Hidden as requested
      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "plan-day-add-btn";
      addBtn.textContent = "+ 添加一天";
      addBtn.addEventListener("click", () => {
        openDatePicker("", (iso) => {
          const totalCurrent =
            Array.isArray(planState.days) && planState.days.length > 0
              ? planState.days.length
              : 1;
          const nextDay = totalCurrent + 1;
          ensureDayIndex(nextDay);
          if (!Array.isArray(planState.titles)) {
            planState.titles = [];
          }
          while (planState.titles.length < planState.days.length) {
            planState.titles.push("");
          }
          planState.titles[nextDay - 1] = iso;
          currentDay = nextDay;
          planIds = planState.days[currentDay - 1] || [];
          planState.currentDay = currentDay;
          savePlanState(planState);
          renderPlanDayTabs();
          renderPlanListFromState();
        }, addBtn);
      });
      planDaysEl.appendChild(addBtn);
      */
    }

    if (addMenuToggle && addMenu) {
      function setMenuOpen(open) {
        if (open) {
          addMenu.classList.add("open");
        } else {
          addMenu.classList.remove("open");
        }
      }

      addMenuToggle.addEventListener("click", (e) => {
        e.stopPropagation();
        const isOpen = addMenu.classList.contains("open");
        setMenuOpen(!isOpen);
      });

      document.addEventListener("click", (e) => {
        const target = e.target;
        if (!addMenu.contains(target) && target !== addMenuToggle) {
          setMenuOpen(false);
        }
      });
    }

    // Cleanup legacy notes on load
    (function cleanupNotes() {
        try {
            let fullList = loadWishlist();
            const hasNotes = fullList.some(item => item.type === 'note');
            
            if (hasNotes) {
                console.log("Cleaning up legacy notes...");
                fullList = fullList.filter(item => item.type !== 'note');
                saveWishlist(fullList);
                
                // Clean up planState references
                const pState = loadPlanState();
                const validIds = new Set(fullList.map(i => i.id));
                let stateChanged = false;
                
                if (Array.isArray(pState.days)) {
                    pState.days = pState.days.map(dayIds => {
                        const newDayIds = dayIds.filter(id => validIds.has(id));
                        if (newDayIds.length !== dayIds.length) stateChanged = true;
                        return newDayIds;
                    });
                }
                
                if (stateChanged) {
                    savePlanState(pState);
                }
                
                // Update global list variable if it exists
                if (typeof list !== 'undefined') {
                    list = fullList;
                }
            }
        } catch (e) {
            console.error("Error cleaning up notes:", e);
        }
    })();

    function removeItemDom(id) {
      const mainNode = listEl.querySelector(`[data-id="${id}"]`);
      if (mainNode && mainNode.parentElement === listEl) {
        listEl.removeChild(mainNode);
      }
      if (planListEl) {
        const planNode = planListEl.querySelector(`[data-id="${id}"]`);
        if (planNode && planNode.parentElement) {
          planNode.parentElement.removeChild(planNode);
        }
      }
    }

    function handleDelete(itemId) {
      if (!window.confirm("确定要删除该项目吗？")) {
        return;
      }
      deleteItemData(itemId);
      
      // Refresh local state
      list = loadWishlist();
      const newState = loadPlanState();
      planState.days = newState.days;
      planState.currentDay = newState.currentDay;
      currentDay = ensureDayIndex(currentDay);
      planIds = planState.days[currentDay - 1] || [];
      
      removeItemDom(itemId);
    }

    async function handleCopy(itemId) {
      const newItem = await copyItemData(itemId);
      if (!newItem) return;

      // Refresh local state
      list = loadWishlist();
      const newState = loadPlanState();
      planState.days = newState.days;
      
      // UI Update Logic
      const position = findPlanItemDay(planState, itemId);

      if (position) {
        currentDay = ensureDayIndex(currentDay);
        planIds = planState.days[currentDay - 1] || [];
        
        if (planListEl && position.day === currentDay) {
          const originalCard = planListEl.querySelector(
            `.plan-item[data-id="${itemId}"]`
          );
          const newCard = createCardDom(newItem);
          newCard.classList.add("plan-item");

          if (originalCard && originalCard.parentElement) {
            originalCard.parentElement.insertBefore(newCard, originalCard.nextSibling);
          } else {
            getPlanListContent().appendChild(newCard);
          }
        }
      } else {
        const originalCard = listEl.querySelector(`.card[data-id="${itemId}"]`);
        const newCard = createCardDom(newItem);

        if (originalCard) {
          listEl.insertBefore(newCard, originalCard.nextSibling);
        } else {
          listEl.appendChild(newCard);
        }
      }
    }



    // Inject CSS for Drag Handle and Sequence Badge
    const style = document.createElement('style');
    style.textContent = `
      .card-header {
        display: flex;
        align-items: flex-start;
      }
      .plan-item-seq {
        background: #FF9800;
        color: white;
        border-radius: 50%;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: bold;
        margin-right: 8px;
        flex-shrink: 0;
        margin-top: 2px; /* Align with text */
      }
    `;
    document.head.appendChild(style);

    // Helper: Get item and update
    function getWishlistItem(id) {
        const list = loadWishlist();
        return list.find(x => x.id === id);
    }

    function updateWishlistItem(id, updateFn) {
        const list = loadWishlist();
        let updated = false;
        
        // Update ALL items with matching ID to handle potential duplicates
        list.forEach((item) => {
            if (item.id === id) {
                updateFn(item);
                updated = true;
            }
        });

        if (updated) {
            saveWishlist(list);
            syncToCloud(); 
            internalRefresh(); 
        }
    }

    // Phase 3: Share Modal
    function openShareModal(itemId, subItemId, type) { 
        console.log("Opening share modal", { itemId, subItemId, type });
        // alert("DEBUG: Inside openShareModal");
        
        let collaborators = [];
        try {
            collaborators = getCurrentPlanCollaborators().filter(c => c.id !== getUserId());
        } catch (e) {
            console.error("Error getting collaborators:", e);
            collaborators = [];
        }
        
        // Always open modal, even if no collaborators
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay share-modal-overlay'; // Added unique class
        // Force high z-index and visibility
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.6);display:flex;justify-content:center;align-items:center;z-index:20000 !important;';
        
        modal.innerHTML = `
            <div class="modal-content" style="background:#fff;padding:20px;border-radius:12px;width:90%;max-width:320px;box-shadow:0 10px 25px rgba(0,0,0,0.2);position:relative;z-index:20001;">
                <h3 style="margin-top:0;margin-bottom:15px;text-align:center;">分享 / 分发</h3>
                <div class="collaborator-list" style="max-height:200px;overflow-y:auto;border:1px solid #eee;border-radius:8px;">
                    ${collaborators.length > 0 ? collaborators.map(c => `
                        <div class="collaborator-item" data-id="${c.id}" data-name="${c.name}" style="padding:12px;border-bottom:1px solid #eee;cursor:pointer;display:flex;align-items:center;">
                            <div style="width:32px;height:32px;border-radius:50%;background:#eee;margin-right:10px;overflow:hidden;">
                                ${c.avatar ? `<img src="${c.avatar}" style="width:100%;height:100%;object-fit:cover;">` : `<span style="display:flex;justify-content:center;align-items:center;width:100%;height:100%;color:#999;">${c.name[0]}</span>`}
                            </div>
                            <span>${c.name}</span>
                        </div>
                    `).join('') : 
                    `<div style="padding:20px;text-align:center;color:#999;font-size:0.9em;">
                        暂无其他协作成员<br>
                        <span style="font-size:0.85em;color:#ccc;">请先邀请好友加入计划</span>
                     </div>`
                    }
                </div>
                <div id="share-actions" style="display:none;margin-top:15px;text-align:center;">
                    <p style="margin:5px 0;color:#666;font-size:0.9em;">已选择: <span id="selected-collab-name" style="font-weight:bold;color:#333;"></span></p>
                    <button id="btn-distribute" style="width:100%;padding:10px;margin-bottom:8px;background:#ff9800;color:white;border:none;border-radius:6px;font-weight:bold;cursor:pointer;">分发 (移交所有权)</button>
                    <div style="font-size:0.8em;color:#999;margin-bottom:10px;">数据将从您的列表中移除，转移给对方</div>
                    <button id="btn-share" style="width:100%;padding:10px;background:#2196f3;color:white;border:none;border-radius:6px;font-weight:bold;cursor:pointer;">分享 (共享查看)</button>
                    <div style="font-size:0.8em;color:#999;">对方可见，您保留所有权</div>
                </div>
                <button class="modal-close-btn-share" style="width:100%;padding:10px;margin-top:15px;background:#f5f5f5;border:none;border-radius:6px;cursor:pointer;">取消</button>
            </div>
        `;
        document.body.appendChild(modal);

        let selectedUserId = null;

        // Select Collaborator
        modal.querySelectorAll('.collaborator-item').forEach(item => {
            item.addEventListener('click', () => {
                modal.querySelectorAll('.collaborator-item').forEach(i => i.style.background = 'transparent');
                item.style.background = '#e3f2fd';
                selectedUserId = item.dataset.id;
                modal.querySelector('#selected-collab-name').textContent = item.dataset.name;
                modal.querySelector('#share-actions').style.display = 'block';
            });
        });

        // Distribute Action
        const btnDistribute = modal.querySelector('#btn-distribute');
        if (btnDistribute) {
            btnDistribute.addEventListener('click', () => {
                if (!selectedUserId) return;
                if (confirm(`确定要将此项目分发给 ${modal.querySelector('#selected-collab-name').textContent} 吗？它将从您的列表中移除。`)) {
                    updateWishlistItem(itemId, (itm) => {
                        const list = type === 'ticket' ? itm.tickets : itm.reminders;
                        const target = list.find(t => t.id === subItemId);
                        if (target) {
                            target.owner = selectedUserId;
                            target.sharedWith = []; // Reset sharing if distributed
                        }
                    });
                    modal.remove();
                    // Refresh parent modal
                    if (type === 'ticket') openTicketModal(itemId);
                    if (type === 'reminder') openReminderModal(itemId);
                }
            });
        }

        // Share Action
        const btnShare = modal.querySelector('#btn-share');
        if (btnShare) {
            btnShare.addEventListener('click', () => {
                if (!selectedUserId) return;
                updateWishlistItem(itemId, (itm) => {
                    const list = type === 'ticket' ? itm.tickets : itm.reminders;
                    const target = list.find(t => t.id === subItemId);
                    if (target) {
                        if (!target.sharedWith) target.sharedWith = [];
                        if (!target.sharedWith.includes(selectedUserId)) {
                            target.sharedWith.push(selectedUserId);
                        }
                    }
                });
                alert(`已分享给 ${modal.querySelector('#selected-collab-name').textContent}`);
                modal.remove();
            });
        }

        modal.querySelector('.modal-close-btn-share').addEventListener('click', () => {
            modal.remove();
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }

    // Expose globally for inline onclick handlers
    window.openShareModal = openShareModal;

    function openTicketModal(itemId) {
        const item = getWishlistItem(itemId);
        if (!item) return;
        let tickets = item.tickets || [];
        
        // Phase 2 & 3: Data Ownership & Sharing
        // Show legacy data (no owner), data owned by current user, or data shared with current user
        const currentUserId = getUserId();
        if (currentUserId) {
            tickets = tickets.filter(t => 
                !t.owner || 
                t.owner === currentUserId || 
                (t.sharedWith && t.sharedWith.includes(currentUserId))
            );
        }

        const modal = document.createElement('div');
        modal.className = 'action-panel-modal';
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

        const content = document.createElement('div');
        content.className = 'action-panel-content';
        
        const renderList = () => {
             return tickets.map((t, i) => {
                let contentHtml = '';
                if (t.type === 'image' && t.content) {
                    contentHtml = `<img src="${t.content}" class="feature-image-preview" style="cursor:zoom-in" onclick="const w=window.open();w.document.write('<img src=\\'${t.content}\\' style=\\'width:100%\\'>')">`;
                } else if (t.type === 'file') {
                     contentHtml = `<div style="margin-top:5px;font-size:0.85rem;color:#666;background:#eee;padding:5px;border-radius:4px;">📎 ${t.fileName || '未知文件'} <span style="font-size:0.75rem;color:#999">(暂存)</span></div>`;
                }

                return `
                <div class="feature-item">
                    <div class="feature-item-content">
                        <div class="feature-item-title">
                             ${(!(!t.owner || t.owner === currentUserId) && t.owner) ? `<span style="font-size:0.7em;color:#ff9800;border:1px solid #ff9800;border-radius:4px;padding:0 2px;margin-right:4px;vertical-align:middle;">他人共享</span>` : ''}
                             ${t.name}
                        </div>
                        <div class="feature-item-subtitle">
                            ${t.code ? 'Code: '+t.code : ''} 
                            ${t.note ? (t.code ? '| ' : '') + t.note : ''}
                        </div>
                        ${contentHtml}
                    </div>
                    ${(!t.owner || t.owner === currentUserId) ? `<button class="feature-share-btn" data-id="${t.id}" style="margin-right:8px;background:white;border:1px solid #ddd;border-radius:50%;width:32px;height:32px;cursor:pointer;font-size:1.2em;position:relative;z-index:100;display:flex;align-items:center;justify-content:center;" title="分享/分发">➦</button>` : ''}
                    <button class="feature-delete-btn" data-id="${t.id}">&times;</button>
                </div>
             `;
              }).join('');
        };

        content.innerHTML = `
            <div class="action-panel-header">
                <div class="action-panel-title">票券凭证</div>
                <button class="action-panel-close">&times;</button>
            </div>
            <div class="feature-list" id="ticket-list">
                ${tickets.length ? renderList() : '<div style="text-align:center;color:#999;padding:10px;">暂无票券</div>'}
            </div>
            <div class="feature-form">
                <input type="text" class="feature-input" id="ticket-name" placeholder="票券名称 (如: 迪士尼门票)">
                <input type="text" class="feature-input" id="ticket-code" placeholder="票券号码/验证码 (选填)">
                <input type="text" class="feature-input" id="ticket-note" placeholder="备注信息 (选填)">
                
                <input type="file" id="ticket-file" accept="image/*,.pdf" style="display:none">
                <label for="ticket-file" class="feature-file-label" id="ticket-file-label">📸 点击上传图片/文件</label>
                
                <button class="feature-btn" id="add-ticket-btn">添加票券</button>
            </div>
        `;

        content.querySelector('.action-panel-close').addEventListener('click', () => modal.remove());
        
        let currentFile = null;

        const fileInput = content.querySelector('#ticket-file');
        const fileLabel = content.querySelector('#ticket-file-label');

        fileInput.addEventListener('change', (e) => {
            if (fileInput.files && fileInput.files[0]) {
                const file = fileInput.files[0];
                if (file.size > 2 * 1024 * 1024) { // 2MB limit
                    alert('文件大小不能超过 2MB');
                    fileInput.value = '';
                    currentFile = null;
                    fileLabel.textContent = '📸 点击上传图片/文件';
                    return;
                }
                currentFile = file;
                fileLabel.textContent = `✅ 已选择: ${file.name}`;
                fileLabel.style.borderColor = '#4CAF50';
                fileLabel.style.color = '#4CAF50';
            }
        });

        content.querySelector('#add-ticket-btn').addEventListener('click', () => {
            const name = content.querySelector('#ticket-name').value.trim();
            const code = content.querySelector('#ticket-code').value.trim();
            const note = content.querySelector('#ticket-note').value.trim();
            
            if (!name) { alert('请输入票券名称'); return; }
            
            const addTicket = (fileData = null, fileName = null, fileType = null) => {
                updateWishlistItem(itemId, (itm) => {
                    if (!itm.tickets) itm.tickets = [];
                    itm.tickets.push({ 
                        id: Date.now().toString(), 
                        name, 
                        code, 
                        note,
                        type: fileType || 'text',
                        content: fileData,
                        fileName: fileName,
                        createdAt: new Date().toISOString(),
                        owner: getUserId() // Phase 2: Data Ownership
                    });
                });
                modal.remove();
                openTicketModal(itemId); // Re-open to show new list
            };

            if (currentFile) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const base64 = e.target.result;
                    const type = currentFile.type.startsWith('image/') ? 'image' : 'file';
                    addTicket(base64, currentFile.name, type);
                };
                reader.readAsDataURL(currentFile);
            } else {
                addTicket();
            }
        });

        // Event Delegation for Share Button
        content.addEventListener('click', (e) => {
            const shareBtn = e.target.closest('.feature-share-btn');
            if (shareBtn) {
                e.preventDefault(); // Stop default action
                e.stopPropagation(); // Stop bubbling
                
                const id = shareBtn.dataset.id;
                console.log('Share btn clicked via delegation', { itemId, id, type: 'ticket' });
                // alert('DEBUG: Share button clicked! ID: ' + id); // Debug alert
                
                try { 
                    openShareModal(itemId, id, 'ticket'); 
                } catch(err) { 
                    console.error(err);
                    alert("打开分享窗口失败: " + err.message);
                }
            }
        });

        /* 
        content.querySelectorAll('.feature-share-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                console.log('Share btn clicked in Ticket Modal', { itemId, id, type: 'ticket' });
                openShareModal(itemId, id, 'ticket');
            });
        });
        */

        content.querySelectorAll('.feature-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                if (confirm('确定删除该票券吗？')) {
                    updateWishlistItem(itemId, (itm) => {
                        if (itm.tickets) {
                            itm.tickets = itm.tickets.filter(t => t.id !== id);
                        }
                    });
                    modal.remove();
                    openTicketModal(itemId);
                }
            });
        });

        modal.appendChild(content);
        document.body.appendChild(modal);
    }

    function openReminderModal(itemId) {
        const item = getWishlistItem(itemId);
        if (!item) return;
        let reminders = item.reminders || [];

        // Phase 2 & 3: Data Ownership & Sharing
        const currentUserId = getUserId();
        if (currentUserId) {
            reminders = reminders.filter(r => 
                !r.owner || 
                r.owner === currentUserId ||
                (r.sharedWith && r.sharedWith.includes(currentUserId))
            );
        }

        const modal = document.createElement('div');
        modal.className = 'action-panel-modal';
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

        const content = document.createElement('div');
        content.className = 'action-panel-content';

        const renderList = () => {
             return reminders.map((r, i) => `
                <div class="feature-item">
                    <div class="feature-item-content">
                        <div class="feature-item-title">
                            ${(!(!r.owner || r.owner === currentUserId) && r.owner) ? `<span style="font-size:0.7em;color:#ff9800;border:1px solid #ff9800;border-radius:4px;padding:0 2px;margin-right:4px;vertical-align:middle;">他人共享</span>` : ''}
                            ${new Date(r.time).toLocaleString()}
                        </div>
                        <div class="feature-item-subtitle">${r.message}</div>
                    </div>
                    ${(!r.owner || r.owner === currentUserId) ? `<button class="feature-share-btn" data-id="${r.id}" onclick="event.stopPropagation(); window.openShareModal('${itemId}', '${r.id}', 'reminder')" style="margin-right:8px;background:white;border:1px solid #ddd;border-radius:50%;width:32px;height:32px;cursor:pointer;font-size:1.2em;position:relative;z-index:10;display:flex;align-items:center;justify-content:center;" title="分享/分发">➦</button>` : ''}
                    <button class="feature-delete-btn" data-id="${r.id}">&times;</button>
                </div>
             `).join('');
        };

        content.innerHTML = `
            <div class="action-panel-header">
                <div class="action-panel-title">提醒事项</div>
                <button class="action-panel-close">&times;</button>
            </div>
            <div class="feature-list" id="reminder-list">
                ${reminders.length ? renderList() : '<div style="text-align:center;color:#999;padding:10px;">暂无提醒</div>'}
            </div>
            <div class="feature-form">
                <input type="datetime-local" class="feature-input" id="reminder-time">
                <input type="text" class="feature-input" id="reminder-msg" placeholder="提醒内容">
                <button class="feature-btn" id="add-reminder-btn">添加提醒</button>
            </div>
        `;

        content.querySelector('.action-panel-close').addEventListener('click', () => modal.remove());

        content.querySelector('#add-reminder-btn').addEventListener('click', () => {
            const time = content.querySelector('#reminder-time').value;
            const message = content.querySelector('#reminder-msg').value.trim();
            
            if (!time || !message) { alert('请填写完整信息'); return; }
            
            updateWishlistItem(itemId, (itm) => {
                if (!itm.reminders) itm.reminders = [];
                itm.reminders.push({ 
                    id: Date.now().toString(), 
                    time, 
                    message,
                    done: false, // Initialize as not done
                    createdAt: new Date().toISOString(),
                    owner: getUserId() // Phase 2: Data Ownership
                });
            });
            modal.remove();
            openReminderModal(itemId);
        });

        // Event Delegation for Share Button
        content.addEventListener('click', (e) => {
            const shareBtn = e.target.closest('.feature-share-btn');
            if (shareBtn) {
                e.stopPropagation();
                const id = shareBtn.dataset.id;
                console.log('Share btn clicked via delegation', { itemId, id, type: 'reminder' });
                
                try { 
                    openShareModal(itemId, id, 'reminder'); 
                } catch(err) { 
                    console.error(err);
                    showToast("打开分享窗口失败: " + err.message, "error");
                }
            }
        });

        /*
        content.querySelectorAll('.feature-share-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                console.log('Share btn clicked in Reminder Modal', { itemId, id, type: 'reminder' });
                openShareModal(itemId, id, 'reminder');
            });
        });
        */

        content.querySelectorAll('.feature-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                if (confirm('确定删除该提醒吗？')) {
                    updateWishlistItem(itemId, (itm) => {
                        if (itm.reminders) {
                            itm.reminders = itm.reminders.filter(r => r.id !== id);
                        }
                    });
                    modal.remove();
                    openReminderModal(itemId);
                }
            });
        });

        modal.appendChild(content);
        document.body.appendChild(modal);
    }

    // Action Panel Logic
    function openCardActionPanel(itemId) {
        const item = getWishlistItem(itemId);
        if (!item) return;

        const existing = document.querySelector('.action-panel-modal');
        if (existing) existing.remove();
        
        const modal = document.createElement('div');
        modal.className = 'action-panel-modal';
        
        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
        
        const content = document.createElement('div');
        content.className = 'action-panel-content';

        const isTicketsEnabled = getFeatureEnabled(item, 'tickets');
        const isRemindersEnabled = getFeatureEnabled(item, 'reminders');
        
        content.innerHTML = `
            <div class="action-panel-header">
                <div class="action-panel-title">功能库</div>
                <button class="action-panel-close">&times;</button>
            </div>
            <div class="action-grid">
                <div class="action-item ${isTicketsEnabled ? 'active' : ''}" data-type="tickets">
                    <div class="action-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M0 4.5A1.5 1.5 0 0 1 1.5 3h13A1.5 1.5 0 0 1 16 4.5V6a.5.5 0 0 1-.5.5 1.5 1.5 0 0 0 0 3 .5.5 0 0 1 .5.5v1.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 0 11.5V10a.5.5 0 0 1 .5-.5 1.5 1.5 0 0 0 0-3A.5.5 0 0 1 0 6V4.5ZM1.5 4a.5.5 0 0 0-.5.5v1.05a2.5 2.5 0 0 1 0 4.9v1.05a.5.5 0 0 0 .5.5h13a.5.5 0 0 0 .5-.5v-1.05a2.5 2.5 0 0 1 0-4.9V4.5a.5.5 0 0 0-.5-.5h-13Z"/>
                        </svg>
                    </div>
                    <div class="action-label">${isTicketsEnabled ? '已添加' : '票据与凭证'}</div>
                </div>
                <div class="action-item ${isRemindersEnabled ? 'active' : ''}" data-type="reminders">
                    <div class="action-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z"/>
                            <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z"/>
                        </svg>
                    </div>
                    <div class="action-label">${isRemindersEnabled ? '已添加' : '提醒事项'}</div>
                </div>
            </div>
        `;
        
        content.querySelector('.action-panel-close').addEventListener('click', () => modal.remove());
        
        content.querySelectorAll('.action-item').forEach(el => {
            el.addEventListener('click', () => {
                const type = el.dataset.type;
                const isActive = el.classList.contains('active');

                if (isActive) {
                    // Remove feature logic
                    if (confirm('确定要关闭该功能吗？（数据将保留，仅对当前用户隐藏入口）')) {
                        updateWishlistItem(itemId, (itm) => {
                             setFeatureEnabled(itm, type, false);
                        });
                        
                        modal.remove();
                    }
                } else {
                    // Add feature logic
                    updateWishlistItem(itemId, (itm) => {
                        setFeatureEnabled(itm, type, true);
                    });
                    modal.remove();
                }
            });
        });
        
        modal.appendChild(content);
        document.body.appendChild(modal);
    }

    function createCardDom(item) {
      const div = document.createElement("article");
      div.className = "card";
      if (item.type === "note") {
        div.classList.add("card-note");
      }
      div.dataset.id = item.id;
      if (item.type !== "note" && collapsedIds.has(item.id)) {
        div.classList.add("collapsed");
      }

      // Mobile Click to Flip Logic
      div.addEventListener("click", (e) => {
          // Don't flip if clicking buttons, inputs, or contenteditable
          if (e.target.closest('button') || e.target.closest('.card-toggle-btn') || e.target.isContentEditable) {
              return;
          }
          
          // Simple mobile detection
          const isMobile = window.innerWidth < 768 || 'ontouchstart' in window;
          if (isMobile) {
              div.classList.toggle('is-flipped');
          }
      });

      // 3D Flip Structure
      const inner = document.createElement("div");
      inner.className = "card-inner";
      
      const front = document.createElement("div");
      front.className = "card-front";
      
      const back = document.createElement("div");
      back.className = "card-back";

      // --- Front Content Construction ---
      
      // Card Header
      const header = document.createElement("div");
      header.className = "card-header";

      const headerContent = document.createElement("div");
      headerContent.className = "card-header-content";

      const typeBadge = document.createElement("span");
      typeBadge.className = "card-type-badge";
      let hasTypeBadge = false;
      if (item.type === "food") {
        typeBadge.classList.add("card-type-food");
        typeBadge.textContent = "🍽";
        hasTypeBadge = true;
      } else if (item.type === "place") {
        typeBadge.classList.add("card-type-place");
        typeBadge.textContent = "🏞";
        hasTypeBadge = true;
      } else if (item.type === "stay") {
        typeBadge.classList.add("card-type-stay");
        typeBadge.innerHTML =
          '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M7.293 1.5a1 1 0 0 1 1.414 0l6 6A1 1 0 0 1 14.293 9H13.5v5.5a1 1 0 0 1-1 1h-3v-4h-3v4h-3a1 1 0 0 1-1-1V9H1.707a1 1 0 0 1-.707-1.707l6-6Z"/></svg>';
        hasTypeBadge = true;
      } else if (item.type === "transport") {
        typeBadge.classList.add("card-type-transport");
        typeBadge.innerHTML =
          '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M3 1.5A1.5 1.5 0 0 1 4.5 0h7A1.5 1.5 0 0 1 13 1.5V9a3 3 0 0 1-3 3h-.5l1.75 2.5a.75.75 0 1 1-1.2.9L8 12.5l-2.05 2.9a.75.75 0 1 1-1.2-.9L6.5 12H6a3 3 0 0 1-3-3V1.5ZM4.5 1a.5.5 0 0 0-.5.5V4h8V1.5a.5.5 0 0 0-.5-.5h-7ZM12 5.5H4v3A1.5 1.5 0 0 0 5.5 10h5A1.5 1.5 0 0 0 12 8.5v-3ZM6 6.5h1.5v2H6v-2Zm2.5 0H10v2H8.5v-2Z"/></svg>';
        hasTypeBadge = true;
      }
      if (hasTypeBadge) {
        headerContent.appendChild(typeBadge);
      }

      if (item.type !== "note") {
        const title = document.createElement("h3");
        title.textContent = item.name;
        headerContent.appendChild(title);
      }

      header.appendChild(headerContent);

      if (item.type !== "note") {
        const toggleBtn = document.createElement("div");
        toggleBtn.className = "card-toggle-btn";
        toggleBtn.title = "展开/收起";
        toggleBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const isCollapsed = div.classList.toggle("collapsed");
          if (isCollapsed) {
            collapsedIds.add(item.id);
          } else {
            collapsedIds.delete(item.id);
          }
          saveCollapsedIds(Array.from(collapsedIds));
        });
        header.appendChild(toggleBtn);
      }

      front.appendChild(header);

      // Card Details
      const details = document.createElement("div");
      details.className = "card-details";

      if (item.type === "note") {
        const note = document.createElement("p");
        note.className = "note-text";
        let baseText =
          typeof item.name === "string" && item.name.trim().length > 0
            ? item.name.trim()
            : "批注";
        const noteInner = document.createElement("span");
        noteInner.className = "note-text-inner";
        noteInner.textContent = baseText;
        if (baseText === "批注") {
          noteInner.classList.add("note-placeholder");
        }
        note.appendChild(noteInner);

        note.addEventListener("dblclick", (e) => {
          e.stopPropagation();
          noteInner.setAttribute("contenteditable", "true");
          noteInner.focus();
          const selection = window.getSelection();
          if (selection) {
            const range = document.createRange();
            range.selectNodeContents(noteInner);
            selection.removeAllRanges();
            selection.addRange(range);
          }
        });

        function finishNoteEdit() {
          let text = noteInner.textContent || "";
          text = text.trim();
          if (!text) {
            text = "批注";
          }
          noteInner.textContent = text;
          noteInner.removeAttribute("contenteditable");
          if (text === "批注") {
            noteInner.classList.add("note-placeholder");
          } else {
            noteInner.classList.remove("note-placeholder");
          }

          const fullList = loadWishlist();
          const idx = fullList.findIndex((x) => x.id === item.id);
          if (idx !== -1) {
            fullList[idx] = {
              ...fullList[idx],
              name: text,
            };
            saveWishlist(fullList);
            list = fullList;
          }
        }

        noteInner.addEventListener("blur", finishNoteEdit);

        details.appendChild(note);

        const spacer = document.createElement("div");
        spacer.className = "note-drag-spacer";
        details.appendChild(spacer);
      }

      if (item.type === "food") {
        if (item.mealType) {
          const meal = document.createElement("p");
          meal.textContent = `餐别：${item.mealType}`;
          details.appendChild(meal);
        }

        if (item.location) {
          const location = document.createElement("p");
          location.textContent = `地点：${item.location}`;
          details.appendChild(location);
        }
      } else if (item.type === "place") {
        if (item.location) {
          const location = document.createElement("p");
          location.textContent = `地点：${item.location}`;
          details.appendChild(location);
        }
      } else if (item.type === "transport") {
        const val = parseFloat(item.travelTime);
        if (!isNaN(val)) {
             const travelTimeP = document.createElement("p");
             let timeText = "";
             const h = Math.floor(val);
             const m = Math.round((val - h) * 60);
             if (h > 0 && m > 0) timeText = `${h}小时${m}分钟`;
             else if (h > 0) timeText = `${h}小时`;
             else timeText = `${m}分钟`;
             
             travelTimeP.textContent = `在途时间：${timeText}`;
             details.appendChild(travelTimeP);
        }
      } else if (item.type === "stay") {
        if (item.location) {
          const location = document.createElement("p");
          location.textContent = `地点：${item.location}`;
          details.appendChild(location);
        }
      }

      const actions = document.createElement("div");
      actions.className = "card-actions";

      // Always show edit button
      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "btn btn-icon";
      editBtn.title = "编辑";
      editBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/></svg>`;
      editBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        navigateEdit(item.id);
      });
      actions.appendChild(editBtn);

      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "btn btn-icon";
      copyBtn.title = "复制";
      copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2Zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H6ZM2 5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1h1v1a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1v1H2Z"/></svg>`;
      copyBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        handleCopy(item.id);
      });
      actions.appendChild(copyBtn);

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "btn btn-icon";
      deleteBtn.title = "删除";
      deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>`;
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        handleDelete(item.id);
      });
      actions.appendChild(deleteBtn);

      front.appendChild(details);
      front.appendChild(actions);

      // Indicators
      const indicators = document.createElement('div');
      indicators.className = 'card-indicators';
      
      if (item.tickets && item.tickets.length > 0) {
          const tBadge = document.createElement('span');
          tBadge.className = 'indicator-icon';
          tBadge.textContent = '🎫 ' + item.tickets.length;
          indicators.appendChild(tBadge);
      }
      if (item.reminders && item.reminders.length > 0) {
          const rBadge = document.createElement('span');
          rBadge.className = 'indicator-icon';
          rBadge.textContent = '⏰ ' + item.reminders.length;
          indicators.appendChild(rBadge);
      }
      if (indicators.children.length > 0) {
          front.appendChild(indicators);
      }

      // --- Back Content Construction ---
      const featuresContainer = document.createElement("div");
      featuresContainer.className = "card-back-features";
      
      const isTicketsEnabled = getFeatureEnabled(item, 'tickets');
      if (isTicketsEnabled) {
          const btn = document.createElement("button");
          btn.className = "card-back-feature-btn";
          // Use SVG icon for Ticket
          btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path d="M0 4.5A1.5 1.5 0 0 1 1.5 3h13A1.5 1.5 0 0 1 16 4.5V6a.5.5 0 0 1-.5.5 1.5 1.5 0 0 0 0 3 .5.5 0 0 1 .5.5v1.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 0 11.5V10a.5.5 0 0 1 .5-.5 1.5 1.5 0 0 0 0-3A.5.5 0 0 1 0 6V4.5ZM1.5 4a.5.5 0 0 0-.5.5v1.05a2.5 2.5 0 0 1 0 4.9v1.05a.5.5 0 0 0 .5.5h13a.5.5 0 0 0 .5-.5v-1.05a2.5 2.5 0 0 1 0-4.9V4.5a.5.5 0 0 0-.5-.5h-13Z"/></svg>`;
          btn.title = "票据与凭证";
          btn.addEventListener("click", (e) => {
              e.stopPropagation();
              openTicketModal(item.id);
          });
          featuresContainer.appendChild(btn);
      }
      
      const isRemindersEnabled = getFeatureEnabled(item, 'reminders');
      if (isRemindersEnabled) {
          const btn = document.createElement("button");
          btn.className = "card-back-feature-btn";
          btn.style.backgroundColor = "white"; // Force white
          btn.style.display = "flex";
          btn.style.alignItems = "center";
          btn.style.justifyContent = "center";

          // Use SVG icon for Alarm/Reminder
          btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z"/><path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z"/></svg>`;
          btn.title = "提醒事项";
          btn.addEventListener("click", (e) => {
              e.stopPropagation();
              openReminderModal(item.id);
          });
          featuresContainer.appendChild(btn);
      }

      const addBtn = document.createElement("button");
      addBtn.className = "card-back-add-btn";
      addBtn.innerHTML = "+";
      addBtn.title = "添加功能";
      addBtn.style.display = "flex";
      addBtn.style.alignItems = "center";
      addBtn.style.justifyContent = "center";

      addBtn.addEventListener("click", (e) => {
          e.stopPropagation(); 
          openCardActionPanel(item.id);
      });
      featuresContainer.appendChild(addBtn);
      
      back.appendChild(featuresContainer);

      // --- Assemble ---
      inner.appendChild(front);
      inner.appendChild(back);
      div.appendChild(inner);

      return div;
    }

    function renderCard(container, item) {
      const el = createCardDom(item);
      container.appendChild(el);
    }

    function renderPlanItem(item, seqNum) {
      const el = createCardDom(item);
      el.classList.add("plan-item");
      if (typeof seqNum === 'number') {
        const badge = document.createElement("span");
        badge.className = "plan-item-seq";
        badge.textContent = seqNum;
        
        // Find header to insert
        const header = el.querySelector('.card-header');
        if (header) {
            header.insertBefore(badge, header.firstChild);
        }
      }
      return el;
    }

    function updateWishlistEmptyState() {
      const listEl = document.getElementById("wish-list");
      if (!listEl) return;
      const existingEmpty = listEl.querySelector(".empty-state");
      if (existingEmpty) {
        existingEmpty.remove();
      }

      const hasCards = listEl.querySelector(".card");
      if (!hasCards) {
          const currentList = loadWishlist();
          const emptyDiv = document.createElement("div");
          emptyDiv.className = "empty-state";
          if (currentList.length > 0) {
              emptyDiv.innerHTML = `
                <p>🎉 所有愿望都已安排！</p>
                <p>查看右侧行程表</p>
              `;
          } else {
              emptyDiv.innerHTML = `
                <p>还没有任何旅行愿望哦</p>
                <p>点击右下角“+”添加一个吧！</p>
              `;
          }
          listEl.appendChild(emptyDiv);
      }
    }

    function renderWishlistColumn() {
      // Ensure we have the latest list data
      list = loadWishlist();
      const targetEl = document.getElementById("wish-list");
      
      if (!targetEl) return;
      targetEl.innerHTML = "";
      const allPlanIds = getAllPlanIds();
      const allPlanIdSet = new Set(allPlanIds);
      list.forEach((item) => {
        if (!allPlanIdSet.has(item.id)) {
          renderCard(targetEl, item);
        }
      });
      updateWishlistEmptyState();
    }

    // Initial Render
    if (planListEl) {
       planListEl.innerHTML = "";
       renderPlanListFromState();
    }
    renderWishlistColumn();

    // Assign internalRefresh
    internalRefresh = () => {
        list = loadWishlist();
        planState = loadPlanState();
        // Respect currentDay from storage if available (allows map mode to switch days)
        if (planState.currentDay) {
            currentDay = planState.currentDay;
        }
        currentDay = ensureDayIndex(currentDay);
        planState.currentDay = currentDay;
        planIds = planState.days[currentDay - 1] || [];
        
        if (planDaysEl) renderPlanDayTabs();
        renderPlanListFromState(); 
        renderWishlistColumn();
        if (typeof window !== 'undefined' && window.dispatchEvent) {
          window.dispatchEvent(new CustomEvent('hkwl:updated', { detail: { type: 'refresh', planId: currentPlanId } }));
        }
    };

    if (planDaysEl) {
      renderPlanDayTabs();
    }

    let dragState = null;

    function getPlanOrderedIds() {
      if (!planListEl) return [];
      return Array.from(planListEl.querySelectorAll(".plan-item"))
        .map((el) => el.dataset.id)
        .filter(Boolean);
    }

    function getMainOrderedIds() {
      if (!listEl) return [];
      return Array.from(listEl.querySelectorAll(".card"))
        .map((el) => el.dataset.id)
        .filter(Boolean);
    }

    async function reorderWishlist(newMainIds) {
      const fullList = loadWishlist();
      const planIdsSet = new Set(getAllPlanIds());
      const mainItemsIndices = [];
      fullList.forEach((item, index) => {
        if (!planIdsSet.has(item.id)) {
          mainItemsIndices.push(index);
        }
      });

      if (mainItemsIndices.length !== newMainIds.length) {
        return;
      }

      const itemMap = new Map(fullList.map((item) => [item.id, item]));

      mainItemsIndices.forEach((originalIndex, k) => {
        const newId = newMainIds[k];
        const item = itemMap.get(newId);
        if (item) {
          fullList[originalIndex] = item;
        }
      });

      saveWishlistLocal(fullList);
      markLocalDirty();
      await syncToCloud();
    }

    function getPlanInsertIndex(clientY) {
      if (!planListEl) return 0;
      const items = Array.from(planListEl.querySelectorAll(".plan-item"));
      if (!items.length) return 0;
      for (let i = 0; i < items.length; i++) {
        const rect = items[i].getBoundingClientRect();
        const middle = rect.top + rect.height / 2;
        if (clientY < middle) {
          return i;
        }
      }
      return items.length;
    }

    function handlePlanReorderHover(ghostCy) {
      if (!planListEl) return;
      if (!dragState) return;
      if (dragState.from !== "plan") return;

      const draggingEl = dragState.sourceEl;
      if (!draggingEl) return;

      const prevEl = draggingEl.previousElementSibling;
      const nextEl = draggingEl.nextElementSibling;

      // Swap with Previous
      if (prevEl && prevEl.classList.contains('plan-item')) {
          const rect = prevEl.getBoundingClientRect();
          const threshold = rect.top + rect.height / 2;
          if (ghostCy < threshold) {
              prevEl.parentElement.insertBefore(draggingEl, prevEl);
              animateSwap(prevEl, rect.top, rect.top + draggingEl.offsetHeight);
              return;
          }
      }

      // Swap with Next
      if (nextEl && nextEl.classList.contains('plan-item')) {
          const rect = nextEl.getBoundingClientRect();
          const threshold = rect.top + rect.height / 2;
          if (ghostCy > threshold) {
              const afterNext = nextEl.nextElementSibling;
              if (afterNext) {
                  nextEl.parentElement.insertBefore(draggingEl, afterNext);
              } else {
                  nextEl.parentElement.appendChild(draggingEl);
              }
              animateSwap(nextEl, rect.top, rect.top - draggingEl.offsetHeight);
              return;
          }
      }
    }

    function animateSwap(el, oldTop, newTop) {
        const newRect = el.getBoundingClientRect();
        const dy = oldTop - newRect.top;
        
        if (dy === 0) return;

        el.style.transition = "none";
        el.style.transform = `translateY(${dy}px)`;
        
        el.offsetHeight; 
        
        el.style.transition = "transform 0.2s ease-out";
        el.style.transform = "";
        
        setTimeout(() => {
            el.style.transition = "";
        }, 200);
    }

    function handleMainReorderHover(ghostCy) {
      if (!listEl) return;
      if (!dragState) return;
      if (dragState.from !== "main") return;

      const draggingEl = dragState.sourceEl;
      if (!draggingEl) return;

      const prevEl = draggingEl.previousElementSibling;
      const nextEl = draggingEl.nextElementSibling;

      // Swap with Previous
      if (prevEl && prevEl.classList.contains('card')) {
          const rect = prevEl.getBoundingClientRect();
          const threshold = rect.top + rect.height / 2;
          if (ghostCy < threshold) {
              prevEl.parentElement.insertBefore(draggingEl, prevEl);
              animateSwap(prevEl, rect.top, rect.top + draggingEl.offsetHeight);
              return;
          }
      }

      // Swap with Next
      if (nextEl && nextEl.classList.contains('card')) {
          const rect = nextEl.getBoundingClientRect();
          const threshold = rect.top + rect.height / 2;
          if (ghostCy > threshold) {
              const afterNext = nextEl.nextElementSibling;
              if (afterNext) {
                  nextEl.parentElement.insertBefore(draggingEl, afterNext);
              } else {
                  nextEl.parentElement.appendChild(draggingEl);
              }
              animateSwap(nextEl, rect.top, rect.top - draggingEl.offsetHeight);
              return;
          }
      }
    }

    function onPointerMove(e) {
      if (!dragState) return;
      if (e.pointerId !== dragState.pointerId) return;

      if (!e.isPrimary) return;

      // Long Press Wait Logic
      if (dragState.isTouchWait) {
          const dx = e.clientX - dragState.startX;
          const dy = e.clientY - dragState.startY;
          if (Math.hypot(dx, dy) > 15) {
              // Moved too much -> It is a scroll -> Cancel drag
              clearTimeout(dragState.timer);
              dragState = null;
              window.removeEventListener("pointermove", onPointerMove);
              window.removeEventListener("pointerup", endDrag);
              window.removeEventListener("pointercancel", endDrag);
              return;
          }
          return; // Wait for timer
      }

      if (!dragState.isDragging) {
          const dx = e.clientX - dragState.startX;
          const dy = e.clientY - dragState.startY;
          if (Math.hypot(dx, dy) > 10) {
              dragState.isDragging = true;
              startVisualDrag(e);
          } else {
              return;
          }
      }

      if (dragState.isDragging) {
          if (e.cancelable) e.preventDefault();
          
          const dragEl = dragState.dragEl;
          if (!dragEl) return;

          dragState.lastClientX = e.clientX;
          dragState.lastClientY = e.clientY;
          
          dragEl.style.left = e.clientX + "px";
      dragEl.style.top = e.clientY + "px";
          
          const ghostRect = dragEl.getBoundingClientRect();
          const ghostCx = ghostRect.left + ghostRect.width / 2;
          const ghostCy = ghostRect.top + ghostRect.height / 2;

          // Pure Geometry-based detection
          // This avoids issues with elementFromPoint hitting the dragged element or missing the target
          
          const mainDropTarget = mainColumnEl || listEl;
          let over = null;
          let hoveredDay = null;
          
          // 1. Check Plan List
          if (planListEl) {
             const rect = planListEl.getBoundingClientRect();
             // Expand rect slightly to make it easier to drop
             if (
               e.clientX >= rect.left - 20 &&
               e.clientX <= rect.right + 20 &&
               e.clientY >= rect.top - 20 &&
               e.clientY <= rect.bottom + 20
             ) {
               over = "plan";
             }
          }

          // 2. Check Day Tabs (treat as Plan)
          if (planDaysEl) {
            const dayButtons = Array.from(planDaysEl.querySelectorAll(".plan-day-btn"));
            for (let i = 0; i < dayButtons.length; i++) {
              const btn = dayButtons[i];
              const rect = btn.getBoundingClientRect();
              if (
                e.clientX >= rect.left &&
                e.clientX <= rect.right &&
                e.clientY >= rect.top &&
                e.clientY <= rect.bottom
              ) {
                const value = btn.dataset.dayIndex;
                if (value) {
                  hoveredDay = parseInt(value, 10);
                  over = "plan";
                }
                break;
              }
            }
          }

          // 3. Check Main List
          if (!over && mainDropTarget) {
              const rect = mainDropTarget.getBoundingClientRect();
              if (
                e.clientX >= rect.left &&
                e.clientX <= rect.right &&
                e.clientY >= rect.top &&
                e.clientY <= rect.bottom
              ) {
                over = "main";
              }
          }

          if (planListEl) {
            if (over === "plan") {
              planListEl.classList.add("plan-list-dragover");
            } else {
              planListEl.classList.remove("plan-list-dragover");
            }
          }

          if (
            hoveredDay &&
            hoveredDay !== currentDay &&
            typeof switchDay === "function"
          ) {
             if (!dragState.switchDayTimeout) {
                dragState.switchDayTimeout = setTimeout(() => {
                    switchDay(hoveredDay);
                    dragState.switchDayTimeout = null;
                }, 600);
             }
          } else {
             if (dragState.switchDayTimeout) {
                clearTimeout(dragState.switchDayTimeout);
                dragState.switchDayTimeout = null;
             }
          }
          
          // Reordering Logic - Direct Call based on 'over' state
          if (over === "plan" && dragState.from === "plan") {
            handlePlanReorderHover(ghostCy);
          }
          if (over === "main" && dragState.from === "main") {
            handleMainReorderHover(ghostCy);
          }
          
          if (dragState.from === "plan" && dragState.sourceEl) {
            if (over === "plan") {
              dragState.sourceEl.classList.remove("drag-origin-collapsed");
            } else {
              dragState.sourceEl.classList.add("drag-origin-collapsed");
            }
          }

          dragState.overList = over;
      }
    }

    function endDrag(e) {
      if (!dragState) return;
      if (e.pointerId !== dragState.pointerId) return;

      if (dragState.timer) {
          clearTimeout(dragState.timer);
      }
      
      const wasDragging = dragState.isDragging;
      
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
      document.body.style.userSelect = "";
      
      // Reset overflow for touch devices
      if (e.pointerType === 'touch') {
          document.body.style.overflow = '';
      }

      if (!wasDragging) {
          dragState = null;
          return;
      }

      const id = dragState.id;
      const from = dragState.from;
      const over = dragState.overList;
      const sourceEl = dragState.sourceEl;
      const dragEl = dragState.dragEl;

      if (dragEl && dragEl.parentNode) {
        dragEl.parentNode.removeChild(dragEl);
      }
      if (sourceEl) {
        sourceEl.classList.remove("drag-origin-hidden");
        sourceEl.classList.remove("dragging");
        sourceEl.classList.remove("drag-origin-collapsed");
      }
      if (planListEl) {
        planListEl.classList.remove("plan-list-dragover");
      }

      if (over === "plan" && planListEl && id) {
        const allPlanIds = getAllPlanIds();
        const isInCurrentDay = planIds.includes(id);

        if (from === "plan" && isInCurrentDay) {
          const orderedIds = getPlanOrderedIds();
          applyPlanIds(orderedIds);
        } else if (
          (from === "main" && !allPlanIds.includes(id)) ||
          (from === "plan" && !isInCurrentDay)
        ) {
          if (from === "plan") {
            const position = findPlanItemDay(planState, id);
            if (position) {
              const oldDayIndex = position.day - 1;
              if (Array.isArray(planState.days) && planState.days[oldDayIndex]) {
                planState.days[oldDayIndex] = planState.days[oldDayIndex].filter(
                  (pid) => pid !== id
                );
              }
            }
          }

          const item = list.find((x) => x.id === id);
          if (item) {
            const prevRects = new Map();
            const existingItems = Array.from(
              planListEl.querySelectorAll(".plan-item")
            );
            existingItems.forEach((el) => {
              prevRects.set(el.dataset.id, el.getBoundingClientRect());
            });

            const newEl = renderPlanItem(item);
            if (item.type !== "note") {
              newEl.classList.add("collapsed");
              collapsedIds.add(item.id);
              saveCollapsedIds(Array.from(collapsedIds));
            }

            const insertIndex = dragState.lastClientY
              ? getPlanInsertIndex(dragState.lastClientY)
              : existingItems.length;
            const children = Array.from(planListEl.querySelectorAll(".plan-item"));
            if (insertIndex >= children.length) {
              getPlanListContent().appendChild(newEl);
            } else {
              children[insertIndex].parentElement.insertBefore(newEl, children[insertIndex]);
            }

            if (
              sourceEl &&
              sourceEl.parentElement
            ) {
              sourceEl.parentElement.removeChild(sourceEl);
            }
            updateWishlistEmptyState();

            const orderedIds = getPlanOrderedIds();
            applyPlanIds(orderedIds);

            const newItems = Array.from(
              planListEl.querySelectorAll(".plan-item")
            );
            newItems.forEach((el) => {
              const elId = el.dataset.id;
              const prev = prevRects.get(elId);
              if (!prev) return;
              const newRect = el.getBoundingClientRect();
              const dy = prev.top - newRect.top;
              if (!dy) return;
              el.style.transition = "none";
              el.style.transform = `translateY(${dy}px)`;
              el.getBoundingClientRect();
              el.style.transition = "";
              el.style.transform = "";
            });
          }
        }
      } else if (over === "main" && id) {
        if (from === "plan") {
          const position = findPlanItemDay(planState, id);
          if (position) {
            const dayIndex = position.day - 1;
            if (!Array.isArray(planState.days)) {
              planState.days = [[]];
            }
            if (dayIndex >= 0 && dayIndex < planState.days.length) {
              const dayIds = planState.days[dayIndex].filter((x) => x !== id);
              planState.days[dayIndex] = dayIds;
            }
            currentDay = ensureDayIndex(currentDay);
            planIds = planState.days[currentDay - 1] || [];
            planState.currentDay = currentDay;
            savePlanStateLocal(planState);
            markLocalDirty();
            syncToCloud(); // Async sync
          }
          if (planListEl) {
            const node = planListEl.querySelector(`[data-id="${id}"]`);
            if (node && node.parentElement) {
              node.parentElement.removeChild(node);
            }
          }
          const item = list.find((x) => x.id === id);
          if (item) {
            const el = createCardDom(item);
            if (item.type !== "note") {
              el.classList.add("collapsed");
              collapsedIds.add(item.id);
              saveCollapsedIds(Array.from(collapsedIds));
            }

            let inserted = false;
            const children = Array.from(listEl.children);
            if (children.length > 0) {
              for (const child of children) {
                const rect = child.getBoundingClientRect();
                const centerY = rect.top + rect.height / 2;
                if (e.clientY < centerY) {
                  listEl.insertBefore(el, child);
                  inserted = true;
                  break;
                }
              }
            }
            if (!inserted) {
              listEl.appendChild(el);
            }

            const newOrderedIds = getMainOrderedIds();
            reorderWishlist(newOrderedIds);
            updateWishlistEmptyState();
          }
        } else if (from === "main") {
          const newOrderedIds = getMainOrderedIds();
          reorderWishlist(newOrderedIds);
        }
      }

      dragState = null;
    }

    function startVisualDrag(e) {
      if (!dragState || !dragState.sourceEl) return;
      
      const sourceEl = dragState.sourceEl;
      const from = dragState.from;

      let name = "";
      const id = sourceEl.dataset.id;
      const item = list.find((x) => x.id === id);
      if (item) {
        name = item.name;
      } else {
        if (from === "main") {
          name = sourceEl.querySelector("h3")?.textContent || "";
        } else {
          name = sourceEl.querySelector("div")?.textContent || "";
        }
      }

      const dragEl = document.createElement("div");
      dragEl.textContent = name;
      dragEl.className = "dragging-item-ghost";
      if (item && item.type) {
        dragEl.classList.add(`dragging-item-ghost-${item.type}`);
      }
      dragEl.style.left = e.clientX + "px";
      dragEl.style.top = e.clientY + "px";
      document.body.appendChild(dragEl);

      sourceEl.classList.add("drag-origin-hidden");
      
      dragState.dragEl = dragEl;
      dragState.isDragging = true;
      dragState.lastReorderTime = 0; // Initialize throttle timer
      
      // Stop scrolling on mobile when drag starts
      if (e.pointerType === 'touch') {
          document.body.style.overflow = 'hidden';
      }

      document.body.style.userSelect = "none";
    }

    function handlePointerDown(e) {
      // Drag and drop is currently disabled
      return;

      if (e.button !== 0) return;
      if (dragState) return;
      const target = e.target;
      if (!target) return;
      
      // Ignore interactive elements
      if (target.closest(".card-actions .btn")) return;
      if (target.closest(".card-toggle-btn")) return;
      if (target.closest("[contenteditable='true']")) return;
      const inNoteDragSpacer = !!target.closest(".note-drag-spacer");
      const inNoteTextInner = !!target.closest(".note-text-inner");
      if (!inNoteDragSpacer && inNoteTextInner) return;

      let sourceEl = null;
      let from = null;

      const card = target.closest(".card");
      const planItem = target.closest(".plan-item");

      if (card && listEl.contains(card)) {
        sourceEl = card;
        from = "main";
      } else if (planItem && planListEl && planListEl.contains(planItem)) {
        sourceEl = planItem;
        from = "plan";
      }

      if (!sourceEl || !from) return;

      // Logic for initiating drag:
      const isTouch = e.pointerType === 'touch' || e.pointerType === 'pen';
      const isHeader = !!target.closest('.card-header');
      const isNoteSpacer = !!target.closest('.note-drag-spacer');

      let timer = null;
      let isTouchWait = false;

      // Calculate Offset immediately
      const rect = sourceEl.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;

      if (isTouch) {
          // Touch Logic:
          // If header/spacer: Immediate drag (prevent scroll)
          if (isHeader || isNoteSpacer) {
              e.preventDefault();
          } else {
              // Body drag -> Long Press (250ms)
              // We do NOT preventDefault here, allowing the browser to scroll.
              // If the user moves before the timer fires, onPointerMove will cancel the timer.
              isTouchWait = true;
              timer = setTimeout(() => {
                  if (!dragState) return;
                  dragState.isTouchWait = false;
                  dragState.isDragging = true;
                  if (navigator.vibrate) navigator.vibrate(50);
                  
                  // Start visual feedback
                  startVisualDrag({
                      clientX: dragState.startX,
                      clientY: dragState.startY,
                      pointerType: e.pointerType
                  });
              }, 250);
          }
      } else {
          // Mouse Logic: Immediate
          e.preventDefault();
      }
      
      dragState = {
        id: sourceEl.dataset.id || "",
        from,
        sourceEl,
        dragEl: null,
        isDragging: false,
        isTouchWait,
        timer,
        startX: e.clientX,
        startY: e.clientY,
        offsetX, 
        offsetY,
        pointerId: e.pointerId,
        overList: null,
        lastClientX: e.clientX,
        lastClientY: e.clientY,
      };
      
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", endDrag);
      window.addEventListener("pointercancel", endDrag);
    }

    if (listEl) {
      listEl.addEventListener("pointerdown", handlePointerDown);
    }
    if (planListEl) {
      planListEl.addEventListener("pointerdown", handlePointerDown);
    }

    // Ensure block view is fully refreshed
    if (typeof internalRefresh === 'function') {
        internalRefresh();
    }
  }

  function initManagePage() {
    const form = document.getElementById("wish-form");
    const foodFields = document.getElementById("food-fields");
    const placeFields = document.getElementById("place-fields");
    const transportFields = document.getElementById("transport-fields");
    const stayFields = document.getElementById("stay-fields");

    const keywordsContainer = document.getElementById("keywords-container");
    const mapSectionContainer = document.getElementById("map-section-container");
    const nameLabel = document.getElementById("name-label");

    const nameInput = document.getElementById("name");
    const locationInput = document.getElementById("location");
    const placeLocationInput = document.getElementById("place-location");
    const playTimeInput = document.getElementById("playTime");
    const travelTimeHInput = document.getElementById("travelTimeH");
    const travelTimeMInput = document.getElementById("travelTimeM");
    const keywordsInputEl = document.getElementById("keywords");
    const foodCostInput = document.getElementById("food-cost");
    const placeCostInput = document.getElementById("place-cost");
    const transportCostInput = document.getElementById("transport-cost");
    const stayLocationInput = document.getElementById("stay-location");
    const stayCostInput = document.getElementById("stay-cost");
    const submitBtn = document.getElementById("submit-btn");
    const cancelLink = document.getElementById("cancel-link");

    const params = new URLSearchParams(window.location.search);
    const isPopup = params.get("popup") === "true";
    
    if (isPopup) {
        const header = document.querySelector('.site-header');
        if (header) header.style.display = 'none';
        
        // Adjust container padding if needed, or body
        document.body.style.padding = '0';
        document.body.style.background = 'white';
        const main = document.querySelector('main');
        if (main) {
             main.style.marginTop = '0';
             main.style.padding = '10px';
             main.style.maxWidth = '100%';
        }
    }

    const editingId = params.get("id");
    const typeParam = params.get("type");
    let editingItem = null;
    let currentType = typeParam || "food";
    if (!["food", "place", "transport", "stay"].includes(currentType)) {
      currentType = "food";
    }

    const isEditing = !!editingId;
    if (editingId) {
      const list = loadWishlist();
      editingItem = list.find((item) => item.id === editingId) || null;
      if (editingItem) {
        currentType = editingItem.type;
      }
    }

    const typeNames = {
      food: "美食",
      place: "景点",
      stay: "住宿",
      transport: "交通",
    };
    const typeName = typeNames[currentType] || "项目";
    const pageTitle = isEditing ? `编辑${typeName}` : `添加${typeName}`;
    document.title = pageTitle;
    const headerH1 = document.querySelector(".site-header h1");
    if (headerH1) {
      headerH1.textContent = pageTitle;
    }

    function updateFieldVisibility() {
      const isFood = currentType === "food";
      const isPlace = currentType === "place";
      const isTransport = currentType === "transport";
      const isStay = currentType === "stay";

      foodFields.hidden = !isFood;
      placeFields.hidden = !isPlace;
      if (transportFields) transportFields.hidden = !isTransport;
      if (stayFields) stayFields.hidden = !isStay;

      if (keywordsContainer) {
        keywordsContainer.hidden = true; // Always hide keywords/remarks
      }
      if (mapSectionContainer) {
        mapSectionContainer.hidden = isTransport;
      }
      if (nameLabel) {
        nameLabel.textContent = isTransport ? "交通方式 *" : "名称 *";
      }

      form.mealType.required = false;
      form.location.required = false;
      form.placeLocation.required = false;
      if (form.stayLocation) form.stayLocation.required = false;

      if (form.travelTimeH) form.travelTimeH.required = false;
      if (form.travelTimeM) form.travelTimeM.required = false;

      if (isFood) {
        form.location.required = true;
      } else if (isPlace) {
        form.placeLocation.required = true;
      } else if (isTransport) {
        if (form.travelTimeH) form.travelTimeH.required = true;
        if (form.travelTimeM) form.travelTimeM.required = true;
      } else if (isStay) {
        if (form.stayLocation) form.stayLocation.required = true;
      }
    }

    if (editingItem) {
      updateFieldVisibility();

      nameInput.value = editingItem.name || "";

      // Restore coordinates
      if (editingItem.coords) {
          const lngInput = document.getElementById('lng');
          const latInput = document.getElementById('lat');
          if (lngInput) lngInput.value = editingItem.coords.lng;
          if (latInput) latInput.value = editingItem.coords.lat;
      }

      if (keywordsInputEl && editingItem.keywords && editingItem.keywords.length) {
        keywordsInputEl.value = editingItem.keywords.join("，");
      }

      if (editingItem.type === "food") {
        if (form.mealType) {
          form.mealType.value = editingItem.mealType || "";
        }
        if (form.location) {
          form.location.value = editingItem.location || "";
        }
      } else if (editingItem.type === "place") {
        if (form.placeLocation) {
          form.placeLocation.value = editingItem.location || "";
        }
      } else if (editingItem.type === "transport") {
        if (travelTimeHInput && travelTimeMInput) {
          const val = parseFloat(editingItem.travelTime);
          if (!isNaN(val)) {
             const h = Math.floor(val);
             const m = Math.round((val - h) * 60);
             travelTimeHInput.value = h;
             travelTimeMInput.value = m;
          } else {
             travelTimeHInput.value = 0;
             travelTimeMInput.value = 0;
          }
        }
      } else if (editingItem.type === "stay") {
        if (stayLocationInput) {
          stayLocationInput.value = editingItem.location || "";
        }
      }

      if (submitBtn) {
        submitBtn.textContent = "保存编辑";
      }
      if (cancelLink) {
        cancelLink.textContent = "取消编辑";
        if (isPopup) {
            cancelLink.href = "javascript:void(0)";
            cancelLink.onclick = (e) => {
                e.preventDefault();
                window.parent.postMessage({ type: 'edit-cancel' }, '*');
            };
        }
      }
    } else {
      updateFieldVisibility();
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const formData = new FormData(form);
      const type = currentType;
      const name = formData.get("name")?.toString().trim();

      if (!name) {
        showToast("请填写名称", "error");
        return;
      }

      let wishBase = {
        type,
        name,
        keywords: [],
      };

      // Extract coordinates
      const lng = formData.get("lng");
      const lat = formData.get("lat");
      if (lng && lat) {
          wishBase.coords = { lng: parseFloat(lng), lat: parseFloat(lat) };
      }

      if (type === "food") {
        const mealTypeRaw = formData.get("mealType");
        const locationRaw = formData.get("location");

        const mealType = mealTypeRaw ? mealTypeRaw.toString().trim() : "";
        const location = locationRaw ? locationRaw.toString().trim() : "";
        
        wishBase = {
          ...wishBase,
          mealType,
          location,
        };
      } else if (type === "place") {
        const placeLocationRaw = formData.get("placeLocation");
        const placeLocation = placeLocationRaw
          ? placeLocationRaw.toString().trim()
          : "";
        
        wishBase = {
          ...wishBase,
          location: placeLocation,
        };
      } else if (type === "transport") {
        const hRaw = formData.get("travelTimeH");
        const mRaw = formData.get("travelTimeM");
        const estimatedCostRaw = formData.get("transportCost");

        const h = hRaw ? parseInt(hRaw, 10) : 0;
        const m = mRaw ? parseInt(mRaw, 10) : 0;
        
        if (m < 0 || m > 59) {
             alert("分钟数必须在 0-59 之间");
             return;
        }

        const totalHours = h + m / 60;
        const travelTime = parseFloat(totalHours.toFixed(2)).toString();

        let estimatedCost = estimatedCostRaw ? estimatedCostRaw.toString().trim() : "";
        if (estimatedCost && /^\d+(\.\d+)?$/.test(estimatedCost)) {
           estimatedCost += " 人民币";
        }

        wishBase = {
          ...wishBase,
          travelTime,
          estimatedCost,
        };
      } else if (type === "stay") {
        const stayLocationRaw = formData.get("stayLocation");

        const stayLocation = stayLocationRaw ? stayLocationRaw.toString().trim() : "";

        wishBase = {
          ...wishBase,
          location: stayLocation,
        };
      } else {
        showToast("未知的愿望类型", "error");
        return;
      }

      try {
        const list = loadWishlist();
        if (editingItem) {
          const nextList = list.map((item) =>
            item.id === editingItem.id ? { ...item, ...wishBase } : item
          );
          await saveWishlist(nextList);
        } else {
          const wish = createWish(wishBase);
          list.unshift(wish);
          await saveWishlist(list);
        }

        showToast("已保存旅行项目！", "success");
        
        if (editingItem) {
          setTimeout(() => {
            if (isPopup) {
                window.parent.postMessage({ type: 'edit-complete' }, '*');
            } else {
                window.location.href = `planner.html?id=${currentPlanId}`;
            }
          }, 1000);
        } else {
          form.reset();
          updateFieldVisibility();
        }
      } catch (err) {
        console.error("保存失败", err);
        showToast("保存失败，请重试", "error");
      }
    });

    setupMapIntegration(nameInput, locationInput, placeLocationInput, stayLocationInput);
  }

  function setupMapIntegration(nameInput, locationInput, placeLocationInput, stayLocationInput) {
    const mapContainer = document.getElementById("map-container");
    const searchInput = document.getElementById("map-search");

    if (!mapContainer) {
      console.warn("未找到地图容器 #map-container，已跳过地图初始化");
      return;
    }

    if (typeof window.AMapLoader === "undefined") {
      mapContainer.textContent =
        "地图加载失败：高德地图脚本未成功加载，请检查网络或 Key 配置。";
      mapContainer.style.display = "flex";
      mapContainer.style.alignItems = "center";
      mapContainer.style.justifyContent = "center";
      mapContainer.style.color = "#666";
      mapContainer.style.fontSize = "0.9rem";
      console.error(
        "高德地图 loader.js 未加载（window.AMapLoader 为 undefined），地图选点功能不可用。"
      );
      return;
    }

    if (!searchInput) {
      console.warn("未找到地图搜索输入框 #map-search，已跳过地图初始化");
      return;
    }

    const amapKey = "8040299dec271ec2928477f709015d3d";

    window.AMapLoader.load({
      key: amapKey,
      version: "2.0",
      plugins: ["AMap.Geocoder", "AMap.AutoComplete", "AMap.PlaceSearch"],
    })
      .then(function (AMap) {
        const settings = loadSettings();
        const defaultCenter = settings.mapCenter
          ? [settings.mapCenter.lng, settings.mapCenter.lat]
          : [105.0, 35.0];
        const defaultZoom = settings.mapCenter ? settings.mapCenter.zoom : 4;

        const map = new AMap.Map("map-container", {
          zoom: defaultZoom,
          center: defaultCenter,
        });
        let marker = null;
        function ensureMarker(position) {
          if (!position) return;
          if (!marker) {
            marker = new AMap.Marker({
              position,
              map,
              offset: new AMap.Pixel(-8, -8),
              content:
                '<div style="width:16px;height:16px;border-radius:50%;background:#e53935;border:2px solid #fff;box-shadow:0 0 4px rgba(0,0,0,0.5);"></div>',
              zIndex: 999,
            });
          } else {
            marker.setPosition(position);
          }
        }
        mapContainer.style.position = "relative";
        const loadingEl = document.createElement("div");
        loadingEl.textContent = "正在加载地图数据...";
        loadingEl.style.position = "absolute";
        loadingEl.style.left = "0";
        loadingEl.style.top = "0";
        loadingEl.style.right = "0";
        loadingEl.style.bottom = "0";
        loadingEl.style.display = "none";
        loadingEl.style.alignItems = "center";
        loadingEl.style.justifyContent = "center";
        loadingEl.style.backgroundColor = "rgba(255, 255, 255, 0.7)";
        loadingEl.style.color = "#333";
        loadingEl.style.fontSize = "0.9rem";
        mapContainer.appendChild(loadingEl);
        function showLoading() {
          loadingEl.style.display = "flex";
        }
        function hideLoading() {
          loadingEl.style.display = "none";
        }
        function applySelection(poi) {
          if (!poi) return;
          if (nameInput && poi.name) {
            nameInput.value = poi.name;
          }
          const district = poi.district || "";
          const address = poi.address || "";
          const text =
            district && address
              ? district + " " + address
              : district || address;
          
          // Save coordinates if available
          if (poi.location) {
             const lngInput = document.getElementById('lng');
             const latInput = document.getElementById('lat');
             if (lngInput) lngInput.value = poi.location.lng;
             if (latInput) latInput.value = poi.location.lat;
          } else if (poi.location === undefined && marker) {
             // Fallback to marker position if poi.location is missing but we have a marker (e.g. from map click)
             const pos = marker.getPosition();
             const lngInput = document.getElementById('lng');
             const latInput = document.getElementById('lat');
             if (lngInput && pos) lngInput.value = pos.lng;
             if (latInput && pos) latInput.value = pos.lat;
          }

          if (!text) return;
          if (locationInput) {
            locationInput.value = text;
          }
          if (placeLocationInput) {
            placeLocationInput.value = text;
          }
          if (stayLocationInput) {
            stayLocationInput.value = text;
          }
        }
        const geocoder = new AMap.Geocoder({ city: "香港" });
        const autoComplete = new AMap.AutoComplete({
          city: "香港",
          input: "map-search",
        });
        function triggerAutocompleteIfNeeded() {
          const value = searchInput.value.trim();
          if (!value) return;
          const ev = new Event("input", { bubbles: true });
          searchInput.dispatchEvent(ev);
        }
        searchInput.addEventListener("focus", triggerAutocompleteIfNeeded);
        searchInput.addEventListener("click", triggerAutocompleteIfNeeded);
        const placeSearch = new AMap.PlaceSearch({
          city: "香港",
          map: map,
        });
        map.on("click", function (e) {
          const lnglat = e.lnglat;
          if (!lnglat) return;
          showLoading();
          ensureMarker(lnglat);
          map.setZoom(15);
          map.setCenter(lnglat);
          geocoder.getAddress(lnglat, function (status, result) {
            if (
              status === "complete" &&
              result.regeocode &&
              result.regeocode.addressComponent
            ) {
              const comp = result.regeocode.addressComponent;
              const formatted = result.regeocode.formattedAddress || "";
              const poi = {
                name: formatted,
                district: comp.district || comp.township || "",
                address: formatted,
                location: lnglat // Pass location explicitly
              };
              applySelection(poi);
            }
            hideLoading();
          });
        });
        autoComplete.on("select", function (e) {
          if (!e.poi) return;
          showLoading();
          const poi = e.poi;
          applySelection(poi);
          if (poi.location) {
            map.setZoom(16);
            map.setCenter(poi.location);
            ensureMarker(poi.location);
            hideLoading();
          } else {
            placeSearch.search(poi.name, function () {
              hideLoading();
            });
          }
        });
      })
      .catch(function (error) {
        mapContainer.textContent =
          "地图加载失败：无法初始化高德地图，请检查网络或 Key 配置。";
        mapContainer.style.display = "flex";
        mapContainer.style.alignItems = "center";
        mapContainer.style.justifyContent = "center";
        mapContainer.style.color = "#666";
        mapContainer.style.fontSize = "0.9rem";
        console.error("加载高德地图失败", error);
      });
  }

  function initSettingsPage() {
    const params = new URLSearchParams(window.location.search);
    const isNew = params.get("new") === "true";
    
    if (isNew) {
        document.title = "创建新计划";
        const h1 = document.querySelector(".site-header h1");
        if (h1) h1.textContent = "创建新计划";
        
        const saveBtn = document.getElementById("save-btn");
        if (saveBtn) saveBtn.textContent = "开始规划";
        
        const backBtn = document.querySelector('a[href^="planner.html"]');
        if (backBtn) {
            backBtn.textContent = "取消";
            backBtn.href = "#";
            backBtn.addEventListener("click", (e) => {
                e.preventDefault();
                if (window.confirm("确定要取消创建计划吗？")) {
                    deletePlan(currentPlanId);
                    window.location.href = "index.html";
                }
            });
        }
    }

    const settings = loadSettings();
    const titleInput = document.getElementById("list-title");
    const mapContainer = document.getElementById("map-container");
    const searchInput = document.getElementById("map-search");
    const form = document.getElementById("settings-form");

    if (isNew && !titleInput.value.trim()) {
        titleInput.value = "";
        titleInput.placeholder = "请输入计划名称（必填）";
    } else if (titleInput) {
      titleInput.value = settings.title || "";
    }

    let currentMapCenter = settings.mapCenter;

    if (mapContainer && typeof window.AMapLoader !== "undefined") {
      const amapKey = "8040299dec271ec2928477f709015d3d";
      window.AMapLoader.load({
        key: amapKey,
        version: "2.0",
        plugins: ["AMap.AutoComplete", "AMap.PlaceSearch"],
      })
        .then(function (AMap) {
          const defaultCenter = [105.0, 35.0];
          const center = currentMapCenter
            ? [currentMapCenter.lng, currentMapCenter.lat]
            : defaultCenter;
          const zoom = currentMapCenter ? currentMapCenter.zoom : 4;

          const map = new AMap.Map("map-container", {
            zoom: zoom,
            center: center,
          });

          let centerMarker = null;

          if (currentMapCenter) {
             centerMarker = new AMap.Marker({
                position: center,
                map: map,
                icon: "https://webapi.amap.com/theme/v1.3/markers/n/mark_b.png",
                offset: new AMap.Pixel(-9, -31) // default align
             });
          }

          function updateSelection(lnglat) {
            if (!lnglat) return;
            if (!centerMarker) {
              centerMarker = new AMap.Marker({
                position: lnglat,
                map: map,
                icon: "https://webapi.amap.com/theme/v1.3/markers/n/mark_b.png",
                offset: new AMap.Pixel(-9, -31)
              });
            } else {
              centerMarker.setPosition(lnglat);
            }
            
            // Update state
            currentMapCenter = {
              lng: lnglat.getLng(),
              lat: lnglat.getLat(),
              zoom: map.getZoom()
            };
          }

          map.on("click", function(e) {
             updateSelection(e.lnglat);
          });

          // Only update zoom, not center, when moving/zooming purely
          map.on("zoomend", function() {
            if (currentMapCenter) {
              currentMapCenter.zoom = map.getZoom();
            }
          });

          const autoComplete = new AMap.AutoComplete({
            city: "全国",
            input: "map-search",
            output: "map-search-result" // A hidden or visible container for results if needed, but 'input' should suffice for standard behavior
          });

          const placeSearch = new AMap.PlaceSearch({
            city: "全国",
            map: map,
          });

          autoComplete.on("select", function (e) {
            if (e.poi && e.poi.location) {
              map.setZoom(15);
              map.setCenter(e.poi.location);
            } else if (e.poi && e.poi.name) {
               placeSearch.search(e.poi.name);
            }
          });
        })
        .catch((e) => {
          console.error("Map load failed", e);
          mapContainer.textContent = "地图加载失败";
          mapContainer.style.display = "flex";
          mapContainer.style.alignItems = "center";
          mapContainer.style.justifyContent = "center";
        });
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      const title = titleInput.value.trim();
      if (isNew && !title) {
          showToast("请输入计划名称", "error");
          titleInput.focus();
          return;
      }
      
      const newSettings = {
        title: title || (isNew ? "未命名计划" : settings.title),
        mapCenter: currentMapCenter,
      };
      
      // Save and wait for sync to complete before redirecting
      const saveBtn = document.getElementById("save-btn");
      const originalText = saveBtn ? saveBtn.textContent : "";
      if (saveBtn) {
          saveBtn.disabled = true;
          saveBtn.textContent = "保存中...";
      }
      
      const res = await saveSettings(newSettings, currentPlanId);
      
      if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.textContent = originalText;
      }

      if (res && res.error) {
          showToast("同步失败，请检查网络", "error");
          console.error("Save/Sync failed", res.error);
          return;
      }

      showToast(isNew ? "计划已创建" : "设置已保存", "success");
      setTimeout(() => {
        window.location.href = `planner.html?id=${currentPlanId}`;
      }, 500); // Reduced delay since we already awaited sync
    });
  }

  async function autoGenerateTransports(targetDayIndex = null, customSequence = null) {
    if (!currentPlanId) return;
    
    // Ensure AMap is loaded
    if (typeof AMap === 'undefined') {
        try {
            await AMapLoader.load({
                key: "8040299dec271ec2928477f709015d3d",
                version: "2.0",
                plugins: ["AMap.Transfer", "AMap.Walking", "AMap.Driving"],
            });
        } catch (e) {
            console.error(e);
            alert("地图加载失败，无法计算交通");
            return;
        }
    } else {
        // Ensure plugins are loaded
        const plugins = [];
        if (!AMap.Transfer) plugins.push("AMap.Transfer");
        if (!AMap.Walking) plugins.push("AMap.Walking");
        if (!AMap.Driving) plugins.push("AMap.Driving");
        
        if (plugins.length > 0) {
             await new Promise(resolve => AMap.plugin(plugins, resolve));
        }
    }

    const planState = loadPlanState();
    const wishlist = loadWishlist();
    const wishMap = new Map(wishlist.map(i => [i.id, i]));
    
    let modified = false;
    const newItems = [];

    // Helper to calculate transport
    const calculateTransport = (start, end) => {
      return new Promise(async (resolve, reject) => {
          const startLngLat = new AMap.LngLat(start.lng, start.lat);
          const endLngLat = new AMap.LngLat(end.lng, end.lat);

          // Calculate distance in meters
          // If distance > 100km, skip automatic calculation (User requested manual addition for long-distance)
          const straightDistance = startLngLat.distance(endLngLat);
          if (straightDistance > 100000) {
              resolve([]); 
              return;
          }

          // 1. Walking
          const getWalking = () => new Promise(r => {
              const walking = new AMap.Walking(); // Remove hardcoded city
              walking.search(startLngLat, endLngLat, (status, result) => {
                  if (status === 'complete' && result.routes && result.routes.length) {
                      r({ 
                          time: Math.round(result.routes[0].time / 60), 
                          distance: result.routes[0].distance 
                      });
                  } else {
                      r(null);
                  }
              });
          });

          // 2. Public Transit
          const getTransit = () => new Promise(r => {
              // Determine city based on start coordinates
              // HK Bounding Box (approx): 113.8 - 114.5 E, 22.1 - 22.6 N
              let city = '深圳'; // Default fallback
              if (start.lng > 113.80 && start.lng < 114.50 && start.lat > 22.10 && start.lat < 22.60) {
                  city = '香港';
              }

              const transfer = new AMap.Transfer({
                  policy: AMap.TransferPolicy.LEAST_TIME,
                  city: city,
                  nightflag: true, // Include night buses if applicable
                  extensions: 'all' // Improve accuracy
              });
              
              transfer.search(startLngLat, endLngLat, (status, result) => {
                  if (status === 'complete' && result.plans && result.plans.length) {
                      const plan = result.plans[0];
                      // Filter out pure walking segments from the name construction if possible, 
                      // but usually we want to show the main transit modes.
                      const mainSegments = plan.segments.filter(s => s.transit_mode !== 'WALK');
                      let name = "";
                      
                      if (mainSegments.length > 0) {
                          name = mainSegments.map(s => {
                              if (s.transit_mode === 'SUBWAY' || s.transit_mode === 'BUS') {
                                  if (s.transit && s.transit.lines && s.transit.lines.length > 0) {
                                      // Clean up names like "Disney Resort Line (Sunny Bay - Disney Resort)" -> "Disney Resort Line"
                                      let lineName = s.transit.lines[0].name;
                                      lineName = lineName.split('(')[0].trim(); 
                                      return lineName.replace(/香港|九巴|城巴|新巴|屿巴/g, '').trim();
                                  }
                              } else if (s.transit_mode === 'RAILWAY') {
                                  // Handle intercity trains
                                  if (s.railway && s.railway.name) {
                                      return s.railway.name;
                                  }
                              }
                              return s.instruction; // fallback
                          }).join(" + ");
                      } else {
                          // If only walking (should be caught by walking search, but possible in Transfer)
                          name = "步行接驳";
                      }
                      
                      r({
                          time: Math.round(plan.time / 60),
                          name: name || "公共交通",
                          segments: mainSegments
                      });
                  } else {
                      // Try searching without city as fallback or handle specific error?
                      // For now, just return null.
                      r(null);
                  }
              });
          });

          // 3. Driving (Taxi/Didi)
          const getDriving = () => new Promise(r => {
              const driving = new AMap.Driving({ 
                  policy: AMap.DrivingPolicy.LEAST_TIME
              }); 
              driving.search(startLngLat, endLngLat, (status, result) => {
                  if (status === 'complete' && result.routes && result.routes.length) {
                       const route = result.routes[0];
                       r({
                           time: Math.round(route.time / 60),
                           distance: route.distance
                       });
                  } else {
                      r(null);
                  }
              });
          });

          try {
              const [walk, transit, drive] = await Promise.all([getWalking(), getTransit(), getDriving()]);
              
              if (!walk && !transit && !drive) {
                  resolve([]);
                  return;
              }

              const options = [];

              // 1. Walking
              // Recommend if < 45 mins (flexible) or < 2.5km
              if (walk && (walk.time <= 45 || walk.distance <= 2500)) {
                  options.push({
                      name: `🚶 步行 ${walk.time}分钟`,
                      desc: `距离: ${walk.distance}米`,
                      time: (walk.time / 60).toFixed(2)
                  });
              }

              // 2. Public Transit
              if (transit) {
                  options.push({
                      name: `🚇 ${transit.name} (${transit.time}分钟)`,
                      desc: ``,
                      time: (transit.time / 60).toFixed(2)
                  });
              }

              // 3. Driving
              if (drive) {
                  options.push({
                      name: `🚗 网约车/出租车 (预估) ${drive.time}分钟`,
                      desc: `距离: ${(drive.distance/1000).toFixed(1)}km`,
                      time: (drive.time / 60).toFixed(2)
                  });
              }

              resolve(options);

          } catch (err) {
              console.error(err);
              resolve([]);
          }
      });
    };

    // Show loading
    const btn = document.querySelector('button[onclick*="confirmTransportPlan"]');
    const originalText = btn ? btn.innerText : "";
    if (btn) btn.innerText = "计算中...";

    const gaps = [];

    // Identify gaps and calculate options
    const processSequence = async (items, dayIdx) => {
        for (let i = 0; i < items.length - 1; i++) {
            const currentId = items[i];
            const nextId = items[i+1];
            const currentItem = wishMap.get(currentId);
            const nextItem = wishMap.get(nextId);
            
            // Check types
            const isLoc = (item) => item && ['food', 'attraction', 'place', 'accommodation', 'stay'].includes(item.type);
            const isTransport = (item) => item && item.type === 'transport';
            
            if (!currentItem || !nextItem) continue;
            
            // If current or next is transport, assume connection exists
            // But if using custom sequence, we might want to ignore existing transport items in the sequence 
            // and just connect the location nodes.
            // If customSequence is passed, it likely only contains location IDs (filtered by user selection).
            // So we can skip this check if customSequence is used? 
            // Actually, if user selects A -> B, and there is already T(ab), do we generate again?
            // User might want to regenerate.
            // Let's stick to: if sequence has A, B. Generate A->B.
            if (isTransport(currentItem) || isTransport(nextItem)) continue;
            
            if (isLoc(currentItem) && isLoc(nextItem)) {
                // Found a gap
                if (currentItem.coords && currentItem.coords.lng && nextItem.coords && nextItem.coords.lng) {
                    try {
                        const results = await calculateTransport(currentItem.coords, nextItem.coords);
                        if (results && results.length > 0) {
                            gaps.push({
                                dayIndex: dayIdx,
                                fromId: currentId,
                                toId: nextId,
                                fromName: currentItem.name,
                                toName: nextItem.name,
                                options: results
                            });
                            // Small delay to be nice to API
                            await new Promise(r => setTimeout(r, 100));
                        }
                    } catch (err) {
                        console.error("Transport calc failed", err);
                    }
                }
            }
        }
    };

    if (customSequence && Array.isArray(customSequence) && customSequence.length > 0) {
        // Use custom sequence for the target day
        await processSequence(customSequence, targetDayIndex !== null ? targetDayIndex : -1);
    } else if (targetDayIndex !== null) {
        // Process specific day
        if (targetDayIndex >= 0 && targetDayIndex < planState.days.length) {
            await processSequence(planState.days[targetDayIndex] || [], targetDayIndex);
        }
    } else {
        // Process all days
        for (let dayIndex = 0; dayIndex < planState.days.length; dayIndex++) {
            await processSequence(planState.days[dayIndex] || [], dayIndex);
        }
    }

    if (gaps.length > 0) {
        showTransportSelectionModal(gaps);
    } else {
        showToast("没有发现需要生成交通的行程间隙或缺少位置信息", "info");
    }
  };

  // Modal Logic
  function showTransportSelectionModal(gaps) {
    // Create Modal HTML
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    
    const header = document.createElement('div');
    header.className = 'modal-header';
    header.innerHTML = `<h3>选择交通方案</h3><button class="modal-close">&times;</button>`;
    
    const body = document.createElement('div');
    body.className = 'modal-body';
    
    gaps.forEach((gap, index) => {
        const gapDiv = document.createElement('div');
        gapDiv.className = 'transport-gap-item';
        
        let optionsHtml = '';
        gap.options.forEach((opt, optIdx) => {
            const isChecked = optIdx === 0 ? 'checked' : '';
            optionsHtml += `
                <label class="transport-option-item">
                    <input type="radio" name="gap_${index}" value="${optIdx}" ${isChecked}>
                    <div class="transport-option-details">
                        <span class="transport-option-name">${opt.name}</span>
                        <span class="transport-option-meta">${opt.desc}</span>
                    </div>
                </label>
            `;
        });
        
        gapDiv.innerHTML = `
            <div class="transport-gap-title">${gap.fromName} &rarr; ${gap.toName}</div>
            <div class="transport-option-list">
                ${optionsHtml}
            </div>
        `;
        body.appendChild(gapDiv);
    });
    
    const footer = document.createElement('div');
    footer.className = 'modal-footer';
    footer.innerHTML = `
        <button class="btn btn-secondary close-btn">取消</button>
        <button class="btn btn-primary confirm-btn">确认生成</button>
    `;
    
    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Animation
    requestAnimationFrame(() => overlay.classList.add('open'));
    
    // Event Listeners
    const close = () => {
        overlay.classList.remove('open');
        setTimeout(() => overlay.remove(), 300);
    };
    
    overlay.querySelector('.modal-close').onclick = close;
    overlay.querySelector('.close-btn').onclick = close;
    
    overlay.querySelector('.confirm-btn').onclick = () => {
        const selections = gaps.map((gap, index) => {
            const selectedIdx = parseInt(body.querySelector(`input[name="gap_${index}"]:checked`).value);
            return {
                gap,
                selectedOption: gap.options[selectedIdx],
                unselectedOptions: gap.options.filter((_, i) => i !== selectedIdx),
                keepOthers: false
            };
        });
        
        applyTransportSelections(selections);
        close();
    };
  }

  async function applyTransportSelections(selections) {
      // Rebuild plan days
      const planState = loadPlanState();
      const wishlist = loadWishlist();
      
      const newDays = [];
      const newItems = [];
      
      // Create a map for quick lookup of selections by "fromId"
      // Assuming one gap per fromId (which is true as gaps are between adjacent items)
      const selectionMap = new Map();
      selections.forEach(sel => {
          selectionMap.set(sel.gap.fromId, sel);
      });

      for (let dayIndex = 0; dayIndex < planState.days.length; dayIndex++) {
          const originalDayItems = planState.days[dayIndex] || [];
          const newDayItems = [];
          
          for (let i = 0; i < originalDayItems.length; i++) {
              const currentId = originalDayItems[i];
              newDayItems.push(currentId);
              
              // If this item is the start of a gap we processed
              if (selectionMap.has(currentId)) {
                  const sel = selectionMap.get(currentId);
                  
                  // Create the selected transport item
                  const res = sel.selectedOption;
                  const newId = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
                  const transportItem = {
                      id: newId,
                      name: res.name, // No scheme label
                      type: 'transport',
                      estimatedCost: "",
                      playTime: "", 
                      location: "",
                      coords: null,
                      desc: res.desc,
                      createdAt: new Date().toISOString(),
                      travelTime: res.time,
                      status: 'planned'
                  };
                  
                  newItems.push(transportItem);
                  newDayItems.push(newId);
                  
                  // keepOthers logic removed
              }
          }
          newDays.push(newDayItems);
      }

      // Save everything
      planState.days = newDays;
      savePlanStateLocal(planState);
      saveWishlistLocal([...wishlist, ...newItems]);
      
      markLocalDirty();
      await syncToCloud();
      
      showToast("交通方案已应用！", "success");
      
      // Refresh views
      if (typeof HKWL !== 'undefined') {
          if (HKWL.refreshBlockView) HKWL.refreshBlockView();
          if (HKWL.refreshMapView) HKWL.refreshMapView();
      }
      
      // Removed reload to avoid full page refresh
      // setTimeout(() => {
      //      window.location.reload();
      // }, 1000);
  }

  async function addItem(item) {
      const list = loadWishlist();
      list.unshift(item);
      saveWishlistLocal(list);
      // Update global list if needed
      if (typeof window.list !== 'undefined') window.list = list;
      
      markLocalDirty();
      await syncToCloud();
      return true;
  }

  async function fetchAndMergeCloudPlans() {
      // If local data was modified recently (e.g. user just left a plan), skip this fetch to prevent race condition
      if (isLocalDirty()) {
          console.log("[Sync] Local plans modified recently. Skipping list refresh.");
          return getPlans();
      }

      const res = await CloudSync.getPlans();
      if (res.error) return getPlans(); // Fallback to local
      
      const cloudPlans = res.plans;
      
      // Double check dirty status AFTER fetch returns, in case user acted while fetch was in flight
      if (isLocalDirty()) {
          console.log("[Sync] Local plans modified during fetch. Discarding stale list.");
          return getPlans();
      }

      // REPLACE strategy: Only keep plans that are in the cloud list
      const localPlans = cloudPlans.map(cp => ({
          id: cp._id,
          title: cp.title,
          cloudId: cp._id,
          isCloud: true,
          owner: cp.owner,
          collaborators: cp.collaborators,
          createdAt: cp.createdAt,
          updatedAt: cp.updatedAt,
          status: cp.status || 'planning'
      }));
      
      // Update local storage to mirror cloud
      const oldJson = window.localStorage.getItem(getPlanIndexKey());
      const newJson = JSON.stringify(localPlans);
      
      if (oldJson !== newJson) {
          window.localStorage.setItem(getPlanIndexKey(), newJson);
          console.log("[Sync] Local plans updated from cloud API. Syncing to Cloud Storage...");
          markLocalDirty();
          // Trigger sync to ensure cloud storage (User Data) matches the API source of truth
          // This prevents "ghost plans" from reappearing via syncFromCloud on next reload
          syncToCloud().catch(e => console.error("Failed to sync updated plans to cloud storage", e));
      }
      
      return localPlans;
  }

  let lockedItemId = null;

  function setLockedItemId(id) {
    lockedItemId = id;
  }

  async function syncCurrentPlanFromCloud(silent = false) {
      if (!currentPlanId) return false;
      
      // Restore isLocalDirty check to prevent race conditions (overwriting local edits with old cloud data)
      if (isLocalDirty()) {
          if (!silent) console.log("[Sync] Local data modified recently. Skipping pull.");
          return false;
      }

      if (isPulling) return false; // Avoid re-entry
      
      isPulling = true;
      try {
          const plans = getPlans();
          let plan = plans.find(p => p.id === currentPlanId);
          
          // Handle case where plan is not in local index yet (e.g. accessing via link as collaborator)
          if (!plan) {
              console.log("[Sync] Plan not found locally, attempting to fetch from cloud...", currentPlanId);
          } else if (!plan.isCloud) {
              return false;
          }
          
          const cloudId = plan ? (plan.cloudId || plan.id) : currentPlanId;

          if (!silent) showToast("正在同步云端数据...", "info");
          const res = await CloudSync.getPlan(cloudId);
          
          let changed = false;

          if (res.success && res.plan) {
              const cp = res.plan;
              
              // If plan was missing locally, add it to index
              if (!plan) {
                  plan = {
                      id: cp._id,
                      title: cp.title,
                      cloudId: cp._id,
                      isCloud: true,
                      owner: cp.owner,
                      collaborators: cp.collaborators,
                      createdAt: cp.createdAt,
                      updatedAt: cp.updatedAt,
                      status: cp.status || 'planning'
                  };
                  plans.unshift(plan);
                  window.localStorage.setItem(getPlanIndexKey(), JSON.stringify(plans));
                  // Note: We don't trigger savePlans() here to avoid immediate push back
                  console.log("[Sync] Added missing plan to local index:", plan);
                  changed = true; // Mark as changed to trigger UI refresh
              } else {
                  // Update existing plan metadata (status, title, etc)
                  let metaChanged = false;
                  const newStatus = cp.status || 'planning';
                  if (plan.status !== newStatus) {
                      plan.status = newStatus;
                      metaChanged = true;
                  }
                  if (plan.title !== cp.title) {
                      plan.title = cp.title;
                      metaChanged = true;
                  }
                  
                  // Update collaborators and owner to ensure share functionality works
                  if (JSON.stringify(plan.collaborators) !== JSON.stringify(cp.collaborators)) {
                      plan.collaborators = cp.collaborators;
                      metaChanged = true;
                  }
                  if (plan.owner !== cp.owner) {
                      plan.owner = cp.owner;
                      metaChanged = true;
                  }
                  
                  if (metaChanged) {
                      window.localStorage.setItem(getPlanIndexKey(), JSON.stringify(plans));
                  }
              }

              const content = cp.content || {};
              
              let mergedItems = [];
              let mergedPlanState = null;
              let needsPushBack = false;

              // 1. Sync Items (Wishlist) with 3-way merge (Base/Mine/Theirs)
              if (content.items && Array.isArray(content.items)) {
                  const localItems = loadWishlist();
                  const cloudItems = content.items;
                  
                  // Load Base snapshot (last known common ancestor)
                  const snapshotKey = Auth.getUserKey(`${currentPlanId}_wishlist_snapshot`);
                  let baseItems = [];
                  try {
                      const rawSnap = localStorage.getItem(snapshotKey);
                      if (rawSnap) baseItems = JSON.parse(rawSnap);
                      else baseItems = cloudItems;
                  } catch(e) {
                      baseItems = cloudItems;
                  }
                  
                  // Merge
                  mergedItems = mergeItems(baseItems, localItems, cloudItems);
                  
                  // Locked item always wins locally
                  if (lockedItemId) {
                      const localLocked = localItems.find(i => i.id === lockedItemId);
                      const mergedIndex = mergedItems.findIndex(i => i.id === lockedItemId);
                      if (localLocked && mergedIndex !== -1) {
                          if (JSON.stringify(mergedItems[mergedIndex]) !== JSON.stringify(localLocked)) {
                              needsPushBack = true;
                              mergedItems[mergedIndex] = localLocked;
                          }
                      }
                  }
                  
                  // Detect changes compared to current local list
                  if (JSON.stringify(localItems) !== JSON.stringify(mergedItems)) {
                      saveWishlistLocal(mergedItems, true); // Force save during pull
                      changed = true;
                  }
                  
                  // Update snapshot to latest cloud state to align future merges
                  try {
                      localStorage.setItem(snapshotKey, JSON.stringify(cloudItems));
                  } catch(e) {}
              } else {
                  mergedItems = loadWishlist(); // Fallback
              }

              // 2. Sync PlanState (Order) with Smart Merge
              if (content.planState) {
                  const currentPlanState = loadPlanState();
                  const cloudPlanState = content.planState;
                  
                  // If we preserved items, we must ensure they are in the planState if they were there locally
                  if (needsPushBack) {
                      mergedPlanState = JSON.parse(JSON.stringify(cloudPlanState)); // Deep copy
                      const cloudAllIds = new Set();
                      if (mergedPlanState.days) {
                          mergedPlanState.days.forEach(day => day.forEach(id => cloudAllIds.add(id)));
                      }
                      
                      // Find preserved items that are NOT in cloud planState
                      // And try to put them back where they were locally
                      const preservedItems = mergedItems.filter(i => !cloudAllIds.has(i.id));
                      
                      if (preservedItems.length > 0) {
                          preservedItems.forEach(pItem => {
                              // Find position in local state
                              const localPos = findPlanItemDay(currentPlanState, pItem.id);
                              if (localPos) {
                                  // Ensure target day exists
                                  if (!mergedPlanState.days) mergedPlanState.days = [];
                                  while (mergedPlanState.days.length <= localPos.day - 1) {
                                      mergedPlanState.days.push([]);
                                  }
                                  // Insert (append for safety, or try to respect index)
                                  const targetDay = mergedPlanState.days[localPos.day - 1];
                                  if (!targetDay.includes(pItem.id)) {
                                      // Simple append to avoid index conflict logic complexity
                                      targetDay.push(pItem.id);
                                  }
                              }
                          });
                      }
                  } else {
                      mergedPlanState = cloudPlanState;
                  }

                  const currentStr = JSON.stringify(currentPlanState);
                  const newStr = JSON.stringify(mergedPlanState);
                  if (currentStr !== newStr) {
                      savePlanStateLocal(mergedPlanState, true); // Force save during pull
                      changed = true;
                  }
              }

              // 3. Metadata Sync
              let metadataChanged = false;
              if (JSON.stringify(plan.collaborators) !== JSON.stringify(cp.collaborators) ||
                  JSON.stringify(plan.owner) !== JSON.stringify(cp.owner)) {
                  plan.collaborators = cp.collaborators;
                  plan.owner = cp.owner;
                  metadataChanged = true;
              }
              
              if (metadataChanged) {
                  savePlans(plans); 
                  changed = true; 
              }
              
              // 4. Push Back if needed (Repair Cloud State)
              if (needsPushBack) {
                  console.log("[Sync] Merged local changes into cloud state, pushing back...");
                  const finalPlanState = mergedPlanState || loadPlanState();
                  const finalItems = mergedItems;
                  
                  // Trigger push without awaiting to avoid blocking UI, 
                  // but ensure we don't trigger infinite loop (isLocalDirty helps, but we just updated local)
                  // We use a specific flag or just rely on the fact that next pull will see consistent data.
                  CloudSync.updatePlan(plan.cloudId || plan.id, plan.title, {
                      planState: finalPlanState,
                      items: finalItems
                  }).catch(e => console.error("PushBack failed", e));
              }

              if (!silent) showToast("同步完成", "success");
          }
          return changed;
      } finally {
          isPulling = false;
      }
  }

  async function ensureCloudPlan() {
      const plans = getPlans();
      const plan = plans.find(p => p.id === currentPlanId);
      if (!plan) throw new Error("Current plan not found");
      
      if (plan.cloudId) return plan.cloudId;
      
      // Upload to cloud
      showToast("正在将计划同步到云端...", "info");
      const planState = loadPlanState();
      const wishlist = loadWishlist();
      
      const content = {
          planState: planState,
          items: wishlist // Sync all items for now
      };
      
      const res = await CloudSync.createPlan(plan.title || "未命名计划", content);
      if (res.error) throw new Error(res.error);
      
      // Update local plan with cloudId
      plan.cloudId = res.plan._id;
      plan.isCloud = true; // Mark as cloud-native
      
      window.localStorage.setItem(getPlanIndexKey(), JSON.stringify(plans));
      return plan.cloudId;
  }

  async function inviteFriend(friendId) {
      try {
          const cloudId = await ensureCloudPlan();
          const res = await CloudSync.inviteFriend(cloudId, friendId);
          if (res.error) {
              // Handle "Already a collaborator" gracefully
              if (res.message === 'Already a collaborator') {
                  showToast("该好友已经是协作者了", "info");
                  return true;
              }
              throw new Error(res.error);
          }
          showToast("邀请发送成功！", "success");
          return true;
      } catch (e) {
          console.error(e);
          showToast("邀请失败: " + e.message, "error");
          return false;
      }
  }

    // --- Automatic Status Logic ---
    function calculatePlanStatus(planState) {
        if (!planState || !planState.titles || planState.titles.length === 0) {
            return 'planning';
        }
        
        // Filter out empty titles or invalid dates
        const validDates = planState.titles.filter(t => /^\d{4}-\d{2}-\d{2}$/.test(t)).sort();
        
        if (validDates.length === 0) {
            return 'planning';
        }
        
        const firstDateStr = validDates[0];
        const lastDateStr = validDates[validDates.length - 1];
        
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        
        const firstDate = new Date(firstDateStr);
        const lastDate = new Date(lastDateStr);
        
        if (now < firstDate) {
            return 'planning';
        } else if (now >= firstDate && now <= lastDate) {
            return 'in_progress';
        } else {
            return 'completed'; 
        }
    }

    // Reminder Check Logic
    function initReminderCheck() {
        if (typeof Notification === 'undefined') return;

        if (Notification.permission !== "granted" && Notification.permission !== "denied") {
            Notification.requestPermission();
        }

        setInterval(() => {
            const list = loadWishlist();
            const now = new Date();
            let changed = false;

            list.forEach(item => {
                if (item.reminders) {
                    item.reminders.forEach(r => {
                        if (!r.done && new Date(r.time) <= now) {
                            // Trigger notification
                            if (Notification.permission === "granted") {
                                new Notification(`提醒: ${item.name}`, { body: r.message });
                            } else {
                                // Fallback to toast if no permission
                                showToast(`提醒: ${item.name} - ${r.message}`, 'info');
                            }
                            r.done = true; // Mark as done to avoid repeat
                            changed = true;
                        }
                    });
                }
            });

            if (changed) {
                saveWishlist(list);
            }
        }, 30000); // Check every 30 seconds
    }
    
    // Start Reminder Check
    if (typeof window !== 'undefined') {
        initReminderCheck();
    }

    return {
    getPlans,
    calculatePlanStatus,
    createPlan,
    renamePlan,
    setCurrentPlan,
    deletePlan,
    leavePlan,
    savePlans,
    renderWishlistPage,
    initManagePage,
    initSettingsPage,
    isLocalDirty, // Expose for UI status
    loadWishlist,
    loadPlanState,
    loadSettings,
    autoGenerateTransports,
    deleteItem: deleteItemData,
    copyItem: copyItemData,
    moveItem: moveItemData,
    navigateEdit: navigateEdit,
    refreshBlockView: () => internalRefresh(),
    addItem,
    showToast,
    savePlanState,
     formatDayTitle,
     inviteFriend,
     fetchAndMergeCloudPlans,
     syncCurrentPlanFromCloud,
     setLockedItemId,
     updatePlanStatus,
     saveWishlist,
     syncToCloud,
     updatePlanTitle: renamePlan,
     getPlan: (id) => getPlans().find(p => p.id === id)
   };
  })();
