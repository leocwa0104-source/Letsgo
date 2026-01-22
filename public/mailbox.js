const Mailbox = (() => {
    let modal = null;

    function init() {
        // Create modal structure if not exists
        if (!document.getElementById('mailbox-modal')) {
            createModal();
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
                <div style="padding: 1rem 1.5rem; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; background: #fff;">
                    <h3 style="margin: 0; font-size: 1.2rem; color: #333;">信箱</h3>
                    <button id="close-mailbox" style="border: none; background: none; font-size: 1.8rem; cursor: pointer; color: #999; line-height: 1;">&times;</button>
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

        modal = div;
    }

    function open() {
        if (!modal) createModal();
        modal.style.display = 'flex';
        loadMessages();
    }

    function close() {
        if (modal) modal.style.display = 'none';
    }

    async function loadMessages() {
        const list = document.getElementById('message-list');
        // Don't clear immediately if we want to preserve scroll or just append?
        // For simplicity, reload all.
        list.innerHTML = '<div style="text-align: center; color: #888; padding-top: 2rem;">加载中...</div>';

        try {
            const res = await fetch('/api/messages', {
                headers: { 'Authorization': localStorage.getItem('hkwl_auth_token') }
            });
            const data = await res.json();

            if (data.success) {
                renderMessages(data.messages);
            } else {
                list.innerHTML = `<div style="text-align: center; color: #ff4d4f;">加载失败: ${data.error}</div>`;
            }
        } catch (e) {
            console.error(e);
            list.innerHTML = `<div style="text-align: center; color: #ff4d4f;">网络错误</div>`;
        }
    }

    function renderMessages(messages) {
        const list = document.getElementById('message-list');
        list.innerHTML = '';

        if (!messages || messages.length === 0) {
            list.innerHTML = '<div style="text-align: center; color: #999; padding-top: 3rem;">暂无消息</div>';
            return;
        }

        // Messages are sorted by timestamp desc in backend.
        // We usually want to display oldest at top, newest at bottom like chat.
        // So let's reverse them for display.
        const sortedMsgs = [...messages].reverse();
        let currentUser = Auth.getCurrentUser();
        
        // Fallback: try to parse token if currentUser is null
        if (!currentUser) {
             const token = localStorage.getItem('hkwl_auth_token');
             if (token) {
                 try {
                     const parts = token.split(':');
                     if (parts.length > 1) {
                         currentUser = decodeURIComponent(parts.slice(1).join(':'));
                     }
                 } catch(e) { console.error("Token parse error", e); }
             }
        }

        sortedMsgs.forEach(msg => {
            // Priority: Use server-side isMe if available, otherwise fallback to local check
            let isMe;
            if (typeof msg.isMe !== 'undefined') {
                isMe = msg.isMe;
            } else {
                // Robust comparison using lower case
                isMe = currentUser && msg.sender.toLowerCase() === currentUser.toLowerCase();
            }
            
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
            
            if (isMe) {
                bubble.style.backgroundColor = '#007aff';
                bubble.style.color = 'white';
                bubble.style.borderBottomRightRadius = '2px';
            } else {
                bubble.style.backgroundColor = 'white';
                bubble.style.color = '#333';
                bubble.style.borderBottomLeftRadius = '2px';
            }

            const meta = document.createElement('div');
            meta.style.fontSize = '0.75rem';
            meta.style.marginBottom = '0.3rem';
            meta.style.opacity = '0.8';
            
            const time = new Date(msg.timestamp).toLocaleString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            
            // Use senderIsAdmin flag from backend if available, or just sender name
            const senderName = msg.senderIsAdmin ? '管理员' : msg.sender;
            meta.textContent = isMe ? `${time}` : `${senderName} · ${time}`;

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
        
        // Scroll to bottom
        setTimeout(() => {
            list.scrollTop = list.scrollHeight;
        }, 0);
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
                    'Authorization': localStorage.getItem('hkwl_auth_token')
                },
                body: JSON.stringify({ content })
            });
            const data = await res.json();

            if (data.success) {
                input.value = '';
                await loadMessages(); // Reload to see new message
            } else {
                alert('发送失败: ' + data.error);
            }
        } catch (e) {
            alert('网络错误');
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
                headers: { 'Authorization': localStorage.getItem('hkwl_auth_token') }
            });
        } catch (e) { console.error(e); }
    }

    return {
        open,
        init
    };
})();
