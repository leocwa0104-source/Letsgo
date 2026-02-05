const CloudSync = (() => {
  // Use relative path for Vercel since frontend and backend are on the same domain
  // But if running on Live Server (port 5500/etc), point to localhost:3000 or IP:3000
  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  // Check for local network IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
  const isLocalIP = /^192\.168\.|^10\.|^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname);
  
  const isBackendPort = window.location.port === '3000';
  
  // If we are on localhost or a local IP, and NOT on port 3000, 
  // we assume the backend is running on port 3000 on the same host.
  const API_URL = ((isLocalhost || isLocalIP) && !isBackendPort) 
    ? `http://${hostname}:3000/api` 
    : "/api";

  let token = sessionStorage.getItem("hkwl_auth_token");

  // Immediate cleanup of invalid tokens on module load to prevent issues
  if (token && /[^\x00-\x7F]/.test(token)) {
      console.warn("[CloudSync] Invalid token detected on load, clearing.");
      sessionStorage.removeItem("hkwl_auth_token");
      token = null;
  }

  function setToken(t) {
    token = t;
    if (t) sessionStorage.setItem("hkwl_auth_token", t);
    else sessionStorage.removeItem("hkwl_auth_token");
  }

  async function request(endpoint, method = "GET", body = null) {
    const headers = {
      "Content-Type": "application/json",
    };
    if (token) {
      // Check for non-ASCII characters in token which cause fetch to fail
      // This happens if user has an old token with Chinese characters
      if (/[^\x00-\x7F]/.test(token)) {
        console.warn("[CloudSync] Detected invalid characters in token, clearing session.");
        setToken(null);
        // Do not add header, let it fail with 401 or handle as guest
      } else {
        headers["Authorization"] = token;
      }
    }

    try {
      const fullUrl = `${API_URL}${endpoint}`;
      console.log(`[CloudSync] Requesting: ${method} ${fullUrl}`);
      
      const opts = { method, headers };
      
      // Final safety check: remove any headers with invalid characters to prevent fetch crash
      Object.keys(headers).forEach(key => {
        const val = headers[key];
        if (/[^\x00-\x7F]/.test(key) || (typeof val === 'string' && /[^\x00-\x7F]/.test(val))) {
           console.error(`[CloudSync] Removed invalid header: ${key}`);
           delete headers[key];
        }
      });

      if (body) opts.body = JSON.stringify(body);
      
      const res = await fetch(fullUrl, opts);
      
      // Handle 401 Unauthorized (Token invalid or User deleted)
      if (res.status === 401) {
          console.warn("[CloudSync] 401 Unauthorized received. Logging out.");
          setToken(null);
          sessionStorage.clear(); // Clear all session data
          window.location.replace("login.html");
          return { error: "Authentication failed. Please login again." };
      }

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
        return { error: `Server Error (${res.status}): The server returned an invalid response.` };
      }
      
      if (!res.ok) throw new Error(data.error || "Request failed");
      return data;
    } catch (e) {
      console.error("API Error:", e);
      return { error: e.message };
    }
  }

  return {
    request, // Expose request for custom modules like market-app.js
    isLoggedIn: () => !!token,
    getToken: () => token,
    
    register: async (username, password) => {
      return await request("/register", "POST", { username, password });
    },

    changePassword: async (newPassword) => {
      return await request("/change-password", "POST", { newPassword });
    },

    updateProfile: async (nickname, avatar) => {
      return await request("/update-profile", "POST", { nickname, avatar });
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
      return await request(`/data?t=${Date.now()}`, "GET");
    },

    // Check auth status
    checkStatus: async () => {
      if (!token) return { success: false, error: "Not logged in" };
      return await request("/auth/status", "GET");
    },

    // --- Plan Collaboration APIs ---
    
    getPlans: async () => {
      if (!token) return { error: "Not logged in" };
      return await request(`/plans?t=${Date.now()}`, "GET");
    },
    
    createPlan: async (title, content, status) => {
      if (!token) return { error: "Not logged in" };
      return await request("/plans", "POST", { title, content, status });
    },
    
    getPlan: async (id) => {
      if (!token) return { error: "Not logged in" };
      return await request(`/plans/${id}?t=${Date.now()}`, "GET");
    },
    
    updatePlan: async (id, title, content, status) => {
      if (!token) return { error: "Not logged in" };
      return await request(`/plans/${id}`, "PUT", { title, content, status });
    },
    
    inviteFriend: async (planId, friendId) => {
      if (!token) return { error: "Not logged in" };
      return await request(`/plans/${planId}/invite`, "POST", { friendId });
    },

    approveInvitation: async (planId, inviteeId) => {
      if (!token) return { error: "Not logged in" };
      return await request(`/plans/${planId}/invitations/approve`, "POST", { inviteeId });
    },

    rejectInvitation: async (planId, inviteeId) => {
      if (!token) return { error: "Not logged in" };
      return await request(`/plans/${planId}/invitations/reject`, "POST", { inviteeId });
    },

    respondFriendRequest: async (requesterUsername, action) => {
        if (!token) return { error: "Not logged in" };
        return await request("/friends/respond", "POST", { requesterUsername, action });
    },

    markMessageRead: async (messageId) => {
        if (!token) return { error: "Not logged in" };
        return await request(`/messages/${messageId}/read`, "PUT", {});
    },
    
    removeCollaborator: async (planId, collaboratorId) => {
      if (!token) return { error: "Not logged in" };
      return await request(`/plans/${planId}/collaborators/remove`, "POST", { collaboratorId });
    },
    
    leavePlan: async (planId) => {
      if (!token) return { error: "Not logged in" };
      return await request(`/plans/${planId}/leave`, "POST", {});
    },
    
    deletePlan: async (id) => {
      if (!token) return { error: "Not logged in" };
      return await request(`/plans/${id}`, "DELETE");
    }
  };
})();
