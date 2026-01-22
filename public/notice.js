// Notice Viewer Module
const NoticeViewer = (function() {
    // Show Notice Modal
    async function showNoticeBoard(notices, isAutoPopup = false) {
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
        modalContent.style.display = 'flex';
        modalContent.style.flexDirection = 'column';
        
        // Title
        const title = document.createElement('h2');
        title.textContent = '告示栏';
        title.style.marginTop = '0';
        title.style.marginBottom = '1rem';
        title.style.borderBottom = '1px solid #eee';
        title.style.paddingBottom = '0.5rem';
        
        // Notices List Container
        const listContainer = document.createElement('div');
        listContainer.style.flex = '1';
        listContainer.style.overflowY = 'auto';
        listContainer.style.display = 'flex';
        listContainer.style.flexDirection = 'column';
        listContainer.style.gap = '1.5rem';

        if (!notices || notices.length === 0) {
            listContainer.innerHTML = '<div style="text-align:center; color:#888;">暂无告示</div>';
        } else {
            notices.forEach(notice => {
                const item = document.createElement('div');
                item.style.paddingBottom = '1.5rem';
                item.style.borderBottom = '1px dashed #eee';
                
                // Meta Info
                const meta = document.createElement('div');
                meta.style.display = 'flex';
                meta.style.alignItems = 'center';
                meta.style.marginBottom = '0.5rem';
                meta.style.gap = '0.5rem';

                if (notice.targetUser && notice.targetUser !== 'all') {
                     const badge = document.createElement('span');
                     badge.textContent = '私信';
                     badge.style.backgroundColor = '#28a745';
                     badge.style.color = 'white';
                     badge.style.padding = '2px 6px';
                     badge.style.borderRadius = '4px';
                     badge.style.fontSize = '0.75rem';
                     meta.appendChild(badge);
                }

                const date = document.createElement('span');
                date.textContent = new Date(notice.lastUpdated).toLocaleString();
                date.style.color = '#999';
                date.style.fontSize = '0.85rem';
                meta.appendChild(date);
                
                // Content
                const content = document.createElement('div');
                content.style.lineHeight = '1.6';
                content.style.whiteSpace = 'pre-wrap';
                content.style.color = '#333';
                content.textContent = notice.content;

                item.appendChild(meta);
                item.appendChild(content);
                listContainer.appendChild(item);
            });
        }
        
        // Close Button
        const closeBtn = document.createElement('button');
        closeBtn.textContent = isAutoPopup ? '我知道了' : '关闭';
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
        modalContent.appendChild(listContainer);
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
            
            // Get notices
            const noticeRes = await fetch('/api/notice', {
                headers: { 'Authorization': sessionStorage.getItem('hkwl_auth_token') }
            });
            const noticeData = await noticeRes.json();
            
            if (!noticeData.success || !noticeData.notices || noticeData.notices.length === 0) return;
            
            const lastSeen = authData.lastNoticeSeenAt ? new Date(authData.lastNoticeSeenAt).getTime() : 0;
            // Check the latest notice (first one)
            const latestNotice = noticeData.notices[0];
            const lastUpdated = latestNotice.lastUpdated ? new Date(latestNotice.lastUpdated).getTime() : 0;
            
            // If latest notice is newer than last seen, show the board
            if (lastUpdated > lastSeen) {
                showNoticeBoard(noticeData.notices, true);
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
            if (data.success) {
                showNoticeBoard(data.notices || [], false);
            } else {
                alert("无法获取告示");
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
