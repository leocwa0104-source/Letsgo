const Mailbox = (() => {
    let modal = null;
    let badgeElement = null;

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
        
        renderMessages();
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

        loadMessages();
    }

    function close() {
        if (modal) modal.style.display = 'none';
        // Refresh badge when closing to reflect read status
        checkUnread();
    }

    async function loadMessages() {
        const list = document.getElementById('message-list');
        // Don't clear immediately if we want to preserve scroll or just append?
        // For simplicity, reload all.
        list.innerHTML = '<div style="text-align: center; color: #888; padding-top: 2rem;">加载中...</div>';

        try {
            // Add timestamp to prevent caching
            const res = await fetch(`/api/messages?t=${Date.now()}`, {
                headers: { 'Authorization': sessionStorage.getItem('hkwl_auth_token') }
            });
            const data = await res.json();

            if (data.success) {
                cachedMessages = data.messages || [];
                cachedIsAdmin = data.isAdmin;
                renderMessages();
            } else {
                list.innerHTML = `<div style="text-align: center; color: #ff4d4f;">加载失败: ${data.error}</div>`;
            }
        } catch (e) {
            console.error(e);
            list.innerHTML = `<div style="text-align: center; color: #ff4d4f;">网络错误</div>`;
        }
    }

    function renderMessages() {
        const list = document.getElementById('message-list');
        list.innerHTML = '';
        
        const messages = cachedMessages;
        const isAdmin = cachedIsAdmin;

        if (!messages || messages.length === 0) {
            list.innerHTML = '<div style="text-align: center; color: #999; padding-top: 3rem;">暂无消息</div>';
            return;
        }

        // Filter based on currentTab
        // Inbox: !isMe
        // Sent: isMe
        const filteredMsgs = messages.filter(msg => {
            if (currentTab === 'inbox') return !msg.isMe;
            if (currentTab === 'sent') return msg.isMe;
            return true;
        });
        
        if (filteredMsgs.length === 0) {
             list.innerHTML = `<div style="text-align: center; color: #999; padding-top: 3rem;">${currentTab === 'inbox' ? '没有收到的消息' : '没有发送的消息'}</div>`;
             return;
        }

        // Messages are sorted by timestamp asc (oldest -> newest) in backend.
        // We want to display newest at top? Or chat style (newest at bottom)?
        // User asked for "modules", which implies a list. Usually lists (email style) are newest at top.
        // Chat style is newest at bottom.
        // The previous implementation was chat style (scrolled to bottom).
        // If we split into inbox/sent, email style (newest top) is often better.
        // But let's stick to the previous visual style (bubbles) for now, which usually implies chat style.
        // However, with "Inbox" and "Sent", it feels more like email.
        // Let's reverse the order for display so newest is at the top, which makes more sense for a "List" view.
        // Actually, if I keep bubbles, maybe chat style is still better?
        // "Inbox" usually implies a list of threads or messages.
        // Let's try Newest at Top for this "Inbox/Sent" view.
        
        const sortedMsgs = [...filteredMsgs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        sortedMsgs.forEach(msg => {
            // Use server-side calculated isMe
            const isMe = msg.isMe;
            
            const item = document.createElement('div');
            item.style.display = 'flex';
            item.style.flexDirection = 'column';
            // If inbox (received), align left. If sent, align right?
            // Or just align everything left since it's a list now?
            // Let's keep the alignment for visual cue.
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
            
            // Visual distinction for Announcement vs Private Message
            if (msg.isAnnouncement) {
                // Announcement Style
                if (isMe) {
                     // Admin viewing their own announcement
                     bubble.style.backgroundColor = '#f0ad4e'; // Orange-ish
                     bubble.style.color = 'white';
                     bubble.style.borderBottomRightRadius = '2px';
                } else {
                     // User viewing announcement
                     bubble.style.backgroundColor = '#fff3cd'; // Light yellow
                     bubble.style.color = '#856404';
                     bubble.style.border = '1px solid #ffeeba';
                     bubble.style.borderBottomLeftRadius = '2px';
                }
            } else {
                // Regular Message Style
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
            
            // Use senderDisplay from backend
            let senderName = msg.senderDisplay || msg.sender;
            
            // Add (全员) tag for announcements
            if (msg.isAnnouncement) {
                senderName += ' (全员公告)';
            }
            
            // In Sent tab (isMe), we might want to see "To: Receiver"?
            // Current backend response structure for 'receiver' might be needed.
            // Backend returns message object.
            // If isMe, sender is me. Receiver is...
            // Let's check api/index.js.
            // It returns messages. The schema has sender and receiver.
            // If I am sender, I want to see who I sent to.
            // But receiver might be 'admin' or 'all_users' or specific user.
            
            if (isMe) {
                // In Sent box
                let target = msg.receiver;
                if (target === 'admin') target = '管理员';
                if (target === 'all_users') target = '所有用户';
                meta.textContent = `发送给 ${target} · ${time}`;
            } else {
                // In Inbox
                meta.textContent = `${senderName} · ${time}`;
            }

            // Allow admin to delete their own messages
            if (isMe && isAdmin) {
                const deleteBtn = document.createElement('span');
                deleteBtn.textContent = ' 撤回';
                deleteBtn.style.cursor = 'pointer';
                deleteBtn.style.marginLeft = '0.5rem';
                deleteBtn.style.color = 'rgba(255, 255, 255, 0.9)'; // White on blue background
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
            item.appendChild(bubble);
            list.appendChild(item);

            // Mark as read if not me and not read
            if (!isMe && !msg.isRead) {
                markAsRead(msg._id);
            }
        });
        
        // No auto-scroll to bottom for Newest-at-Top list style
        list.scrollTop = 0;
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
                await loadMessages(); // Reload data
                switchTab('sent');    // Switch to sent tab to show new message
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
                loadMessages(); // Reload list
            } else {
                alert('撤回失败: ' + (data.error || '未知错误'));
            }
        } catch (e) {
            console.error(e);
            alert('网络错误，撤回失败');
        }
    }

    return {
        open,
        init,
        setBadge,
        checkUnread
    };
})();
