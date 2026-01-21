const Auth = (() => {
  const USERS_KEY = "hkwl_users";
  const CURRENT_USER_KEY = "hkwl_current_user";

  // Helper for local fallback
  function getUsers() {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : {};
  }
  function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  return {
    // Make these async to support cloud sync
    register: async (username, password) => {
      // 1. Try Cloud
      if (typeof CloudSync !== 'undefined') {
          try {
              const res = await CloudSync.register(username, password);
              if (res.success) return { success: true, message: "注册成功" };
              // If cloud fails but it's not a network error (e.g. taken), return error
              if (res.error && res.error !== "Network error" && !res.error.includes("fetch")) {
                  return { success: false, message: res.error };
              }
          } catch (e) {
              console.warn("Cloud register failed, falling back to local", e);
          }
      }

      // 2. Fallback to Local
      const users = getUsers();
      if (users[username]) {
        return { success: false, message: "用户名已存在 (本地)" };
      }
      users[username] = {
        password: btoa(password),
        createdAt: Date.now()
      };
      saveUsers(users);
      return { success: true, message: "注册成功 (本地模式)" };
    },

    login: async (username, password) => {
      // 1. Try Cloud
      if (typeof CloudSync !== 'undefined') {
          try {
              const res = await CloudSync.login(username, password);
              if (res.success) {
                  sessionStorage.setItem(CURRENT_USER_KEY, username);
                  // Trigger data sync after login? We'll handle that in main.js
                  return { success: true, message: "登录成功" };
              }
               // If explicit error (wrong password), return it
               if (res.error && !res.error.includes("fetch") && !res.error.includes("Network")) {
                  return { success: false, message: res.error };
              }
          } catch (e) {
              console.warn("Cloud login failed, falling back to local", e);
          }
      }

      // 2. Fallback to Local
      const users = getUsers();
      const user = users[username];
      if (user && user.password === btoa(password)) {
        sessionStorage.setItem(CURRENT_USER_KEY, username);
        return { success: true, message: "登录成功 (离线模式)" };
      }
      return { success: false, message: "用户名或密码错误" };
    },

    logout: () => {
      if (typeof CloudSync !== 'undefined') {
          CloudSync.logout();
      }
      sessionStorage.removeItem(CURRENT_USER_KEY);
      window.location.href = "login.html";
    },

    getCurrentUser: () => {
      return sessionStorage.getItem(CURRENT_USER_KEY);
    },

    requireLogin: () => {
      if (!sessionStorage.getItem(CURRENT_USER_KEY)) {
        window.location.href = "login.html";
      }
    },
    
    getUserKey: (key) => {
      const user = sessionStorage.getItem(CURRENT_USER_KEY);
      if (!user) return key; 
      return `${user}_${key}`;
    },

    deleteAccount: async () => {
      const username = sessionStorage.getItem(CURRENT_USER_KEY);
      if (!username) return;

      // TODO: Implement cloud delete
      
      // Local delete
      const users = getUsers();
      if (users[username]) {
        delete users[username];
        saveUsers(users);
      }

      const keysToRemove = [];
      const prefix = `${username}_`;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));

      sessionStorage.removeItem(CURRENT_USER_KEY);
      window.location.href = "login.html";
    }
  };
})();
