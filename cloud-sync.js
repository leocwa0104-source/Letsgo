const CloudSync = (() => {
  // Use localhost for dev, but we need a way to switch for prod.
  const PROD_API_URL = "https://YOUR-RENDER-APP-URL.onrender.com/api"; // Replace this after deploying backend
  
  const API_URL = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? "http://localhost:3000/api"
    : PROD_API_URL;

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
      
      const res = await fetch(`${API_URL}${endpoint}`, opts);
      // Handle network errors or server offline
      if (!res) throw new Error("Network error");
      
      const data = await res.json();
      
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
    }
  };
})();
