const Mailbox = (() => {
    let modal = null;
    let badgeElement = null;
    let currentPage = 1;
    let totalMessages = 0;
    let isLoading = false;
    let currentTab = 'inbox';
    let cachedIsAdmin = false;

    function init() {
        // Create modal structure if not exists
        if (!document.getElementById('mailbox-modal')) {
            createModal();
        }
    }

    function setBadge(el) {
        badgeElement = el;
        checkUnread();
        // Poll every minute
        setInterval(checkUnread, 60000);
    }

    async function checkUnread() {
        if (!badgeElement) return;
        // Only check if user is logged in
        if (!sessionStorage.getItem('hkwl_auth_token')) return;

        try {
            const res = await fetch(`/api/messages?t=${Date.now()}`, {
                headers: { 'Authorization': sessionStorage.getItem('hkwl_auth_token') }
            });
            const data = await res.json();
            if (data.success && Array.isArray(data.messages)) {
                const count = data.messages.filter(m => !m.isMe && !m.isRead).length;
                updateBadgeUI(count);
            }
        } catch (e) { console.error("Check unread failed", e); }
    }

    function updateBadgeUI(count) {
        if (!badgeElement) return;
        if (count > 0) {
            badgeElement.textContent = count > 99 ? '99+' : count;
            badgeElement.style.display = 'flex';
        } else {
            badgeElement.style.display = 'none';
        }
    }

    function createModal() {
        const div = document.createElement('div');
        div.id = 'mailbox-modal';
        div.style.display = 'none';
        div.style.position = 'fixed';
        div.style.top = '0';
        div.style.left = '0';
        div.style.width = '100%';
        div.style.height = '100%';
        div.style.backgroundColor = 'rgba(0,0,0,0.5)';
        div.style.zIndex = '2000';
        div.style.justifyContent = 'center';
        div.style.alignItems = 'center';
        div.style.backdropFilter = 'blur(2px)';

        div.innerHTML = `
            <div style="background: white; width: 90%; max-width: 600px; height: 80vh; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.2); animation: slideIn 0.3s ease-out;">
                <div style="padding: 1rem 1.5rem; border-bottom: 1px solid #eee; background: #fff;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h3 style="margin: 0; font-size: 1.2rem; color: #333;">信箱</h3>
                        <button id="close-mailbox" style="border: none; background: none; font-size: 1.8rem; cursor: pointer; color: #999; line-height: 1;">&times;</button>
                    </div>
                    <div style="display: flex; gap: 1rem;">
                        <button id="tab-inbox" class="mailbox-tab active" style="padding: 0.5rem 1rem; border: none; background: none; cursor: pointer; font-weight: 500; border-bottom: 2px solid #007aff; color: #007aff;">收件箱</button>
                        <button id="tab-sent" class="mailbox-tab" style="padding: 0.5rem 1rem; border: none; background: none; cursor: pointer; font-weight: 500; color: #666; border-bottom: 2px solid transparent;">已发送</button>
                    </div>
                </div>
                <div id="message-list" style="flex: 1; overflow-y: auto; padding: 1.5rem; background: #f5f7fa; display: flex; flex-direction: column; gap: 1rem;">
                    <div style="text-align: center; color: #888;">加载中...</div>
                </div>
                <div style="padding: 1rem; border-top: 1px solid #eee; background: white;">
                    <textarea id="message-input" placeholder="输入消息..." style="width: 100%; height: 80px; padding: 0.8rem; border: 1px solid #e0e0e0; border-radius: 8px; resize: none; margin-bottom: 0.8rem; font-family: inherit; font-size: 0.95rem; outline: none; transition: border-color 0.2s;"></textarea>
                    <div style="display: flex; justify-content: flex-end;">
                        <button id="send-message-btn" style="padding: 0.6rem 1.5rem; background: #007aff; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500; transition: background 0.2s;">发送</button>
                    </div>
                </div>
            </div>
            <style>
                @keyframes slideIn {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                #message-input:focus { border-color: #007aff; }
                #send-message-btn:hover { background: #0056b3; }
                #send-message-btn:disabled { background: #ccc; cursor: not-allowed; }
            </style>
        `;
        document.body.appendChild(div);

        // Event listeners
        div.addEventListener('click', (e) => {
            if (e.target === div) close();
        });
        document.getElementById('close-mailbox').onclick = close;
        document.getElementById('send-message-btn').onclick = sendMessage;
        
        document.getElementById('tab-inbox').onclick = () => switchTab('inbox');
        document.getElementById('tab-sent').onclick = () => switchTab('sent');

        modal = div;
    }

    function switchTab(tab) {
        currentTab = tab;
        
        // Update UI
        const inboxBtn = document.getElementById('tab-inbox');
        const sentBtn = document.getElementById('tab-sent');
        
        if (tab === 'inbox') {
            inboxBtn.style.color = '#007aff';
            inboxBtn.style.borderBottom = '2px solid #007aff';
            sentBtn.style.color = '#666';
            sentBtn.style.borderBottom = '2px solid transparent';
        } else {
            sentBtn.style.color = '#007aff';
            sentBtn.style.borderBottom = '2px solid #007aff';
            inboxBtn.style.color = '#666';
            inboxBtn.style.borderBottom = '2px solid transparent';
        }
        
        loadMessages(1); // Reset to page 1
    }

    function open() {
        if (!modal) createModal();
        modal.style.display = 'flex';
        
        // Default to inbox
        switchTab('inbox');
        
        // Update UI based on role
        const isAdmin = Auth.isAdmin();
        const title = modal.querySelector('h3');
        const input = document.getElementById('message-input');
        
        if (title && input) {
            if (isAdmin) {
                title.textContent = '信箱 (全员广播)';
                input.placeholder = '发送消息给所有用户 (全员可见)...';
            } else {
                title.textContent = '联系管理员';
                input.placeholder = '发送消息给管理员 (仅管理员可见)...';
            }
        }
    }

    function close() {
        if (modal) modal.style.display = 'none';
        // Refresh badge when closing to reflect read status
        checkUnread();
    }

    async function loadMessages(page = 1) {
        if (isLoading) return;
        isLoading = true;
        
        const list = document.getElementById('message-list');
        const isLoadMore = page > 1;

        if (!isLoadMore) {
            list.innerHTML = '<div style="text-align: center; color: #888; padding-top: 2rem;">加载中...</div>';
        } else {
            const loadMoreBtn = document.getElementById('load-more-btn');
            if (loadMoreBtn) loadMoreBtn.textContent = '加载中...';
        }

        try {
            const res = await fetch(`/api/messages?t=${Date.now()}&limit=50&page=${page}&type=${currentTab}`, {
                headers: { 'Authorization': sessionStorage.getItem('hkwl_auth_token') }
            });
            const data = await res.json();

            if (data.success) {
                const newMessages = data.messages || [];
                cachedIsAdmin = data.isAdmin;
                totalMessages = data.total;
                currentPage = page;

                // Backend returns Newest -> Oldest.
                // We want to display Oldest -> Newest (Newest at bottom).
                newMessages.reverse();

                renderMessages(newMessages, isLoadMore);
            } else {
                 if (!isLoadMore) list.innerHTML = `<div style="text-align: center; color: #ff4d4f;">加载失败: ${data.error}</div>`;
            }
        } catch (e) {
            console.error(e);
            if (!isLoadMore) list.innerHTML = `<div style="text-align: center; color: #ff4d4f;">网络错误</div>`;
        } finally {
            isLoading = false;
        }
    }

    function renderMessages(messages, isLoadMore) {
        const list = document.getElementById('message-list');
        
        // Create fragment for new items
        const fragment = document.createDocumentFragment();
        
        messages.forEach(msg => {
            const el = createMessageElement(msg, cachedIsAdmin);
            fragment.appendChild(el);
        });

        if (isLoadMore) {
            // "Load More" scenario: Insert OLDER messages at the TOP
            const loadMoreBtn = document.getElementById('load-more-btn');
            if (loadMoreBtn) {
                const oldHeight = list.scrollHeight;
                const oldScrollTop = list.scrollTop;
                
                // Insert after the button (which is at top)
                loadMoreBtn.after(fragment);
                
                // Restore scroll position
                const newHeight = list.scrollHeight;
                list.scrollTop = oldScrollTop + (newHeight - oldHeight);
                
                // Update button
                if ((currentPage * 50) >= totalMessages) {
                    loadMoreBtn.style.display = 'none';
                } else {
                    loadMoreBtn.textContent = '加载更多历史消息';
                }
            }
        } else {
            // Initial load scenario: Clear and Append
            list.innerHTML = '';
            
            if (messages.length === 0) {
                list.innerHTML = `<div style="text-align: center; color: #999; padding-top: 3rem;">${currentTab === 'inbox' ? '没有收到的消息' : '没有发送的消息'}</div>`;
                return;
            }

            // Add Load More button at TOP if there are more messages
            if (totalMessages > messages.length) {
                 const btn = document.createElement('div');
                 btn.id = 'load-more-btn';
                 btn.textContent = '加载更多历史消息';
                 btn.style.textAlign = 'center';
                 btn.style.padding = '10px';
                 btn.style.color = '#007aff';
                 btn.style.cursor = 'pointer';
                 btn.style.fontSize = '0.85rem';
                 btn.style.userSelect = 'none';
                 btn.onclick = () => loadMessages(currentPage + 1);
                 list.appendChild(btn);
            }
            
            list.appendChild(fragment);
            
            // Scroll to bottom (Newest messages)
            list.scrollTop = list.scrollHeight;
        }
    }

    function createMessageElement(msg, isAdmin) {
        // Use server-side calculated isMe
        const isMe = msg.isMe;
        
        const item = document.createElement('div');
        item.style.display = 'flex';
        item.style.flexDirection = 'column';
        item.style.alignItems = isMe ? 'flex-end' : 'flex-start';
        item.style.maxWidth = '100%';

        const bubble = document.createElement('div');
        bubble.style.maxWidth = '85%';
        bubble.style.padding = '0.8rem 1rem';
        bubble.style.borderRadius = '12px';
        bubble.style.position = 'relative';
        bubble.style.fontSize = '0.95rem';
        bubble.style.lineHeight = '1.4';
        bubble.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
        
        if (msg.isAnnouncement) {
            if (isMe) {
                 bubble.style.backgroundColor = '#f0ad4e';
                 bubble.style.color = 'white';
                 bubble.style.borderBottomRightRadius = '2px';
            } else {
                 bubble.style.backgroundColor = '#fff3cd';
                 bubble.style.color = '#856404';
                 bubble.style.border = '1px solid #ffeeba';
                 bubble.style.borderBottomLeftRadius = '2px';
            }
        } else {
            if (isMe) {
                bubble.style.backgroundColor = '#007aff';
                bubble.style.color = 'white';
                bubble.style.borderBottomRightRadius = '2px';
            } else {
                bubble.style.backgroundColor = 'white';
                bubble.style.color = '#333';
                bubble.style.borderBottomLeftRadius = '2px';
            }
        }

        const meta = document.createElement('div');
        meta.style.fontSize = '0.75rem';
        meta.style.marginBottom = '0.3rem';
        meta.style.opacity = '0.8';
        
        const time = new Date(msg.timestamp).toLocaleString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        let senderName = msg.senderDisplay || msg.sender;
        
        if (msg.isAnnouncement) {
            senderName += ' (全员公告)';
        }
        
        if (isMe) {
            let target = msg.receiver;
            if (target === 'admin') target = '管理员';
            if (target === 'all_users') target = '所有用户';
            meta.textContent = `发送给 ${target} · ${time}`;
        } else {
            meta.textContent = `${senderName} · ${time}`;
        }

        if (isMe && isAdmin) {
            const deleteBtn = document.createElement('span');
            deleteBtn.textContent = ' 撤回';
            deleteBtn.style.cursor = 'pointer';
            deleteBtn.style.marginLeft = '0.5rem';
            deleteBtn.style.color = 'rgba(255, 255, 255, 0.9)';
            deleteBtn.style.fontSize = '0.75rem';
            deleteBtn.style.textDecoration = 'underline';
            deleteBtn.title = '撤回这条消息';
            
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                if(confirm('确定要撤回这条消息吗？')) {
                    deleteMessage(msg._id);
                }
            };
            meta.appendChild(deleteBtn);
        }

        const content = document.createElement('div');
        content.style.wordBreak = 'break-word';
        content.style.whiteSpace = 'pre-wrap';
        content.textContent = msg.content;
        bubble.appendChild(meta);
        bubble.appendChild(content);

        // --- Invitation Actions ---
        if (msg.type === 'invitation' && !isMe && msg.metadata && msg.metadata.planId) {
            const actionContainer = document.createElement('div');
            actionContainer.style.marginTop = '0.8rem';
            actionContainer.style.display = 'flex';
            actionContainer.style.gap = '0.8rem';

            // Check if already processed (optional, if message content doesn't update, we rely on button state or removal)
            // But usually we just show buttons.
            
            const acceptBtn = document.createElement('button');
            acceptBtn.textContent = '接受邀请';
            acceptBtn.style.padding = '0.4rem 0.8rem';
            acceptBtn.style.border = 'none';
            acceptBtn.style.borderRadius = '4px';
            acceptBtn.style.background = '#28a745';
            acceptBtn.style.color = 'white';
            acceptBtn.style.cursor = 'pointer';
            acceptBtn.style.fontSize = '0.85rem';
            
            acceptBtn.onclick = async () => {
                 acceptBtn.disabled = true;
                 acceptBtn.textContent = '处理中...';
                 rejectBtn.style.display = 'none';
                 try {
                     const myId = Auth.getFriendId();
                     const res = await CloudSync.approveInvitation(msg.metadata.planId, myId);
                     
                     if (res && res.success) {
                         acceptBtn.textContent = '已接受';
                         acceptBtn.style.background = '#ccc';
                         // Optionally refresh plans if we are on plans page
                         if (typeof renderPlans === 'function') renderPlans();
                         // Also maybe refresh the message list or mark this message as handled?
                         // For now, just UI feedback.
                     } else {
                         alert("接受失败: " + (res.error || '未知错误'));
                         acceptBtn.disabled = false;
                         acceptBtn.textContent = '接受邀请';
                         rejectBtn.style.display = 'inline-block';
                     }
                 } catch(e) {
                     console.error(e);
                     alert("操作失败");
                     acceptBtn.disabled = false;
                     acceptBtn.textContent = '接受邀请';
                     rejectBtn.style.display = 'inline-block';
                 }
             };

             const rejectBtn = document.createElement('button');
             rejectBtn.textContent = '拒绝';
             rejectBtn.style.padding = '0.4rem 0.8rem';
             rejectBtn.style.border = '1px solid #dc3545';
             rejectBtn.style.borderRadius = '4px';
             rejectBtn.style.background = 'white';
             rejectBtn.style.color = '#dc3545';
             rejectBtn.style.cursor = 'pointer';
             rejectBtn.style.fontSize = '0.85rem';
             
             rejectBtn.onclick = async () => {
                  rejectBtn.disabled = true;
                  rejectBtn.textContent = '...';
                  acceptBtn.style.display = 'none';
                  try {
                     const myId = Auth.getFriendId();
                     const res = await CloudSync.rejectInvitation(msg.metadata.planId, myId);
                     
                     if (res && res.success) {
                         rejectBtn.textContent = '已拒绝';
                         rejectBtn.style.color = '#999';
                         rejectBtn.style.border = '1px solid #ccc';
                     } else {
                         alert("拒绝失败: " + (res.error || '未知错误'));
                         rejectBtn.disabled = false;
                         rejectBtn.textContent = '拒绝';
                         acceptBtn.style.display = 'inline-block';
                     }
                  } catch(e) {
                      console.error(e);
                      alert("操作失败");
                      rejectBtn.disabled = false;
                      rejectBtn.textContent = '拒绝';
                      acceptBtn.style.display = 'inline-block';
                  }
             };

            actionContainer.appendChild(acceptBtn);
            actionContainer.appendChild(rejectBtn);
            bubble.appendChild(actionContainer);
        }

        item.appendChild(bubble);

        if (!isMe && !msg.isRead) {
            markAsRead(msg._id);
        }

        return item;
    }

    async function sendMessage() {
        const input = document.getElementById('message-input');
        const content = input.value.trim();
        if (!content) return;

        const btn = document.getElementById('send-message-btn');
        btn.disabled = true;
        const originalText = btn.textContent;
        btn.textContent = '...';

        try {
            const res = await fetch('/api/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': sessionStorage.getItem('hkwl_auth_token')
                },
                body: JSON.stringify({ content })
            });
            const data = await res.json();

            if (data.success) {
                input.value = '';
                // Reload to show new message (which will be at bottom)
                await loadMessages(1); 
                switchTab('sent');
            } else {
                console.error('Send failed:', data);
                alert(`发送失败: ${data.error || '未知错误'}`);
            }
        } catch (e) {
            console.error('Network error:', e);
            alert(`发送请求失败: ${e.message}`);
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
            input.focus();
        }
    }

    async function markAsRead(id) {
        try {
            await fetch(`/api/messages/${id}/read`, {
                method: 'PUT',
                headers: { 'Authorization': sessionStorage.getItem('hkwl_auth_token') }
            });
        } catch (e) { console.error(e); }
    }

    async function deleteMessage(id) {
        try {
            const res = await fetch(`/api/messages/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': sessionStorage.getItem('hkwl_auth_token') }
            });
            const data = await res.json();
            if (data.success) {
                loadMessages(currentPage); // Reload current page or just Page 1? Page 1 is safer.
            } else {
                alert('撤回失败: ' + (data.error || '未知错误'));
            }
        } catch (e) {
            console.error(e);
            alert('网络错误，撤回失败');
        }
    }

    async function getPendingNotifications() {
        if (!sessionStorage.getItem('hkwl_auth_token')) return [];
        const notifications = [];

        try {
            // 1. Fetch Friend Requests
            try {
                const resFriends = await fetch('/api/friends/requests', {
                    headers: { 'Authorization': sessionStorage.getItem('hkwl_auth_token') }
                });
                const dataFriends = await resFriends.json();
                if (dataFriends.success && Array.isArray(dataFriends.requests)) {
                    dataFriends.requests.forEach(req => {
                        notifications.push({
                            kind: 'friend_request',
                            priority: 1, // High priority
                            data: req
                        });
                    });
                }
            } catch(e) { console.error("Fetch friend requests failed", e); }

            // 2. Fetch Messages (Inbox)
            try {
                const resMsg = await fetch(`/api/messages?t=${Date.now()}&limit=20&type=inbox`, {
                    headers: { 'Authorization': sessionStorage.getItem('hkwl_auth_token') }
                });
                const dataMsg = await resMsg.json();
                if (dataMsg.success && Array.isArray(dataMsg.messages)) {
                    dataMsg.messages.forEach(m => {
                        if (m.isMe || m.isRead) return;

                        if (m.type === 'invitation' && m.metadata && m.metadata.planId) {
                            notifications.push({
                                kind: 'plan_invitation',
                                priority: 2,
                                data: m
                            });
                        } else if (m.sender === 'admin' || m.type === 'system' || m.sender === 'System') {
                             notifications.push({
                                kind: 'system_notification',
                                priority: 3,
                                data: m
                            });
                        }
                    });
                }
            } catch(e) { console.error("Fetch messages failed", e); }

            // Fetch System Notices (Announcements)
            try {
                // 1. Get User Status for lastNoticeSeenAt
                const resAuth = await fetch('/api/auth/status', {
                    headers: { 'Authorization': sessionStorage.getItem('hkwl_auth_token') }
                });
                const authData = await resAuth.json();
                const lastSeen = authData.lastNoticeSeenAt ? new Date(authData.lastNoticeSeenAt).getTime() : 0;

                // 2. Get Notices
                const resNotice = await fetch(`/api/notice?_t=${Date.now()}`, {
                    headers: { 'Authorization': sessionStorage.getItem('hkwl_auth_token') }
                });
                const noticeData = await resNotice.json();

                if (noticeData.success && noticeData.notices && noticeData.notices.length > 0) {
                    const latestNotice = noticeData.notices[0];
                    const lastUpdated = latestNotice.lastUpdated ? new Date(latestNotice.lastUpdated).getTime() : 0;

                    if (lastUpdated > lastSeen) {
                         notifications.push({
                            kind: 'announcement',
                            priority: 0, // Highest priority for global announcements? or maybe after friend requests?
                            // Let's make it high priority (0) so everyone sees it first
                            data: latestNotice
                        });
                    }
                }
            } catch(e) { console.error("Fetch notices failed", e); }

            // Sort by priority
            return notifications.sort((a, b) => a.priority - b.priority);

        } catch (e) {
            console.error("Failed to fetch pending notifications", e);
            return [];
        }
    }

    return {
        open,
        init,
        setBadge,
        checkUnread,
        getPendingNotifications
    };
})();