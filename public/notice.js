// Notice Viewer Module
const NoticeViewer = (function() {
    // Show Notice Modal
    async function showNoticeModal(content, isAutoPopup = false) {
        // Remove existing modal if any
        const existing = document.getElementById('notice-modal');
        if (existing) existing.remove();
        
        const modalOverlay = document.createElement('div');
        modalOverlay.id = 'notice-modal';
        modalOverlay.style.position = 'fixed';
        modalOverlay.style.top = '0';
        modalOverlay.style.left = '0';
        modalOverlay.style.width = '100%';
        modalOverlay.style.height = '100%';
        modalOverlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
        modalOverlay.style.zIndex = '2000';
        modalOverlay.style.display = 'flex';
        modalOverlay.style.justifyContent = 'center';
        modalOverlay.style.alignItems = 'center';
        
        const modalContent = document.createElement('div');
        modalContent.style.backgroundColor = 'white';
        modalContent.style.padding = '2rem';
        modalContent.style.borderRadius = '8px';
        modalContent.style.maxWidth = '600px';
        modalContent.style.width = '90%';
        modalContent.style.maxHeight = '80vh';
        modalContent.style.overflowY = 'auto';
        modalContent.style.position = 'relative';
        
        // Title
        const title = document.createElement('h2');
        title.textContent = '最新告示';
        title.style.marginTop = '0';
        title.style.marginBottom = '1rem';
        title.style.borderBottom = '1px solid #eee';
        title.style.paddingBottom = '0.5rem';
        
        // Body (Markdown-like or plain text)
        const body = document.createElement('div');
        body.style.lineHeight = '1.6';
        body.style.whiteSpace = 'pre-wrap'; // Preserve whitespace
        body.textContent = content;
        
        // Close Button
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '我知道了';
        closeBtn.className = 'btn btn-secondary';
        closeBtn.style.marginTop = '1.5rem';
        closeBtn.style.width = '100%';
        closeBtn.onclick = async () => {
            modalOverlay.remove();
            if (isAutoPopup) {
                // If this was an auto-popup, mark as read
                await markAsRead();
            }
        };
        
        modalContent.appendChild(title);
        modalContent.appendChild(body);
        modalContent.appendChild(closeBtn);
        modalOverlay.appendChild(modalContent);
        
        document.body.appendChild(modalOverlay);
    }
    
    // Mark notice as read
    async function markAsRead() {
        try {
            await fetch('/api/notice/ack', {
                method: 'POST',
                headers: {
                    'Authorization': sessionStorage.getItem('hkwl_auth_token')
                }
            });
            console.log("Notice marked as read");
        } catch (e) {
            console.error("Failed to mark notice as read:", e);
        }
    }
    
    // Check and show notice if needed
    async function checkAndShowNotice() {
        if (!Auth.isLoggedIn()) return;
        
        try {
            // Get user status (lastNoticeSeenAt)
            const authRes = await fetch('/api/auth/status', {
                headers: { 'Authorization': sessionStorage.getItem('hkwl_auth_token') }
            });
            const authData = await authRes.json();
            
            // Get latest notice
            const noticeRes = await fetch('/api/notice', {
                headers: { 'Authorization': sessionStorage.getItem('hkwl_auth_token') }
            });
            const noticeData = await noticeRes.json();
            
            if (!noticeData.success || !noticeData.content) return;
            
            const lastSeen = authData.lastNoticeSeenAt ? new Date(authData.lastNoticeSeenAt).getTime() : 0;
            const lastUpdated = noticeData.lastUpdated ? new Date(noticeData.lastUpdated).getTime() : 0;
            
            // If notice is newer than last seen, show it
            if (lastUpdated > lastSeen) {
                showNoticeModal(noticeData.content, true);
            }
        } catch (e) {
            console.error("Notice check failed:", e);
        }
    }
    
    // Manual open
    async function openNoticeBoard() {
        try {
            const res = await fetch('/api/notice', {
                headers: { 'Authorization': sessionStorage.getItem('hkwl_auth_token') }
            });
            const data = await res.json();
            if (data.success && data.content) {
                showNoticeModal(data.content, false);
            } else {
                alert("暂无告示");
            }
        } catch (e) {
            alert("无法获取告示");
        }
    }

    return {
        checkAndShowNotice,
        openNoticeBoard
    };
})();
