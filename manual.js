const Manual = (() => {
    let modal = null;

    function init() {
        if (modal) return;
        
        const div = document.createElement('div');
        div.style.position = 'fixed';
        div.style.top = '0';
        div.style.left = '0';
        div.style.width = '100%';
        div.style.height = '100%';
        div.style.backgroundColor = 'rgba(0,0,0,0.5)';
        div.style.zIndex = '2000';
        div.style.display = 'none';
        div.style.justifyContent = 'center';
        div.style.alignItems = 'center';
        div.style.backdropFilter = 'blur(5px)';

        div.innerHTML = `
            <div style="background: white; width: 90%; max-width: 800px; height: 80vh; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.2); animation: slideIn 0.3s ease-out;">
                <div style="padding: 1rem 1.5rem; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; background: #fff;">
                    <h3 style="margin: 0; font-size: 1.2rem; color: #333;">使用说明</h3>
                    <button id="close-manual" style="border: none; background: none; font-size: 1.8rem; cursor: pointer; color: #999; line-height: 1;">&times;</button>
                </div>
                <div id="manual-content" style="flex: 1; overflow-y: auto; padding: 2rem; background: #fff; line-height: 1.6; color: #333;">
                    <div style="text-align: center; color: #888;">加载中...</div>
                </div>
            </div>
        `;

        document.body.appendChild(div);

        div.addEventListener('click', (e) => {
            if (e.target === div) close();
        });
        div.querySelector('#close-manual').onclick = close;

        modal = div;
    }

    async function loadContent() {
        const contentDiv = modal.querySelector('#manual-content');
        contentDiv.innerHTML = '<div style="text-align: center; color: #888;">加载中...</div>';
        
        try {
            const res = await fetch('/api/manual');
            const data = await res.json();
            
            if (data.success && data.content) {
                contentDiv.innerHTML = data.content;
            } else {
                contentDiv.innerHTML = '<div style="text-align: center; color: #666; padding-top: 2rem;">暂无使用说明</div>';
            }
        } catch (e) {
            contentDiv.innerHTML = '<div style="text-align: center; color: #ff4d4f;">加载失败</div>';
        }
    }

    function open() {
        if (!modal) init();
        modal.style.display = 'flex';
        loadContent();
    }

    function close() {
        if (modal) modal.style.display = 'none';
    }

    return {
        open
    };
})();
