// 企业微信通知配置前端交互脚本

document.addEventListener('DOMContentLoaded', function () {
    // 元素引用
    const callbackForm = document.getElementById('callbackForm');
    const configForm = document.getElementById('configForm');
    const validateBtn = document.getElementById('validateBtn');
    const userListSection = document.getElementById('userListSection');
    const userList = document.getElementById('userList');
    const lookupForm = document.getElementById('lookupForm');
    const lookupResultDiv = document.getElementById('lookup-result');
    const resultDiv = document.getElementById('result');
    const saveAlert = document.getElementById('save-alert');
    const step1Container = document.getElementById('step1-container');
    const step2Container = document.getElementById('step2-container');
    const callbackResult = document.getElementById('callbackResult');

    let usersCache = [];
    let currentCode = null; // 存储当前的code

    // 第一步：生成回调URL
    callbackForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        resultDiv.innerHTML = '';

        const corpid = callbackForm.corpid.value.trim();
        const callbackToken = callbackForm.callback_token.value.trim();
        const encodingAesKey = callbackForm.encoding_aes_key.value.trim();

        if (!corpid || !callbackToken || !encodingAesKey) {
            showError('请填写所有必填项');
            return;
        }
        if (encodingAesKey.length !== 43) {
            showError('EncodingAESKey必须是43位字符');
            return;
        }

        const submitBtn = callbackForm.querySelector('button[type=submit]');
        submitBtn.disabled = true;
        submitBtn.textContent = '生成中...';

        try {
            const res = await fetch('/api/generate-callback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    corpid,
                    callback_token: callbackToken,
                    encoding_aes_key: encodingAesKey
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || '生成失败');

            currentCode = data.code;
            showCallbackResult(data);

            // 显示第二步
            step2Container.classList.remove('hidden');
            gsap.from(step2Container, { opacity: 0, y: 20, duration: 0.5 });

            // 将CorpID传递到第二步
            configForm.corpid = { value: corpid };

        } catch (err) {
            showError('生成回调URL失败: ' + err.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = '生成回调URL';
        }
    });

    // 验证并获取成员列表
    validateBtn.addEventListener('click', async function (e) {
        e.preventDefault();
        resultDiv.innerHTML = '';
        userList.innerHTML = '';
        userListSection.classList.add('hidden');

        const corpid = callbackForm.corpid.value.trim(); // 从第一步获取
        const corpsecret = configForm.corpsecret.value.trim();
        if (!corpid || !corpsecret) {
            showError('请填写CorpSecret');
            return;
        }
        validateBtn.disabled = true;
        validateBtn.textContent = '验证中...';
        try {
            const res = await fetch('/api/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ corpid, corpsecret })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || '验证失败');
            usersCache = data.users || [];
            if (usersCache.length === 0) {
                showError('未获取到任何成员');
                return;
            }
            userList.innerHTML = usersCache.map(user =>
                `<label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" class="checkbox checkbox-sm" value="${user.userid}">
                    <span>${user.name} <span class="text-xs text-gray-400">(${user.userid})</span></span>
                </label>`
            ).join('');
            userListSection.classList.remove('hidden');
            gsap.from(userListSection, { opacity: 0, y: 20, duration: 0.5 });
        } catch (err) {
            showError(err.message);
        } finally {
            validateBtn.disabled = false;
            validateBtn.textContent = '验证并获取成员列表';
        }
    });

    // 查找配置
    lookupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const code = lookupForm.code.value.trim();
        if (!code) return;

        lookupResultDiv.innerHTML = '<div class="loading loading-spinner loading-md mx-auto"></div>';

        try {
            const res = await fetch(`/api/configuration/${code}`);
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || '查找配置失败');

            // 显示配置信息
            const apiUrl = `/api/notify/${data.code}`;
            lookupResultDiv.innerHTML = `
                <div class="card bg-base-100 shadow-md">
                    <div class="card-body">
                        <h2 class="card-title flex items-center gap-2">
                            <i data-lucide="settings" class="h-5 w-5"></i>
                            配置详情
                        </h2>
                        <div class="space-y-2 mt-2">
                            <p><span class="font-medium">CorpID:</span> ${data.corpid}</p>
                            <p><span class="font-medium">AgentID:</span> ${data.agentid}</p>
                            <p><span class="font-medium">接收用户:</span> ${data.touser.join(', ')}</p>
                            <p><span class="font-medium">描述:</span> ${data.description || '无'}</p>
                            <p><span class="font-medium">回调状态:</span> ${data.callback_enabled ? '已启用' : '未启用'}</p>
                            ${data.callback_enabled ? `<p><span class="font-medium">回调Token:</span> ${data.callback_token || '未设置'}</p>` : ''}
                            <p><span class="font-medium">创建时间:</span> ${new Date(data.created_at).toLocaleString()}</p>
                        </div>
                        <div class="card-actions justify-end mt-4">
                            <button class="btn btn-primary btn-sm" id="edit-config-btn" data-code="${data.code}">
                                <i data-lucide="edit" class="h-4 w-4"></i>
                                编辑配置
                            </button>
                            <button class="btn btn-outline btn-sm" id="copy-api-btn" data-code="${data.code}">
                                <i data-lucide="copy" class="h-4 w-4"></i>
                                复制API地址
                            </button>
                        </div>

                        <div class="divider">API使用说明</div>

                        <div class="space-y-4">
                            <div>
                                <h3 class="font-medium mb-2">请求方式</h3>
                                <div class="bg-base-200 p-3 rounded-md">
                                    <code class="text-sm">POST ${apiUrl}</code>
                                </div>
                            </div>

                            <div>
                                <h3 class="font-medium mb-2">请求头</h3>
                                <div class="bg-base-200 p-3 rounded-md">
                                    <code class="text-sm">Content-Type: application/json</code>
                                </div>
                            </div>

                            <div>
                                <h3 class="font-medium mb-2">请求参数</h3>
                                <div class="overflow-x-auto">
                                    <table class="table table-zebra w-full">
                                        <thead>
                                            <tr>
                                                <th>参数名</th>
                                                <th>类型</th>
                                                <th>必填</th>
                                                <th>说明</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                <td class="font-mono">title</td>
                                                <td>String</td>
                                                <td>否</td>
                                                <td>消息标题，可选</td>
                                            </tr>
                                            <tr>
                                                <td class="font-mono">content</td>
                                                <td>String</td>
                                                <td>是</td>
                                                <td>消息内容，必填</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div>
                                <h3 class="font-medium mb-2">请求示例</h3>
                                <div class="bg-base-200 p-3 rounded-md">
<pre class="text-sm whitespace-pre-wrap">curl -X POST "${apiUrl}" \\
-H "Content-Type: application/json" \\
-d '{
  "title": "服务器告警",
  "content": "CPU使用率超过90%，请及时处理！"
}'</pre>
                                </div>
                            </div>

                            <div>
                                <h3 class="font-medium mb-2">返回示例</h3>
                                <div class="bg-base-200 p-3 rounded-md">
<pre class="text-sm whitespace-pre-wrap">{
  "message": "发送成功",
  "response": {
    "errcode": 0,
    "errmsg": "ok",
    "msgid": "MSGID1234567890"
  }
}</pre>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            lucide.createIcons();
            gsap.from(lookupResultDiv.firstElementChild, { opacity: 0, y: 20, duration: 0.5 });

            // 绑定编辑和复制按钮事件
            document.getElementById('edit-config-btn').addEventListener('click', (e) => {
                const code = e.currentTarget.dataset.code;
                // 这里可以添加编辑功能的实现
                showToast('编辑功能待实现');
            });

            document.getElementById('copy-api-btn').addEventListener('click', (e) => {
                const code = e.currentTarget.dataset.code;
                navigator.clipboard.writeText(`/api/notify/${code}`);
                showToast('API地址已复制到剪贴板');
            });

        } catch (err) {
            lookupResultDiv.innerHTML = `
                <div class="alert alert-error">
                    <i data-lucide="alert-circle" class="h-5 w-5"></i>
                    <span>${err.message}</span>
                </div>
            `;
            lucide.createIcons();
        }
    });

    // 第二步：完善配置
    configForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        resultDiv.innerHTML = '';

        if (!currentCode) {
            showError('请先完成第一步生成回调URL');
            return;
        }

        const corpsecret = configForm.corpsecret.value.trim();
        const agentid = configForm.agentid.value.trim();
        const description = configForm.description.value.trim();
        const checked = userListSection.classList.contains('hidden')
            ? []
            : Array.from(userList.querySelectorAll('input[type=checkbox]:checked')).map(cb => cb.value);
        if (!corpsecret || !agentid || checked.length === 0) {
            showError('请填写所有必填项并选择至少一个成员');
            return;
        }

        const payload = {
            code: currentCode,
            corpsecret,
            agentid: Number(agentid),
            touser: checked,
            description
        };
        configForm.querySelector('button[type=submit]').disabled = true;
        configForm.querySelector('button[type=submit]').textContent = '完成中...';
        try {
            const res = await fetch('/api/complete-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || '完成失败');
            showFinalResult(data);

            // 显示一次性保存提醒
            saveAlert.classList.remove('hidden');
            gsap.from(saveAlert, { opacity: 0, y: -50, duration: 0.5 });
            setTimeout(() => {
                gsap.to(saveAlert, { opacity: 0, y: -50, duration: 0.5, onComplete: () => {
                    saveAlert.classList.add('hidden');
                    saveAlert.style.opacity = 1;
                    saveAlert.style.transform = 'none';
                }});
            }, 5000);
        } catch (err) {
            showError(err.message);
        } finally {
            configForm.querySelector('button[type=submit]').disabled = false;
            configForm.querySelector('button[type=submit]').textContent = '完成配置';
        }
    });

    function showError(msg) {
        resultDiv.innerHTML = `<div class="alert alert-error"><span>${msg}</span></div>`;
        gsap.from(resultDiv, { opacity: 0, y: 20, duration: 0.5 });
    }

    function showCallbackResult(data) {
        const isUpdate = data.message && data.message.includes('更新');
        const statusMessage = isUpdate ?
            `<div class="alert alert-warning mb-4">
                <i data-lucide="refresh-cw" class="h-5 w-5"></i>
                <div>${data.message}</div>
            </div>` : '';

        callbackResult.innerHTML = `
            <div class="card bg-base-100 shadow-md">
                <div class="card-body">
                    <h2 class="card-title text-primary flex items-center gap-2">
                        <i data-lucide="check-circle" class="h-6 w-6"></i>
                        回调URL${isUpdate ? '更新' : '生成'}成功！
                    </h2>

                    ${statusMessage}

                    <div class="space-y-4 mt-4">
                        <div>
                            <div class="font-medium">您的配置Code</div>
                            <div class="bg-base-200 p-2 rounded-md font-mono text-sm overflow-x-auto">${data.code}</div>
                        </div>
                        <div>
                            <div class="font-medium">回调URL</div>
                            <div class="bg-base-200 p-2 rounded-md font-mono text-sm overflow-x-auto">${window.location.origin}${data.callbackUrl}</div>
                            <button class="btn btn-sm btn-outline mt-1" id="copy-callback-url-btn">
                                <i data-lucide="copy" class="h-4 w-4 mr-1"></i>复制回调URL
                            </button>
                        </div>
                    </div>

                    <div class="alert alert-info mt-4">
                        <i data-lucide="info" class="h-5 w-5"></i>
                        <div>
                            <div class="font-medium">下一步操作</div>
                            <div class="text-sm">
                                1. 复制上方回调URL到企业微信管理后台<br>
                                2. 配置IP白名单（添加您的服务器IP）<br>
                                3. 完成下方第二步配置
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 绑定复制按钮事件
        document.getElementById('copy-callback-url-btn').addEventListener('click', () => {
            navigator.clipboard.writeText(window.location.origin + data.callbackUrl);
            showToast('回调URL已复制到剪贴板');
        });

        callbackResult.classList.remove('hidden');
        lucide.createIcons();
        gsap.from(callbackResult.firstElementChild, { opacity: 0, y: 20, duration: 0.5 });
    }

    function showFinalResult(data) {
        const isUpdate = data.message && data.message.includes('更新');
        const statusMessage = isUpdate ?
            `<div class="alert alert-warning mb-4">
                <i data-lucide="refresh-cw" class="h-5 w-5"></i>
                <div>${data.message}</div>
            </div>` : '';

        resultDiv.innerHTML = `
            <div class="card bg-base-100 shadow-md">
                <div class="card-body">
                    <h2 class="card-title text-success flex items-center gap-2">
                        <i data-lucide="check-circle-2" class="h-6 w-6"></i>
                        配置${isUpdate ? '更新' : '完成'}！
                    </h2>

                    ${statusMessage}

                    <div class="space-y-4 mt-4">
                        <div>
                            <div class="font-medium">配置Code</div>
                            <div class="bg-base-200 p-2 rounded-md font-mono text-sm overflow-x-auto">${data.code}</div>
                        </div>
                        <div>
                            <div class="font-medium">通知API地址</div>
                            <div class="bg-base-200 p-2 rounded-md font-mono text-sm overflow-x-auto">${window.location.origin}${data.apiUrl}</div>
                            <button class="btn btn-sm btn-outline mt-1" id="copy-api-url-btn">
                                <i data-lucide="copy" class="h-4 w-4 mr-1"></i>复制API地址
                            </button>
                        </div>
                        <div>
                            <div class="font-medium">回调地址</div>
                            <div class="bg-base-200 p-2 rounded-md font-mono text-sm overflow-x-auto">${window.location.origin}${data.callbackUrl}</div>
                        </div>
                    </div>

                    <div class="alert alert-success mt-4">
                        <i data-lucide="check" class="h-5 w-5"></i>
                        <span>配置已${isUpdate ? '更新' : '完成'}！您现在可以使用API发送通知，也可以接收企业微信回调消息。</span>
                    </div>
                </div>
            </div>
        `;

        // 绑定复制按钮事件
        document.getElementById('copy-api-url-btn').addEventListener('click', () => {
            navigator.clipboard.writeText(window.location.origin + data.apiUrl);
            showToast('API地址已复制到剪贴板');
        });

        lucide.createIcons();
        gsap.from(resultDiv.firstElementChild, { opacity: 0, y: 20, duration: 0.5 });
    }
    function showResult(data) {
        resultDiv.innerHTML = `
            <div class="card bg-base-100 shadow-md">
                <div class="card-body">
                    <h2 class="card-title text-primary flex items-center gap-2">
                        <i data-lucide="check-circle" class="h-6 w-6"></i>
                        API生成成功！
                    </h2>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div class="space-y-2">
                            <div class="font-medium">您的唯一调用ID</div>
                            <div class="bg-base-200 p-2 rounded-md font-mono text-sm overflow-x-auto">${data.code}</div>
                        </div>
                        <div class="space-y-2">
                            <div class="font-medium">API地址</div>
                            <div class="bg-base-200 p-2 rounded-md font-mono text-sm overflow-x-auto">${data.apiUrl}</div>
                            <button class="btn btn-sm btn-outline mt-1" id="copy-new-api-btn">
                                <i data-lucide="copy" class="h-4 w-4 mr-1"></i>复制
                            </button>
                        </div>
                        ${data.callbackUrl ? `
                        <div class="space-y-2 md:col-span-2">
                            <div class="font-medium">回调地址</div>
                            <div class="bg-base-200 p-2 rounded-md font-mono text-sm overflow-x-auto">${data.callbackUrl}</div>
                            <button class="btn btn-sm btn-outline mt-1" id="copy-callback-btn">
                                <i data-lucide="copy" class="h-4 w-4 mr-1"></i>复制回调地址
                            </button>
                            <div class="text-sm text-base-content/60 mt-1">
                                <i data-lucide="info" class="h-4 w-4 inline mr-1"></i>
                                在企业微信管理后台配置此回调地址以接收消息
                            </div>
                        </div>
                        ` : ''}
                    </div>

                    <div class="divider">API使用说明</div>

                    <div class="space-y-4">
                        <div>
                            <h3 class="font-medium mb-2">请求方式</h3>
                            <div class="bg-base-200 p-3 rounded-md">
                                <code class="text-sm">POST ${data.apiUrl}</code>
                            </div>
                        </div>

                        <div>
                            <h3 class="font-medium mb-2">请求头</h3>
                            <div class="bg-base-200 p-3 rounded-md">
                                <code class="text-sm">Content-Type: application/json</code>
                            </div>
                        </div>

                        <div>
                            <h3 class="font-medium mb-2">请求参数</h3>
                            <div class="overflow-x-auto">
                                <table class="table table-zebra w-full">
                                    <thead>
                                        <tr>
                                            <th>参数名</th>
                                            <th>类型</th>
                                            <th>必填</th>
                                            <th>说明</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td class="font-mono">title</td>
                                            <td>String</td>
                                            <td>否</td>
                                            <td>消息标题，可选</td>
                                        </tr>
                                        <tr>
                                            <td class="font-mono">content</td>
                                            <td>String</td>
                                            <td>是</td>
                                            <td>消息内容，必填</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div>
                            <h3 class="font-medium mb-2">请求示例</h3>
                            <div class="bg-base-200 p-3 rounded-md">
<pre class="text-sm whitespace-pre-wrap">curl -X POST "${data.apiUrl}" \\
-H "Content-Type: application/json" \\
-d '{
  "title": "服务器告警",
  "content": "CPU使用率超过90%，请及时处理！"
}'</pre>
                            </div>
                        </div>

                        <div>
                            <h3 class="font-medium mb-2">返回示例</h3>
                            <div class="bg-base-200 p-3 rounded-md">
<pre class="text-sm whitespace-pre-wrap">{
  "message": "发送成功",
  "response": {
    "errcode": 0,
    "errmsg": "ok",
    "msgid": "MSGID1234567890"
  }
}</pre>
                            </div>
                        </div>
                    </div>

                    <div class="alert alert-warning mt-4">
                        <i data-lucide="alert-triangle" class="h-5 w-5"></i>
                        <span>请妥善保存您的配置Code，它是调用API的唯一凭证。出于安全考虑，它只会显示一次！</span>
                    </div>
                </div>
            </div>
        `;

        // 绑定复制按钮事件
        document.getElementById('copy-new-api-btn').addEventListener('click', () => {
            navigator.clipboard.writeText(data.apiUrl);
            showToast('API地址已复制到剪贴板');
        });

        // 绑定回调地址复制按钮事件（如果存在）
        if (data.callbackUrl) {
            document.getElementById('copy-callback-btn').addEventListener('click', () => {
                navigator.clipboard.writeText(window.location.origin + data.callbackUrl);
                showToast('回调地址已复制到剪贴板');
            });
        }

        // 创建图标
        lucide.createIcons();

        gsap.from(resultDiv, { opacity: 0, y: 20, duration: 0.5 });
    }

    // 显示提示消息
    function showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast toast-top toast-center';
        toast.innerHTML = `
            <div class="alert alert-info">
                <span>${message}</span>
            </div>
        `;
        document.body.appendChild(toast);

        gsap.fromTo(toast, 
            { opacity: 0, y: -20 }, 
            { opacity: 1, y: 0, duration: 0.3 }
        );

        setTimeout(() => {
            gsap.to(toast, { 
                opacity: 0, 
                y: -20, 
                duration: 0.3,
                onComplete: () => toast.remove()
            });
        }, 3000);
    }
}); 
