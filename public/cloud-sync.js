const CloudSync = (() => {
  // Use relative path for Vercel since frontend and backend are on the same domain
  // But if running on Live Server (port 5500/etc), point to localhost:3000
  const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const isBackendPort = window.location.port === '3000';
  const API_URL = (isLocalDev && !isBackendPort) 
    ? "http://localhost:3000/api" 
    : "/api";

  let token = localStorage.getItem("hkwl_auth_token");

  function setToken(t) {
    token = t;
    if (t) localStorage.setItem("hkwl_auth_token", t);
    else localStorage.removeItem("hkwl_auth_token");
  }

  async function request(endpoint, method = "GET", body = null) {
    const headers = {
      "Content-Type": "application/json",
    };
    if (token) headers["Authorization"] = token;

    try {
      const opts = { method, headers };
      if (body) opts.body = JSON.stringify(body);
      
      const url = `${API_URL}${endpoint}`;
      console.log(`[CloudSync] Requesting: ${method} ${url}`);
      
      const res = await fetch(url, opts);
      // Handle network errors or server offline
      if (!res) throw new Error("Network error");
      
      const contentType = res.headers.get("content-type");
      let data;
      if (contentType && contentType.includes("application/json")) {
        data = await res.json();
      } else {
        // Handle non-JSON response (e.g. Vercel error page)
        const text = await res.text();
        console.error("Non-JSON response:", text);
        // Special case: If we get a 404 or 500 html page, treat it as a "server unavailable" signal
        // so auth-manager can fallback to local.
        console.error(`[CloudSync] Server Error (${res.status}) at ${API_URL}${endpoint}:`, text);
        return { error: `Server Error (${res.status}): 请求的接口不存在或服务器错误。` };
      }
      
      if (!res.ok) throw new Error(data.error || "Request failed");
      return data;
    } catch (e) {
      console.error("API Error:", e);
      return { error: e.message };
    }
  }

  return {
    isLoggedIn: () => !!token,
    getToken: () => token,
    
    register: async (username, password) => {
      return await request("/register", "POST", { username, password });
    },

    login: async (username, password) => {
      const res = await request("/login", "POST", { username, password });
      if (res.success && res.token) {
        setToken(res.token);
      }
      return res;
    },

    logout: () => {
      setToken(null);
    },

    // Push local data to server
    pushData: async (dataObject) => {
      if (!token) return { error: "Not logged in" };
      return await request("/data", "POST", { data: dataObject });
    },

    // Pull data from server
    pullData: async () => {
      if (!token) return { error: "Not logged in" };
      return await request("/data", "GET");
    },

    deleteAccount: async () => {
      if (!token) return { error: "Not logged in" };
      return await request("/user", "DELETE");
    }
  };
})();
