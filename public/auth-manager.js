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

      if (typeof CloudSync === 'undefined') {
        alert("无法连接到云端服务，无法注销账户");
        return;
      }

      if (!confirm("确定要注销当前账户吗？此操作不可逆，云端及本地数据将被永久删除。")) {
        return;
      }

      try {
        const res = await CloudSync.deleteAccount();
        if (!res.success) {
          alert("注销失败: " + (res.error || "未知错误"));
          return;
        }
      } catch (e) {
        alert("注销请求失败: " + e.message);
        return;
      }

      // Cleanup Local Storage Cache
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
