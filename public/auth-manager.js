const Auth = (() => {
  const CURRENT_USER_KEY = "hkwl_current_user";

  return {
    register: async (username, password) => {
      if (typeof CloudSync === 'undefined') {
        return { success: false, message: "无法连接到云端服务" };
      }
      try {
        const res = await CloudSync.register(username, password);
        if (res.success) return { success: true, message: "注册成功" };
        return { success: false, message: res.error || "注册失败" };
      } catch (e) {
        console.error("Cloud register failed", e);
        return { success: false, message: "注册请求失败: " + e.message };
      }
    },

    login: async (username, password) => {
      if (typeof CloudSync === 'undefined') {
        return { success: false, message: "无法连接到云端服务" };
      }
      try {
        const res = await CloudSync.login(username, password);
        if (res.success) {
          sessionStorage.setItem(CURRENT_USER_KEY, username);
          if (res.isAdmin) {
             sessionStorage.setItem("hkwl_is_admin", "true");
          } else {
             sessionStorage.removeItem("hkwl_is_admin");
          }
          return { success: true, message: "登录成功" };
        }
        return { success: false, message: res.error || "登录失败" };
      } catch (e) {
        console.error("Cloud login failed", e);
        return { success: false, message: "登录请求失败: " + e.message };
      }
    },

    logout: () => {
      if (typeof CloudSync !== 'undefined') {
          CloudSync.logout();
      }
      sessionStorage.removeItem(CURRENT_USER_KEY);
      sessionStorage.removeItem("hkwl_is_admin");
      window.location.replace("login.html");
    },

    getCurrentUser: () => {
      return sessionStorage.getItem(CURRENT_USER_KEY);
    },

    isLoggedIn: () => {
      return !!sessionStorage.getItem(CURRENT_USER_KEY);
    },

    isAdmin: () => {
      return sessionStorage.getItem("hkwl_is_admin") === "true";
    },

    createAccount: async (username, password) => {
      return Auth.register(username, password);
    },

    changePassword: async (newPassword) => {
      if (typeof CloudSync === 'undefined') {
        return { success: false, message: "无法连接到云端服务" };
      }
      try {
        const res = await CloudSync.changePassword(newPassword);
        if (res.success) return { success: true, message: "密码修改成功" };
        return { success: false, message: res.error || "修改失败" };
      } catch (e) {
        console.error("Change password failed", e);
        return { success: false, message: "请求失败: " + e.message };
      }
    },

    requireLogin: () => {
      if (window.location.pathname.endsWith('login.html')) return;
      if (!sessionStorage.getItem(CURRENT_USER_KEY)) {
        window.location.replace("login.html");
        return;
      }
      // Ensure CloudSync token matches session
      if (typeof CloudSync !== 'undefined' && !CloudSync.isLoggedIn()) {
          console.warn("Session valid but CloudSync token missing. Redirecting to login.");
          sessionStorage.removeItem(CURRENT_USER_KEY);
          sessionStorage.removeItem("hkwl_is_admin");
          window.location.replace("login.html");
      }
    },
    
    getUserKey: (key) => {
      const user = sessionStorage.getItem(CURRENT_USER_KEY);
      if (!user) return key; 
      return `${user}_${key}`;
    },

    refreshAdminStatus: async () => {
      if (typeof CloudSync === 'undefined') return false;
      try {
        const res = await CloudSync.checkStatus();
        if (res.success) {
          if (res.isAdmin) {
             sessionStorage.setItem("hkwl_is_admin", "true");
             return true;
          } else {
             sessionStorage.removeItem("hkwl_is_admin");
             return false;
          }
        }
      } catch (e) {
        console.error("Failed to refresh admin status", e);
      }
      return Auth.isAdmin();
    }
  };
})();

// Prevent back button from accessing protected pages after logout
window.addEventListener('pageshow', (event) => {
  if (event.persisted || (window.performance && window.performance.navigation.type === 2)) {
    Auth.requireLogin();
  }
});
