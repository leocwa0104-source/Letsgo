const HKWL = (() => {
  // Auth Check
  if (typeof Auth !== 'undefined' && !window.location.pathname.endsWith('login.html')) {
      Auth.requireLogin();
  }

  function getPlanIndexKey() {
      return (typeof Auth !== 'undefined') ? Auth.getUserKey("hkwl_plans_index") : "hkwl_plans_index";
  }

  let currentPlanId = "hk"; // Default to 'hk' for backward compatibility

  function getStorageKey() { return Auth.getUserKey(`${currentPlanId}_wishlist`); }
  function getPlanKey() { return Auth.getUserKey(`${currentPlanId}_wishlist_plan`); }
  function getCollapsedKey() { return Auth.getUserKey(`${currentPlanId}_wishlist_collapsed`); }
  function getSettingsKey() { return Auth.getUserKey(`${currentPlanId}_wishlist_settings`); }

  // Init Header Profile
  document.addEventListener("DOMContentLoaded", () => {
      if (typeof Auth !== 'undefined' && Auth.getCurrentUser()) {
          const header = document.querySelector('.site-header');
          if (header) {
              const userDiv = document.createElement('div');
              userDiv.style.marginLeft = 'auto';
              userDiv.style.display = 'flex';
              userDiv.style.alignItems = 'center';
              userDiv.style.gap = '1rem';
              
              const userName = document.createElement('span');
              userName.textContent = `你好, ${Auth.getCurrentUser()}`;
              userName.style.fontSize = '0.9rem';

              userDiv.appendChild(userName);

              // Only show System Settings button on Index page (Home)
              const path = window.location.pathname;
              if (path.endsWith('index.html') || path === '/' || path.endsWith('/')) {
                  
                  const createIconButton = (svg, title, onClick) => {
                      const btn = document.createElement('button');
                      btn.innerHTML = svg;
                      btn.title = title;
                      btn.style.background = 'rgba(255,255,255,0.2)';
                      btn.style.border = 'none';
                      btn.style.color = 'white';
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
                  userDiv.appendChild(noticeBtn);
                  
                  // Initialize Badge
                  if (typeof Mailbox !== 'undefined') {
                      Mailbox.setBadge(badge);
                  }

                  // Admin Console Button (Only for Admins)
                  const checkAndAddAdminBtn = async () => {
                      let isAdmin = Auth.isAdmin();
                      // Double check if false (might be cache issue)
                      if (!isAdmin) {
                          isAdmin = await Auth.refreshAdminStatus();
                      }
                      
                      if (isAdmin) {
                          const adminBtn = createIconButton(
                              '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
                              '管理员控制台',
                              () => { window.location.href = 'admin.html'; }
                          );
                          adminBtn.style.background = '#0c5da5';
                          adminBtn.style.marginLeft = '0.5rem';
                          
                          // Insert before Settings button if possible, or append
                          if (userDiv.contains(settingsBtn)) {
                              userDiv.insertBefore(adminBtn, settingsBtn);
                          } else {
                              userDiv.appendChild(adminBtn);
                          }
                      }
                  };
                  
                  // System Settings Button
                  const settingsBtn = createIconButton(
                      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
                      '系统设置',
                      () => { window.location.href = 'system-settings.html'; }
                  );
                  userDiv.appendChild(settingsBtn);
                  
                  // Trigger admin check
                  checkAndAddAdminBtn();
              } else if (path.endsWith('planner.html')) {
                  const settingsBtn = document.createElement('button');
                  settingsBtn.textContent = '设置';
                  settingsBtn.style.background = 'rgba(255,255,255,0.2)';
                  settingsBtn.style.border = 'none';
                  settingsBtn.style.color = 'white';
                  settingsBtn.style.padding = '0.3rem 0.8rem';
                  settingsBtn.style.borderRadius = '4px';
                  settingsBtn.style.cursor = 'pointer';
                  settingsBtn.onclick = () => {
                      const urlParams = new URLSearchParams(window.location.search);
                      const pid = urlParams.get('id') || currentPlanId;
                      window.location.href = `settings.html?id=${pid}`;
                  };
                  userDiv.appendChild(settingsBtn);
              }
              
              // Insert before the last child if it's nav-link, or append
              header.appendChild(userDiv);
              
              // Trigger Initial Sync
              syncFromCloud().then(changed => {
                  if (changed) {
                      console.log("Data synced from cloud, reloading...");
                      window.location.reload();
                  }
              });
          }
      }
  });

  function setCurrentPlan(id) {
    if (id) currentPlanId = id;
  }

  // --- Cloud Sync Helpers ---
  let lastLocalWriteTime = 0;
  
  function markLocalDirty() {
      lastLocalWriteTime = Date.now();
      // Also store in sessionStorage to persist across page reloads in the same tab
      try {
          sessionStorage.setItem('hkwl_local_dirty_time', lastLocalWriteTime.toString());
      } catch(e) {}
  }

  function isLocalDirty() {
      // Check memory first
      if (Date.now() - lastLocalWriteTime < 10000) return true; // 10 seconds buffer
      
      // Check session storage
      try {
          const stored = sessionStorage.getItem('hkwl_local_dirty_time');
          if (stored) {
              const t = parseInt(stored, 10);
              if (!isNaN(t) && (Date.now() - t < 10000)) {
                  lastLocalWriteTime = t; // sync back to memory
                  return true;
              }
          }
      } catch(e) {}
      
      return false;
  }

  async function syncToCloud() {
    if (typeof CloudSync === 'undefined' || !CloudSync.isLoggedIn()) return;
    
    markLocalDirty(); // Mark dirty before sync

    const username = Auth.getCurrentUser();
    if (!username) return;
    
    const prefix = `${username}_`;
    const data = {};
    
    // Collect all data for this user
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
            data[key] = localStorage.getItem(key);
        }
    }
    
    // Also sync the plan index if it's user-specific
    const indexKey = getPlanIndexKey();
    if (indexKey.startsWith(prefix)) {
        data[indexKey] = localStorage.getItem(indexKey);
    }
    
    // Return the promise so callers can await if needed
    return CloudSync.pushData(data);
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

    try {
        const res = await CloudSync.pullData();
        if (res.success && res.data) {
            let changed = false;
            for (const [key, value] of Object.entries(res.data)) {
                if (localStorage.getItem(key) !== value) {
                    localStorage.setItem(key, value);
                    changed = true;
                }
            }
            return changed;
        }
    } catch (e) {
        console.error("Sync failed", e);
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
          savePlans(plans);
          return plans;
      }
      
      return JSON.parse(raw);
    } catch (e) {
      console.error("Failed to load plans", e);
      return [];
    }
  }

  function savePlans(plans) {
      try {
          window.localStorage.setItem(getPlanIndexKey(), JSON.stringify(plans));
          markLocalDirty();
          syncToCloud();
      } catch (e) {
          console.error("Failed to save plans", e);
      }
  }

  async function createPlan(title) {
      const plans = getPlans();
      const newId = 'plan_' + Date.now();
      const newPlan = { id: newId, title: title || '新计划', createdAt: Date.now() };
      plans.push(newPlan);
      
      // Save plans locally
      window.localStorage.setItem(getPlanIndexKey(), JSON.stringify(plans));
      markLocalDirty();
      
      // Initialize settings for the new plan
      const settingsKey = Auth.getUserKey(`${newId}_wishlist_settings`);
      window.localStorage.setItem(settingsKey, JSON.stringify({ title: newPlan.title }));
      
      // Sync everything once and await
      await syncToCloud();
      
      return newId;
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

      // 3. Sync
      return await syncToCloud();
  }

  function deletePlan(id) {
      let plans = getPlans();
      const index = plans.findIndex(p => p.id === id);
      if (index !== -1) {
          plans.splice(index, 1);
          savePlans(plans);
          
          // Cleanup storage
          window.localStorage.removeItem(Auth.getUserKey(`${id}_wishlist`));
          window.localStorage.removeItem(Auth.getUserKey(`${id}_wishlist_plan`));
          window.localStorage.removeItem(Auth.getUserKey(`${id}_wishlist_collapsed`));
          window.localStorage.removeItem(Auth.getUserKey(`${id}_wishlist_settings`));
          markLocalDirty();
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

  function saveWishlist(list) {
    try {
      window.localStorage.setItem(getStorageKey(), JSON.stringify(list));
      markLocalDirty();
      syncToCloud();
    } catch (e) {
      console.error("保存旅行清单失败", e);
    }
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

  function savePlanState(state) {
    try {
      const normalized = normalizePlanState(state);
      window.localStorage.setItem(getPlanKey(), JSON.stringify(normalized));
      markLocalDirty();
      syncToCloud();
    } catch (e) {
      console.error("保存计划列表失败", e);
    }
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
    if (settings.title) {
      document.title = settings.title;
      const headerH1 = document.querySelector(".site-header h1");
      if (headerH1) {
        headerH1.textContent = settings.title;
      }
    }
    let list = loadWishlist();
    const listEl = document.getElementById("wish-list");
    const clearBtn = document.getElementById("clear-all");
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

    function formatDayTitle(day) {
      const titles = Array.isArray(planState.titles) ? planState.titles : [];
      const raw =
        day - 1 >= 0 && day - 1 < titles.length ? titles[day - 1] : "";
      if (typeof raw === "string" && raw) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
          const date = new Date(`${raw}T00:00:00`);
          if (!isNaN(date.getTime())) {
            const m = date.getMonth() + 1;
            const d = date.getDate();
            return `${m}月${d}日`;
          }
        }
        return raw;
      }
      return "未设日期";
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

    if (!listEl || !clearBtn) {
      return;
    }

    function getPlanListContent() {
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

    function applyPlanIds(nextIds) {
      currentDay = ensureDayIndex(currentDay);
      planIds = Array.isArray(nextIds) ? nextIds.slice() : [];
      planState.days[currentDay - 1] = planIds;
      planState.currentDay = currentDay;
      savePlanState(planState);
    }

    function renderPlanListFromState(targetContentEl) {
      if (!planListEl) return;
      const contentEl = targetContentEl || getPlanListContent();
      contentEl.innerHTML = "";
      const itemMap = new Map(list.map(item => [item.id, item]));
      
      planIds.forEach((id) => {
        const item = itemMap.get(id);
        if (item) {
          const el = renderPlanItem(item);
          contentEl.appendChild(el);
        }
      });
    }

    function switchDay(newDay) {
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
        const titleText = formatDayTitle(day);
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

    if (addNoteBtn && listEl) {
      addNoteBtn.addEventListener("click", () => {
        const note = createWish({
          type: "note",
          name: "批注",
          rating: 0,
          keywords: [],
        });
        list.unshift(note);
        saveWishlist(list);
        const el = createCardDom(note);
        if (listEl.firstChild) {
          listEl.insertBefore(el, listEl.firstChild);
        } else {
          listEl.appendChild(el);
        }
      });
    }

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
      const currentList = loadWishlist();
      const nextList = currentList.filter((x) => x.id !== itemId);
      saveWishlist(nextList);
      list = nextList;
      if (!Array.isArray(planState.days)) {
        planState.days = [[]];
      }
      planState.days = planState.days.map((dayIds) =>
        Array.isArray(dayIds) ? dayIds.filter((id) => id !== itemId) : []
      );
      if (planState.days.length === 0) {
        planState.days = [[]];
      }
      currentDay = ensureDayIndex(currentDay);
      planIds = planState.days[currentDay - 1] || [];
      planState.currentDay = currentDay;
      savePlanState(planState);
      removeItemDom(itemId);
    }

    function handleCopy(itemId) {
      const currentList = loadWishlist();
      const index = currentList.findIndex((x) => x.id === itemId);
      if (index === -1) return;

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
      saveWishlist(currentList);
      list = currentList;

      const position = findPlanItemDay(planState, itemId);

      if (newItem.type !== "note") {
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
        currentDay = ensureDayIndex(currentDay);
        planIds = planState.days[currentDay - 1] || [];
        planState.currentDay = currentDay;
        savePlanState(planState);

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

    function navigateEdit(id) {
    window.location.href = `manage.html?id=${encodeURIComponent(id)}&planId=${encodeURIComponent(currentPlanId)}`;
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

      div.appendChild(header);

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

      if (item.type === "food" || item.type === "place") {
        if (item.rating > 0) {
          const rating = document.createElement("p");
          rating.textContent = `星级：${"★".repeat(item.rating)}${"☆".repeat(
            5 - item.rating
          )} (${item.rating}/5)`;
          details.appendChild(rating);
        }
      }

      if (item.type === "food") {
        if (item.mealType) {
          const meal = document.createElement("p");
          meal.textContent = `餐别：${item.mealType}`;
          details.appendChild(meal);
        }

        if (item.cuisine) {
          const cuisine = document.createElement("p");
          cuisine.textContent = `菜系：${item.cuisine}`;
          details.appendChild(cuisine);
        }

        if (item.location) {
          const location = document.createElement("p");
          location.textContent = `地点：${item.location}`;
          details.appendChild(location);
        }
      } else if (item.type === "place") {
        const timeValue = item.playTime;
        if (timeValue) {
          const playTime = document.createElement("p");
          let timeText = timeValue;
          if (
            typeof timeValue === "string" &&
            /^\d+(\.\d+)?$/.test(timeValue)
          ) {
            timeText = `${timeValue}h`;
          }
          playTime.textContent = `游玩时间：${timeText}`;
          details.appendChild(playTime);
        }

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

      if (item.estimatedCost && item.estimatedCost.trim().length > 0) {
        const cost = document.createElement("p");
        cost.textContent = `预计费用：${item.estimatedCost}`;
        details.appendChild(cost);
      }

      if (item.desc && item.desc.trim().length > 0) {
        const descP = document.createElement("p");
        descP.style.whiteSpace = "pre-wrap";
        descP.style.fontSize = "0.9em";
        descP.style.color = "#666";
        descP.style.marginTop = "4px";
        descP.textContent = item.desc;
        details.appendChild(descP);
      }

      if (item.type !== "transport" && item.keywords && item.keywords.length > 0) {
        const keywords = document.createElement("p");
        keywords.textContent = `关键词：${item.keywords.join("，")}`;
        details.appendChild(keywords);
      }

      const actions = document.createElement("div");
      actions.className = "card-actions";

      if (item.type !== "note") {
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
      }

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

      div.appendChild(details);
      div.appendChild(actions);

      return div;
    }

    function renderCard(container, item) {
      const el = createCardDom(item);
      container.appendChild(el);
    }

    function renderPlanItem(item) {
      const el = createCardDom(item);
      el.classList.add("plan-item");
      return el;
    }

    listEl.innerHTML = "";
    if (planListEl) {
      planListEl.innerHTML = "";
    }

    const allPlanIds = getAllPlanIds();
    const allPlanIdSet = new Set(allPlanIds);

    // 1. Render Plan List (respecting order in planIds)
    if (planListEl) {
        const itemMap = new Map(list.map(item => [item.id, item]));
        planIds.forEach(id => {
            const item = itemMap.get(id);
            if (item) {
                const el = renderPlanItem(item);
                getPlanListContent().appendChild(el);
            }
        });
    }

    // 2. Render Wishlist (remaining items, respecting list order)
    list.forEach((item) => {
      if (!allPlanIdSet.has(item.id)) {
        renderCard(listEl, item);
      }
    });

    function updateWishlistEmptyState() {
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

    updateWishlistEmptyState();

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

    function reorderWishlist(newMainIds) {
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

      saveWishlist(fullList);
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

    function handlePlanReorderHover(target, clientY) {
      if (!planListEl) return;
      if (!dragState) return;
      if (dragState.from !== "plan") return;
      const draggingEl = dragState.sourceEl;
      if (!draggingEl) return;
      if (!planListEl.contains(draggingEl)) return;

      const targetItem =
        target && target.closest ? target.closest(".plan-item") : null;
      if (!targetItem || targetItem === draggingEl) {
        return;
      }

      const items = Array.from(planListEl.querySelectorAll(".plan-item"));
      const prevRects = new Map();
      items.forEach((el) => {
        prevRects.set(el.dataset.id, el.getBoundingClientRect());
      });

      const rect = targetItem.getBoundingClientRect();
      const offset = clientY - rect.top;
      const shouldInsertBefore = offset < rect.height / 2;

      if (shouldInsertBefore) {
        targetItem.parentElement.insertBefore(draggingEl, targetItem);
      } else {
        targetItem.parentElement.insertBefore(draggingEl, targetItem.nextSibling);
      }

      const newItems = Array.from(planListEl.querySelectorAll(".plan-item"));
      newItems.forEach((el) => {
        if (el === draggingEl) {
          return;
        }
        const id = el.dataset.id;
        const prev = prevRects.get(id);
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

    function handleMainReorderHover(target, clientX) {
      if (!listEl) return;
      if (!dragState) return;
      if (dragState.from !== "main") return;
      const draggingEl = dragState.sourceEl;
      if (!draggingEl) return;
      if (!listEl.contains(draggingEl)) return;

      const targetItem =
        target && target.closest ? target.closest(".card") : null;
      if (!targetItem || targetItem === draggingEl) {
        return;
      }
      if (!listEl.contains(targetItem)) return;

      const items = Array.from(listEl.querySelectorAll(".card"));
      const prevRects = new Map();
      items.forEach((el) => {
        prevRects.set(el.dataset.id, el.getBoundingClientRect());
      });

      const rect = targetItem.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const shouldInsertBefore = clientX < centerX;

      if (shouldInsertBefore) {
        listEl.insertBefore(draggingEl, targetItem);
      } else {
        listEl.insertBefore(draggingEl, targetItem.nextSibling);
      }

      const newItems = Array.from(listEl.querySelectorAll(".card"));
      newItems.forEach((el) => {
        if (el === draggingEl) {
          return;
        }
        const id = el.dataset.id;
        const prev = prevRects.get(id);
        if (!prev) return;
        const newRect = el.getBoundingClientRect();
        const dx = prev.left - newRect.left;
        const dy = prev.top - newRect.top;
        if (!dx && !dy) return;
        el.style.transition = "none";
        el.style.transform = `translate(${dx}px, ${dy}px)`;
        el.getBoundingClientRect();
        el.style.transition = "";
        el.style.transform = "";
      });
    }

    function updateDragPosition(e) {
      if (!dragState) return;
      if (e.pointerId !== dragState.pointerId) return;
      const dragEl = dragState.dragEl;
      if (!dragEl) return;
      dragState.lastClientX = e.clientX;
      dragState.lastClientY = e.clientY;
      // Because we use translate(-50%, -50%) in CSS, setting left/top to clientX/clientY
      // automatically centers the element on the cursor.
      dragEl.style.left = e.clientX + "px";
      dragEl.style.top = e.clientY + "px";

      const mainDropTarget = mainColumnEl || listEl;
      let over = null;
      let hoveredDay = null;
      if (planListEl) {
        const rect = planListEl.getBoundingClientRect();
        if (
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom
        ) {
          over = "plan";
        }
      }
      if (planDaysEl) {
        const dayButtons = Array.from(
          planDaysEl.querySelectorAll(".plan-day-btn")
        );
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
              // If hovering a day tab, treat it as hovering the plan list to allow dropping
              over = "plan";
            }
            break;
          }
        }
      }
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
        planDaysEl &&
        planListEl
      ) {
        currentDay = ensureDayIndex(hoveredDay);
        planIds = planState.days[currentDay - 1] || [];
        planState.currentDay = currentDay;
        savePlanState(planState);
        // Update active class without re-rendering DOM to preserve dblclick event
        const allBtns = planDaysEl.querySelectorAll(".plan-day-btn");
        allBtns.forEach((b) => {
          if (b.dataset.dayIndex === String(currentDay)) {
            b.classList.add("active");
          } else {
            b.classList.remove("active");
          }
        });
        renderPlanListFromState();

        // Restore dragged element to DOM if it was lost during re-render (when dragging from plan to plan)
        if (dragState.from === "plan" && dragState.sourceEl) {
          if (!planListEl.contains(dragState.sourceEl)) {
            getPlanListContent().appendChild(dragState.sourceEl);
          }
        }
      }

      if (dragState.from === "plan" && dragState.sourceEl) {
        if (over === "plan") {
          dragState.sourceEl.classList.remove("drag-origin-collapsed");
        } else {
          dragState.sourceEl.classList.add("drag-origin-collapsed");
        }
      }

      dragState.overList = over;

      if (over === "plan" && planListEl) {
        handlePlanReorderHover(e.target, e.clientY);
      } else if (over === "main" && listEl) {
        handleMainReorderHover(e.target, e.clientX);
      }
    }

    function endDrag(e) {
      if (!dragState) return;
      if (e.pointerId !== dragState.pointerId) return;

      const id = dragState.id;
      const from = dragState.from;
      const over = dragState.overList;
      const sourceEl = dragState.sourceEl;
      const dragEl = dragState.dragEl;

      window.removeEventListener("pointermove", updateDragPosition);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
      document.body.style.userSelect = "";

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
            savePlanState(planState);
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

    function startDrag(e, from, sourceEl) {
      if (!sourceEl) return;

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

      dragState = {
        id: sourceEl.dataset.id || "",
        from,
        sourceEl,
        dragEl,
        offsetX: 0, // Using translate(-50%, -50%) in CSS, so offsetX is handled there relative to cursor
        offsetY: 0,
        pointerId: e.pointerId,
        overList: null,
        lastClientX: e.clientX,
        lastClientY: e.clientY,
      };

      document.body.style.userSelect = "none";

      window.addEventListener("pointermove", updateDragPosition);
      window.addEventListener("pointerup", endDrag);
      window.addEventListener("pointercancel", endDrag);
    }

    function handlePointerDown(e) {
      if (e.button !== 0) return;
      if (dragState) return;
      const target = e.target;
      if (!target) return;
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

      e.preventDefault();
      startDrag(e, from, sourceEl);
    }

    listEl.addEventListener("pointerdown", handlePointerDown);
    if (planListEl) {
      planListEl.addEventListener("pointerdown", handlePointerDown);
    }

    clearBtn.addEventListener("click", () => {
      if (window.confirm("确定要清空本地的全部旅行项目吗？该操作不可恢复。")) {
        saveWishlist([]);
        planState = createEmptyPlanState();
        currentDay = planState.currentDay;
        planIds = planState.days[currentDay - 1] || [];
        savePlanState(planState);
        listEl.innerHTML = "";
        if (planListEl) {
          planListEl.innerHTML = "";
        }
        if (planDaysEl) {
          renderPlanDayTabs();
        }
      }
    });
  }

  function initManagePage() {
    const form = document.getElementById("wish-form");
    const foodFields = document.getElementById("food-fields");
    const placeFields = document.getElementById("place-fields");
    const transportFields = document.getElementById("transport-fields");
    const stayFields = document.getElementById("stay-fields");

    const ratingContainer = document.getElementById("rating-container");
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
    const ratingInputs = form.elements["rating"];
    const submitBtn = document.getElementById("submit-btn");
    const cancelLink = document.getElementById("cancel-link");

    const params = new URLSearchParams(window.location.search);
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

      if (ratingContainer) {
        ratingContainer.hidden = isTransport || isStay;
      }
      if (ratingInputs && ratingInputs.length) {
        const enableRating = isFood || isPlace;
        Array.from(ratingInputs).forEach((input) => {
          input.required = enableRating;
          input.disabled = !enableRating;
        });
      }
      if (keywordsContainer) {
        keywordsContainer.hidden = isTransport;
      }
      if (mapSectionContainer) {
        mapSectionContainer.hidden = isTransport;
      }
      if (nameLabel) {
        nameLabel.textContent = isTransport ? "交通方式 *" : "名称 *";
      }

      form.mealType.required = false;
      form.cuisine.required = false;
      form.location.required = false;

      form.playTime.required = false;
      form.placeLocation.required = false;
      if (form.stayLocation) form.stayLocation.required = false;

      if (form.travelTimeH) form.travelTimeH.required = false;
      if (form.travelTimeM) form.travelTimeM.required = false;

      if (isFood) {
        // form.mealType.required = true; // Meal type is now optional
        // form.cuisine.required = true; // Cuisine is now optional
        form.location.required = true;
      } else if (isPlace) {
        form.playTime.required = true;
        form.placeLocation.required = true;
      } else if (isTransport) {
        if (form.travelTimeH) form.travelTimeH.required = true;
        if (form.travelTimeM) form.travelTimeM.required = true;
      } else if (isStay) {
        if (form.stayLocation) form.stayLocation.required = true;
      }
    }

    if (playTimeInput) {
      playTimeInput.addEventListener("input", () => {
        let value = playTimeInput.value;
        value = value.replace(/[^0-9.]/g, "");
        const firstDotIndex = value.indexOf(".");
        if (firstDotIndex !== -1) {
          const before = value.slice(0, firstDotIndex + 1);
          const after = value.slice(firstDotIndex + 1).replace(/\./g, "");
          value = before + after;
        }
        playTimeInput.value = value;
      });
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

      const ratingValue = String(editingItem.rating);
      Array.from(ratingInputs).forEach((input) => {
        if (input.value === ratingValue) {
          input.checked = true;
        }
      });

      if (keywordsInputEl && editingItem.keywords && editingItem.keywords.length) {
        keywordsInputEl.value = editingItem.keywords.join("，");
      }

      if (editingItem.type === "food") {
        if (form.mealType) {
          form.mealType.value = editingItem.mealType || "";
        }
        if (form.cuisine) {
          form.cuisine.value = editingItem.cuisine || "";
        }
        if (form.location) {
          form.location.value = editingItem.location || "";
        }
        if (foodCostInput) {
          let val = editingItem.estimatedCost || "";
          val = val.replace(/(\s*人民币|\s*港币)$/, "");
          foodCostInput.value = val;
        }
      } else if (editingItem.type === "place") {
        if (form.playTime) {
          form.playTime.value = editingItem.playTime || "";
        }
        if (form.placeLocation) {
          form.placeLocation.value = editingItem.location || "";
        }
        if (placeCostInput) {
          let val = editingItem.estimatedCost || "";
          val = val.replace(/(\s*人民币|\s*港币)$/, "");
          placeCostInput.value = val;
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
        if (transportCostInput) {
          let val = editingItem.estimatedCost || "";
          val = val.replace(/(\s*人民币|\s*港币)$/, "");
          transportCostInput.value = val;
        }
      } else if (editingItem.type === "stay") {
        if (stayLocationInput) {
          stayLocationInput.value = editingItem.location || "";
        }
        if (stayCostInput) {
          let val = editingItem.estimatedCost || "";
          val = val.replace(/(\s*人民币|\s*港币)$/, "");
          stayCostInput.value = val;
        }
      }

      if (submitBtn) {
        submitBtn.textContent = "保存编辑";
      }
      if (cancelLink) {
        cancelLink.textContent = "取消编辑";
      }
    } else {
      updateFieldVisibility();
    }

    form.addEventListener("submit", (e) => {
      e.preventDefault();

      const formData = new FormData(form);
      const type = currentType;
      const name = formData.get("name")?.toString().trim();
      const ratingRaw = formData.get("rating");
      const rating = Number(ratingRaw);

      if (!name) {
        showToast("请填写名称", "error");
        return;
      }

      if (type === "food" || type === "place") {
        if (!Number.isInteger(rating) || rating < 0 || rating > 5) {
          showToast("星级必须是 0-5 的整数", "error");
          return;
        }
      }

      const keywordsInput = formData.get("keywords")?.toString() || "";
      const keywords = parseKeywords(keywordsInput);

      let ratingValue = 0;
      if (type === "food" || type === "place") {
        ratingValue = rating;
      }

      let wishBase = {
        type,
        name,
        rating: ratingValue,
        keywords: type === "transport" ? [] : keywords,
      };

      // Extract coordinates
      const lng = formData.get("lng");
      const lat = formData.get("lat");
      if (lng && lat) {
          wishBase.coords = { lng: parseFloat(lng), lat: parseFloat(lat) };
      }

      if (type === "food") {
        const mealTypeRaw = formData.get("mealType");
        const cuisineRaw = formData.get("cuisine");
        const locationRaw = formData.get("location");
        const estimatedCostRaw = formData.get("foodCost");

        const mealType = mealTypeRaw ? mealTypeRaw.toString().trim() : "";
        const cuisine = cuisineRaw ? cuisineRaw.toString().trim() : "";
        const location = locationRaw ? locationRaw.toString().trim() : "";
        
        let estimatedCost = estimatedCostRaw ? estimatedCostRaw.toString().trim() : "";
        if (estimatedCost && /^\d+(\.\d+)?$/.test(estimatedCost)) {
           estimatedCost += " 人民币";
        }

        wishBase = {
          ...wishBase,
          mealType,
          cuisine,
          location,
          estimatedCost,
        };
      } else if (type === "place") {
        const playTimeRaw = formData.get("playTime");
        const placeLocationRaw = formData.get("placeLocation");
        const estimatedCostRaw = formData.get("placeCost");

        const playTime = playTimeRaw ? playTimeRaw.toString().trim() : "";
        const placeLocation = placeLocationRaw
          ? placeLocationRaw.toString().trim()
          : "";
        
        let estimatedCost = estimatedCostRaw ? estimatedCostRaw.toString().trim() : "";
        if (estimatedCost && /^\d+(\.\d+)?$/.test(estimatedCost)) {
           estimatedCost += " 人民币";
        }

        if (playTime && !/^\d+(\.\d+)?$/.test(playTime)) {
          showToast("游玩时间只能填写阿拉伯数字（可含小数）小时", "error");
          return;
        }

        wishBase = {
          ...wishBase,
          playTime,
          location: placeLocation,
          estimatedCost,
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
        const stayCostRaw = formData.get("stayCost");

        const stayLocation = stayLocationRaw ? stayLocationRaw.toString().trim() : "";
        let estimatedCost = stayCostRaw ? stayCostRaw.toString().trim() : "";
        if (estimatedCost && /^\d+(\.\d+)?$/.test(estimatedCost)) {
          estimatedCost += " 人民币";
        }

        wishBase = {
          ...wishBase,
          location: stayLocation,
          estimatedCost,
        };
      } else {
        showToast("未知的愿望类型", "error");
        return;
      }

      const list = loadWishlist();
      if (editingItem) {
        const nextList = list.map((item) =>
          item.id === editingItem.id ? { ...item, ...wishBase } : item
        );
        saveWishlist(nextList);
      } else {
        const wish = createWish(wishBase);
        list.unshift(wish);
        saveWishlist(list);
      }

      showToast("已保存旅行项目！", "success");
      
      if (editingItem) {
        setTimeout(() => {
          window.location.href = `planner.html?id=${currentPlanId}`;
        }, 1000);
      } else {
        form.reset();
        updateFieldVisibility();
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
            city: "香港",
            input: "map-search",
            output: "map-search-result" // A hidden or visible container for results if needed, but 'input' should suffice for standard behavior
          });

          const placeSearch = new AMap.PlaceSearch({
            city: "香港",
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

  async function autoGenerateTransports() {
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
                  nightflag: true // Include night buses if applicable
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
    const btn = document.querySelector('button[onclick*="autoGenerateTransports"]');
    const originalText = btn ? btn.innerText : "";
    if (btn) btn.innerText = "计算中...";

    const gaps = [];

    // Identify gaps and calculate options
    for (let dayIndex = 0; dayIndex < planState.days.length; dayIndex++) {
        const dayItems = planState.days[dayIndex] || [];
        
        for (let i = 0; i < dayItems.length - 1; i++) {
            const currentId = dayItems[i];
            const nextId = dayItems[i+1];
            const currentItem = wishMap.get(currentId);
            const nextItem = wishMap.get(nextId);
            
            // Check types
            const isLoc = (item) => item && ['food', 'attraction', 'place', 'accommodation', 'stay'].includes(item.type);
            const isTransport = (item) => item && item.type === 'transport';
            
            if (!currentItem || !nextItem) continue;
            
            // If current or next is transport, assume connection exists
            if (isTransport(currentItem) || isTransport(nextItem)) continue;
            
            if (isLoc(currentItem) && isLoc(nextItem)) {
                // Found a gap
                if (currentItem.coords && currentItem.coords.lng && nextItem.coords && nextItem.coords.lng) {
                    try {
                        const results = await calculateTransport(currentItem.coords, nextItem.coords);
                        if (results && results.length > 0) {
                            gaps.push({
                                dayIndex,
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
    }

    if (btn) btn.innerText = originalText;

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
            <div class="transport-gap-actions">
                <label class="checkbox-label">
                    <input type="checkbox" name="keep_others_${index}">
                    将未选中的方案保存到任务栏
                </label>
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
            const keepOthers = body.querySelector(`input[name="keep_others_${index}"]`).checked;
            return {
                gap,
                selectedOption: gap.options[selectedIdx],
                unselectedOptions: gap.options.filter((_, i) => i !== selectedIdx),
                keepOthers
            };
        });
        
        applyTransportSelections(selections);
        close();
    };
  }

  function applyTransportSelections(selections) {
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
                  
                  // Handle unselected options
                  if (sel.keepOthers && sel.unselectedOptions.length > 0) {
                      sel.unselectedOptions.forEach(opt => {
                          const otherId = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
                          const otherItem = {
                              id: otherId,
                              name: opt.name,
                              type: 'transport',
                              estimatedCost: "",
                              playTime: "", 
                              location: "",
                              coords: null,
                              desc: opt.desc,
                              createdAt: new Date().toISOString(),
                              travelTime: opt.time,
                              status: 'pending' // Pending means in wishlist/taskbar
                          };
                          newItems.push(otherItem);
                          // Do NOT add to newDayItems
                      });
                  }
              }
          }
          newDays.push(newDayItems);
      }

      // Save everything
      planState.days = newDays;
      savePlanState(planState);
      saveWishlist([...wishlist, ...newItems]);
      
      showToast("交通方案已应用！", "success");
      setTimeout(() => {
           window.location.reload();
      }, 1000);
  }

  return {
    getPlans,
    createPlan,
    renamePlan,
    setCurrentPlan,
    deletePlan,
    savePlans,
    renderWishlistPage,
    initManagePage,
    initSettingsPage,
    loadWishlist,
    loadPlanState,
    loadSettings,
    autoGenerateTransports,
  };
})();
