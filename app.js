/**
 * Sales Data Comparator - 销售数据对比系统
 */

const COLOR_PALETTE = [
    '#E3F2FD', '#FFF3E0', '#E8F5E9', '#FCE4EC',
    '#F3E5F5', '#E0F7FA', '#FFF8E1', '#EFEBE9',
];

const STORAGE_KEY = 'sales_data_comparator_data';
const AUTH_TOKEN_KEY = 'sales_data_auth_token';
const AUTH_USER_KEY = 'sales_data_auth_user';
const API_BASE_URL = 'http://localhost:3000/api';

// ============================================
// AuthManager Module - 用户认证管理
// Requirements: 1.1, 2.1, 3.1, 2.4
// ============================================
const AuthManager = {
    currentUser: null,
    token: null,

    /**
     * 验证用户名
     * @param {string} username - 用户名
     * @returns {{ valid: boolean, error?: string }}
     */
    validateUsername(username) {
        if (!username || typeof username !== 'string') {
            return { valid: false, error: '请输入有效用户名' };
        }
        const trimmed = username.trim();
        if (trimmed.length === 0) {
            return { valid: false, error: '请输入有效用户名' };
        }
        return { valid: true };
    },

    /**
     * 验证密码
     * @param {string} password - 密码
     * @returns {{ valid: boolean, error?: string }}
     */
    validatePassword(password) {
        if (!password || typeof password !== 'string') {
            return { valid: false, error: '密码长度至少6位' };
        }
        if (password.length < 6) {
            return { valid: false, error: '密码长度至少6位' };
        }
        return { valid: true };
    },

    /**
     * 用户注册
     * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
     * @param {string} username - 用户名
     * @param {string} password - 密码
     * @returns {Promise<{ success: boolean, error?: string }>}
     */
    async register(username, password) {
        // 前端验证
        const usernameValidation = this.validateUsername(username);
        if (!usernameValidation.valid) {
            return { success: false, error: usernameValidation.error };
        }

        const passwordValidation = this.validatePassword(password);
        if (!passwordValidation.valid) {
            return { success: false, error: passwordValidation.error };
        }

        try {
            const response = await fetch(`${API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username: username.trim(), password })
            });

            const data = await response.json();

            if (data.success && data.token) {
                this.token = data.token;
                this.currentUser = data.user || { username: username.trim() };
                this._saveSession();
                return { success: true };
            }

            return { success: false, error: data.error || '注册失败' };
        } catch (error) {
            console.error('注册请求失败:', error);
            return { success: false, error: '网络错误，请稍后重试' };
        }
    },

    /**
     * 用户登录
     * Requirements: 2.1, 2.2
     * @param {string} username - 用户名
     * @param {string} password - 密码
     * @returns {Promise<{ success: boolean, error?: string }>}
     */
    async login(username, password) {
        // 前端验证
        const usernameValidation = this.validateUsername(username);
        if (!usernameValidation.valid) {
            return { success: false, error: usernameValidation.error };
        }

        const passwordValidation = this.validatePassword(password);
        if (!passwordValidation.valid) {
            return { success: false, error: passwordValidation.error };
        }

        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username: username.trim(), password })
            });

            const data = await response.json();

            if (data.success && data.token) {
                this.token = data.token;
                this.currentUser = data.user;
                this._saveSession();
                return { success: true };
            }

            return { success: false, error: data.error || '登录失败' };
        } catch (error) {
            console.error('登录请求失败:', error);
            return { success: false, error: '网络错误，请稍后重试' };
        }
    },

    /**
     * 用户登出
     * Requirements: 3.1, 3.2
     */
    logout() {
        this.token = null;
        this.currentUser = null;
        this._clearSession();
    },

    /**
     * 检查是否已登录
     * @returns {boolean}
     */
    isLoggedIn() {
        return this.token !== null && this.currentUser !== null;
    },

    /**
     * 获取当前用户
     * @returns {{ username: string } | null}
     */
    getCurrentUser() {
        return this.currentUser;
    },

    /**
     * 获取当前 token
     * @returns {string | null}
     */
    getToken() {
        return this.token;
    },

    /**
     * 恢复会话（从 localStorage 读取 token）
     * Requirements: 2.4
     * @returns {Promise<boolean>}
     */
    async restoreSession() {
        try {
            const savedToken = localStorage.getItem(AUTH_TOKEN_KEY);
            const savedUser = localStorage.getItem(AUTH_USER_KEY);

            if (!savedToken || !savedUser) {
                return false;
            }

            // 验证 token 是否有效
            const response = await fetch(`${API_BASE_URL}/auth/me`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${savedToken}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.token = savedToken;
                this.currentUser = data.user || JSON.parse(savedUser);
                return true;
            }

            // Token 无效，清除本地存储
            this._clearSession();
            return false;
        } catch (error) {
            console.error('恢复会话失败:', error);
            this._clearSession();
            return false;
        }
    },

    /**
     * 保存会话到 localStorage
     * @private
     */
    _saveSession() {
        if (this.token) {
            localStorage.setItem(AUTH_TOKEN_KEY, this.token);
        }
        if (this.currentUser) {
            localStorage.setItem(AUTH_USER_KEY, JSON.stringify(this.currentUser));
        }
    },

    /**
     * 清除本地会话
     * @private
     */
    _clearSession() {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem(AUTH_USER_KEY);
    }
};

// ============================================
// CloudSyncManager Module - 云端数据同步
// Requirements: 4.1, 4.2, 4.4, 5.2
// ============================================
const CloudSyncManager = {
    syncStatus: 'idle', // 'idle' | 'syncing' | 'error' | 'offline'
    lastSyncTime: null,
    
    /**
     * 获取同步状态
     * @returns {string}
     */
    getSyncStatus() {
        return this.syncStatus;
    },
    
    /**
     * 设置同步状态
     * @param {string} status
     * @private
     */
    _setSyncStatus(status) {
        this.syncStatus = status;
        // 触发状态更新事件（供UI使用）
        if (typeof window !== 'undefined' && window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('syncStatusChange', { detail: { status } }));
        }
    },
    
    /**
     * 检查网络状态
     * @returns {boolean}
     */
    isOnline() {
        if (typeof navigator !== 'undefined') {
            return navigator.onLine;
        }
        return true;
    },
    
    /**
     * 获取认证头
     * @returns {Object}
     * @private
     */
    _getAuthHeaders() {
        const token = AuthManager.getToken();
        return {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
        };
    },
    
    /**
     * 上传销售数据到云端
     * Requirements: 4.1
     * @param {Object} monthData - 月度销售数据
     * @returns {Promise<{ success: boolean, id?: string, error?: string }>}
     */
    async uploadData(monthData) {
        if (!AuthManager.isLoggedIn()) {
            return { success: false, error: '请先登录' };
        }
        
        if (!this.isOnline()) {
            this._setSyncStatus('offline');
            // 离线时保存到待同步队列
            LocalCacheManager.addPendingOperation({
                type: 'upload',
                data: monthData,
                timestamp: Date.now()
            });
            return { success: false, error: '网络离线，数据已保存到本地' };
        }
        
        this._setSyncStatus('syncing');
        
        try {
            const response = await fetch(`${API_BASE_URL}/data`, {
                method: 'POST',
                headers: this._getAuthHeaders(),
                body: JSON.stringify({ monthData })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this._setSyncStatus('idle');
                this.lastSyncTime = new Date();
                return { success: true, id: data.id };
            }
            
            this._setSyncStatus('error');
            return { success: false, error: data.error || '上传失败' };
        } catch (error) {
            console.error('上传数据失败:', error);
            this._setSyncStatus('error');
            // 网络错误时保存到待同步队列
            LocalCacheManager.addPendingOperation({
                type: 'upload',
                data: monthData,
                timestamp: Date.now()
            });
            return { success: false, error: '网络错误，数据已保存到本地' };
        }
    },
    
    /**
     * 删除云端数据
     * Requirements: 4.2
     * @param {string} monthId - 月份数据ID
     * @returns {Promise<{ success: boolean, error?: string }>}
     */
    async deleteData(monthId) {
        if (!AuthManager.isLoggedIn()) {
            return { success: false, error: '请先登录' };
        }
        
        if (!this.isOnline()) {
            this._setSyncStatus('offline');
            // 离线时保存到待同步队列
            LocalCacheManager.addPendingOperation({
                type: 'delete',
                monthId: monthId,
                timestamp: Date.now()
            });
            return { success: false, error: '网络离线，操作已保存到本地' };
        }
        
        this._setSyncStatus('syncing');
        
        try {
            const response = await fetch(`${API_BASE_URL}/data/${monthId}`, {
                method: 'DELETE',
                headers: this._getAuthHeaders()
            });
            
            const data = await response.json();
            
            if (data.success) {
                this._setSyncStatus('idle');
                this.lastSyncTime = new Date();
                return { success: true };
            }
            
            this._setSyncStatus('error');
            return { success: false, error: data.error || '删除失败' };
        } catch (error) {
            console.error('删除数据失败:', error);
            this._setSyncStatus('error');
            // 网络错误时保存到待同步队列
            LocalCacheManager.addPendingOperation({
                type: 'delete',
                monthId: monthId,
                timestamp: Date.now()
            });
            return { success: false, error: '网络错误，操作已保存到本地' };
        }
    },
    
    /**
     * 下载所有用户数据
     * Requirements: 4.4
     * @returns {Promise<{ success: boolean, data?: array, error?: string }>}
     */
    async downloadAllData() {
        if (!AuthManager.isLoggedIn()) {
            return { success: false, error: '请先登录' };
        }
        
        if (!this.isOnline()) {
            this._setSyncStatus('offline');
            // 离线时返回本地缓存
            const cachedData = LocalCacheManager.getCachedData(AuthManager.getCurrentUser()?.id);
            if (cachedData && cachedData.length > 0) {
                return { success: true, data: cachedData };
            }
            return { success: false, error: '网络离线，无本地缓存数据' };
        }
        
        this._setSyncStatus('syncing');
        
        try {
            const response = await fetch(`${API_BASE_URL}/data`, {
                method: 'GET',
                headers: this._getAuthHeaders()
            });
            
            const result = await response.json();
            
            if (result.success) {
                this._setSyncStatus('idle');
                this.lastSyncTime = new Date();
                
                // 缓存数据到本地
                const userId = AuthManager.getCurrentUser()?.id;
                if (userId) {
                    LocalCacheManager.cacheData(userId, result.data || []);
                }
                
                return { success: true, data: result.data || [] };
            }
            
            this._setSyncStatus('error');
            return { success: false, error: result.error || '下载失败' };
        } catch (error) {
            console.error('下载数据失败:', error);
            this._setSyncStatus('error');
            // 网络错误时返回本地缓存
            const cachedData = LocalCacheManager.getCachedData(AuthManager.getCurrentUser()?.id);
            if (cachedData && cachedData.length > 0) {
                return { success: true, data: cachedData };
            }
            return { success: false, error: '网络错误' };
        }
    },
    
    /**
     * 同步待处理的操作（网络恢复后调用）
     * Requirements: 5.2
     * @returns {Promise<{ success: boolean, synced: number, failed: number }>}
     */
    async syncPendingOperations() {
        if (!this.isOnline()) {
            return { success: false, synced: 0, failed: 0 };
        }
        
        const pendingOps = LocalCacheManager.getPendingOperations();
        if (pendingOps.length === 0) {
            return { success: true, synced: 0, failed: 0 };
        }
        
        this._setSyncStatus('syncing');
        let synced = 0;
        let failed = 0;
        
        for (const op of pendingOps) {
            try {
                if (op.type === 'upload') {
                    const result = await this.uploadData(op.data);
                    if (result.success) synced++;
                    else failed++;
                } else if (op.type === 'delete') {
                    const result = await this.deleteData(op.monthId);
                    if (result.success) synced++;
                    else failed++;
                }
            } catch (error) {
                failed++;
            }
        }
        
        // 清除已同步的操作
        if (synced > 0) {
            LocalCacheManager.clearPendingOperations();
        }
        
        this._setSyncStatus(failed > 0 ? 'error' : 'idle');
        return { success: failed === 0, synced, failed };
    },
    
    /**
     * 初始化网络状态监听
     */
    initNetworkListener() {
        if (typeof window !== 'undefined') {
            window.addEventListener('online', () => {
                this._setSyncStatus('idle');
                // 网络恢复后自动同步待处理操作
                this.syncPendingOperations();
            });
            
            window.addEventListener('offline', () => {
                this._setSyncStatus('offline');
            });
        }
    }
};

// ============================================
// LocalCacheManager Module - 本地缓存管理
// Requirements: 5.2, 5.3
// ============================================
const LocalCacheManager = {
    CACHE_KEY_PREFIX: 'sales_data_cache_',
    PENDING_OPS_KEY: 'sales_data_pending_ops',
    
    /**
     * 缓存数据到本地
     * @param {string|number} userId - 用户ID
     * @param {Array} data - 数据数组
     */
    cacheData(userId, data) {
        if (!userId) return;
        try {
            const key = this.CACHE_KEY_PREFIX + userId;
            const serialized = JSON.stringify(data.map(d => ({
                ...d,
                importedAt: d.importedAt instanceof Date ? d.importedAt.toISOString() : d.importedAt
            })));
            localStorage.setItem(key, serialized);
        } catch (e) {
            console.error('缓存数据失败:', e);
        }
    },
    
    /**
     * 获取缓存数据
     * @param {string|number} userId - 用户ID
     * @returns {Array}
     */
    getCachedData(userId) {
        if (!userId) return [];
        try {
            const key = this.CACHE_KEY_PREFIX + userId;
            const serialized = localStorage.getItem(key);
            if (!serialized) return [];
            const data = JSON.parse(serialized);
            return data.map(d => ({
                ...d,
                importedAt: new Date(d.importedAt)
            }));
        } catch (e) {
            console.error('读取缓存失败:', e);
            return [];
        }
    },
    
    /**
     * 记录待同步操作
     * @param {Object} operation - 操作对象 { type: 'upload'|'delete', data?: Object, monthId?: string, timestamp: number }
     */
    addPendingOperation(operation) {
        try {
            const ops = this.getPendingOperations();
            ops.push(operation);
            localStorage.setItem(this.PENDING_OPS_KEY, JSON.stringify(ops));
        } catch (e) {
            console.error('保存待同步操作失败:', e);
        }
    },
    
    /**
     * 获取待同步操作
     * @returns {Array}
     */
    getPendingOperations() {
        try {
            const serialized = localStorage.getItem(this.PENDING_OPS_KEY);
            if (!serialized) return [];
            return JSON.parse(serialized);
        } catch (e) {
            console.error('读取待同步操作失败:', e);
            return [];
        }
    },
    
    /**
     * 清除待同步操作
     */
    clearPendingOperations() {
        try {
            localStorage.removeItem(this.PENDING_OPS_KEY);
        } catch (e) {
            console.error('清除待同步操作失败:', e);
        }
    },
    
    /**
     * 清除用户缓存
     * @param {string|number} userId - 用户ID
     */
    clearUserCache(userId) {
        if (!userId) return;
        try {
            const key = this.CACHE_KEY_PREFIX + userId;
            localStorage.removeItem(key);
        } catch (e) {
            console.error('清除用户缓存失败:', e);
        }
    },
    
    /**
     * 清除所有缓存（登出时调用）
     */
    clearAllCache() {
        try {
            // 清除所有以 CACHE_KEY_PREFIX 开头的缓存
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(this.CACHE_KEY_PREFIX)) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));
            
            // 清除待同步操作
            this.clearPendingOperations();
        } catch (e) {
            console.error('清除所有缓存失败:', e);
        }
    }
};

// ============================================
// AuthUI Module - 认证界面管理
// Requirements: 6.1, 6.2, 3.3
// ============================================
const AuthUI = {
    /**
     * 显示登录表单
     * Requirements: 6.2
     */
    showLoginForm() {
        const modal = document.getElementById('auth-modal');
        const title = document.getElementById('auth-modal-title');
        const loginForm = document.getElementById('login-form');
        const registerForm = document.getElementById('register-form');
        
        if (modal && title && loginForm && registerForm) {
            title.textContent = '登录';
            loginForm.style.display = 'flex';
            registerForm.style.display = 'none';
            this.clearFormErrors();
            modal.style.display = 'flex';
        }
    },
    
    /**
     * 显示注册表单
     * Requirements: 6.2
     */
    showRegisterForm() {
        const modal = document.getElementById('auth-modal');
        const title = document.getElementById('auth-modal-title');
        const loginForm = document.getElementById('login-form');
        const registerForm = document.getElementById('register-form');
        
        if (modal && title && loginForm && registerForm) {
            title.textContent = '注册';
            loginForm.style.display = 'none';
            registerForm.style.display = 'flex';
            this.clearFormErrors();
            modal.style.display = 'flex';
        }
    },
    
    /**
     * 隐藏认证表单
     */
    hideAuthForms() {
        const modal = document.getElementById('auth-modal');
        if (modal) {
            modal.style.display = 'none';
            this.clearFormErrors();
            this.clearFormInputs();
        }
    },
    
    /**
     * 清除表单错误信息
     */
    clearFormErrors() {
        const errorElements = document.querySelectorAll('.form-error');
        errorElements.forEach(el => {
            el.textContent = '';
        });
        
        const inputs = document.querySelectorAll('.auth-form input');
        inputs.forEach(input => {
            input.classList.remove('error');
        });
    },
    
    /**
     * 清除表单输入
     */
    clearFormInputs() {
        const inputs = document.querySelectorAll('.auth-form input');
        inputs.forEach(input => {
            input.value = '';
        });
    },
    
    /**
     * 显示表单字段错误
     * @param {string} fieldId - 字段ID
     * @param {string} message - 错误信息
     */
    showFieldError(fieldId, message) {
        const input = document.getElementById(fieldId);
        const errorEl = document.getElementById(`${fieldId}-error`);
        
        if (input) {
            input.classList.add('error');
        }
        if (errorEl) {
            errorEl.textContent = message;
        }
    },
    
    /**
     * 显示通用认证错误
     * @param {string} formType - 'login' 或 'register'
     * @param {string} message - 错误信息
     */
    showAuthError(formType, message) {
        const errorEl = document.getElementById(`${formType}-error`);
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = 'block';
        }
    },
    
    /**
     * 更新头部用户状态显示
     * Requirements: 6.1, 6.2
     * @param {{ username: string } | null} user - 用户对象或null
     */
    updateHeaderUserStatus(user) {
        const loggedOutEl = document.getElementById('user-logged-out');
        const loggedInEl = document.getElementById('user-logged-in');
        const usernameEl = document.getElementById('display-username');
        
        if (!loggedOutEl || !loggedInEl || !usernameEl) return;
        
        if (user) {
            // 已登录状态
            loggedOutEl.style.display = 'none';
            loggedInEl.style.display = 'flex';
            usernameEl.textContent = user.username;
        } else {
            // 未登录状态
            loggedOutEl.style.display = 'flex';
            loggedInEl.style.display = 'none';
            usernameEl.textContent = '';
        }
    },
    
    /**
     * 更新同步状态显示
     * Requirements: 6.3, 6.4
     * @param {string} status - 'idle' | 'syncing' | 'error' | 'offline' | 'synced'
     */
    updateSyncStatus(status) {
        const syncStatusEl = document.getElementById('sync-status');
        const syncIconEl = document.getElementById('sync-icon');
        const syncTextEl = document.getElementById('sync-text');
        
        if (!syncStatusEl || !syncIconEl || !syncTextEl) return;
        
        // 只有登录后才显示同步状态
        if (!AuthManager.isLoggedIn()) {
            syncStatusEl.style.display = 'none';
            return;
        }
        
        syncStatusEl.style.display = 'flex';
        syncStatusEl.className = 'sync-status ' + status;
        
        switch (status) {
            case 'syncing':
                syncIconEl.textContent = '🔄';
                syncTextEl.textContent = '同步中...';
                break;
            case 'synced':
            case 'idle':
                syncIconEl.textContent = '✓';
                syncTextEl.textContent = '已同步';
                syncStatusEl.className = 'sync-status synced';
                break;
            case 'error':
                syncIconEl.textContent = '⚠';
                syncTextEl.textContent = '同步失败';
                break;
            case 'offline':
                syncIconEl.textContent = '📴';
                syncTextEl.textContent = '离线';
                break;
            default:
                syncStatusEl.style.display = 'none';
        }
    },
    
    /**
     * 设置按钮加载状态
     * @param {HTMLElement} button - 按钮元素
     * @param {boolean} loading - 是否加载中
     */
    setButtonLoading(button, loading) {
        if (!button) return;
        
        if (loading) {
            button.classList.add('loading');
            button.disabled = true;
        } else {
            button.classList.remove('loading');
            button.disabled = false;
        }
    },
    
    /**
     * 处理登录表单提交
     * Requirements: 2.1, 2.2
     * @param {Event} e - 表单提交事件
     */
    async handleLoginSubmit(e) {
        e.preventDefault();
        this.clearFormErrors();
        
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        const submitBtn = e.target.querySelector('button[type="submit"]');
        
        // 前端验证
        const usernameValidation = AuthManager.validateUsername(username);
        if (!usernameValidation.valid) {
            this.showFieldError('login-username', usernameValidation.error);
            return;
        }
        
        const passwordValidation = AuthManager.validatePassword(password);
        if (!passwordValidation.valid) {
            this.showFieldError('login-password', passwordValidation.error);
            return;
        }
        
        this.setButtonLoading(submitBtn, true);
        
        try {
            const result = await AuthManager.login(username, password);
            
            if (result.success) {
                this.hideAuthForms();
                this.updateHeaderUserStatus(AuthManager.getCurrentUser());
                this.updateSyncStatus('syncing');
                UI.showMessage('登录成功！', 'success');
                
                // 登录后加载云端数据
                // Requirements: 2.3 - 登录成功后从云端加载数据
                await StateManager.initFromCloud();
                UI.renderMonthsData();
                this.updateSyncStatus('synced');
            } else {
                this.showAuthError('login', result.error || '登录失败');
            }
        } catch (error) {
            this.showAuthError('login', '网络错误，请稍后重试');
        } finally {
            this.setButtonLoading(submitBtn, false);
        }
    },
    
    /**
     * 处理注册表单提交
     * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
     * @param {Event} e - 表单提交事件
     */
    async handleRegisterSubmit(e) {
        e.preventDefault();
        this.clearFormErrors();
        
        const username = document.getElementById('register-username').value;
        const password = document.getElementById('register-password').value;
        const passwordConfirm = document.getElementById('register-password-confirm').value;
        const submitBtn = e.target.querySelector('button[type="submit"]');
        
        // 前端验证
        const usernameValidation = AuthManager.validateUsername(username);
        if (!usernameValidation.valid) {
            this.showFieldError('register-username', usernameValidation.error);
            return;
        }
        
        const passwordValidation = AuthManager.validatePassword(password);
        if (!passwordValidation.valid) {
            this.showFieldError('register-password', passwordValidation.error);
            return;
        }
        
        if (password !== passwordConfirm) {
            this.showFieldError('register-password-confirm', '两次输入的密码不一致');
            return;
        }
        
        this.setButtonLoading(submitBtn, true);
        
        try {
            const result = await AuthManager.register(username, password);
            
            if (result.success) {
                this.hideAuthForms();
                this.updateHeaderUserStatus(AuthManager.getCurrentUser());
                this.updateSyncStatus('synced');
                UI.showMessage('注册成功！', 'success');
            } else {
                this.showAuthError('register', result.error || '注册失败');
            }
        } catch (error) {
            this.showAuthError('register', '网络错误，请稍后重试');
        } finally {
            this.setButtonLoading(submitBtn, false);
        }
    },
    
    /**
     * 处理登出
     * Requirements: 3.1, 3.2, 3.3
     */
    handleLogout() {
        const userId = AuthManager.getCurrentUser()?.id;
        
        // 清除认证状态
        AuthManager.logout();
        
        // 清除本地缓存
        if (userId) {
            LocalCacheManager.clearUserCache(userId);
        }
        LocalCacheManager.clearAllCache();
        
        // 更新UI
        this.updateHeaderUserStatus(null);
        this.updateSyncStatus('idle');
        
        // 清除数据显示，恢复本地存储数据
        StateManager.init();
        UI.renderMonthsData();
        
        UI.showMessage('已登出', 'success');
    },
    
    /**
     * 初始化认证UI事件监听
     */
    initEventListeners() {
        // 显示登录表单按钮
        const showLoginBtn = document.getElementById('show-login-btn');
        if (showLoginBtn) {
            showLoginBtn.addEventListener('click', () => this.showLoginForm());
        }
        
        // 显示注册表单按钮
        const showRegisterBtn = document.getElementById('show-register-btn');
        if (showRegisterBtn) {
            showRegisterBtn.addEventListener('click', () => this.showRegisterForm());
        }
        
        // 登出按钮
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleLogout());
        }
        
        // 关闭认证模态框
        const authModalClose = document.getElementById('auth-modal-close');
        if (authModalClose) {
            authModalClose.addEventListener('click', () => this.hideAuthForms());
        }
        
        // 点击模态框背景关闭
        const authModal = document.getElementById('auth-modal');
        if (authModal) {
            authModal.addEventListener('click', (e) => {
                if (e.target.id === 'auth-modal') {
                    this.hideAuthForms();
                }
            });
        }
        
        // 切换到注册表单
        const switchToRegister = document.getElementById('switch-to-register');
        if (switchToRegister) {
            switchToRegister.addEventListener('click', (e) => {
                e.preventDefault();
                this.showRegisterForm();
            });
        }
        
        // 切换到登录表单
        const switchToLogin = document.getElementById('switch-to-login');
        if (switchToLogin) {
            switchToLogin.addEventListener('click', (e) => {
                e.preventDefault();
                this.showLoginForm();
            });
        }
        
        // 登录表单提交
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLoginSubmit(e));
        }
        
        // 注册表单提交
        const registerForm = document.getElementById('register-form');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => this.handleRegisterSubmit(e));
        }
        
        // 监听同步状态变化
        if (typeof window !== 'undefined') {
            window.addEventListener('syncStatusChange', (e) => {
                this.updateSyncStatus(e.detail.status);
            });
        }
    }
};

// ============================================
// StorageManager Module - 数据持久化
// ============================================
const StorageManager = {
    isAvailable() {
        try {
            const test = '__storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    },

    saveData(data) {
        if (!this.isAvailable()) return false;
        try {
            const serialized = JSON.stringify(data.map(d => ({
                ...d,
                importedAt: d.importedAt.toISOString()
            })));
            localStorage.setItem(STORAGE_KEY, serialized);
            return true;
        } catch (e) {
            console.error('Failed to save data:', e);
            return false;
        }
    },

    loadData() {
        if (!this.isAvailable()) return [];
        try {
            const serialized = localStorage.getItem(STORAGE_KEY);
            if (!serialized) return [];
            const data = JSON.parse(serialized);
            return data.map(d => ({
                ...d,
                importedAt: new Date(d.importedAt)
            }));
        } catch (e) {
            console.error('Failed to load data:', e);
            return [];
        }
    },

    clearData() {
        if (!this.isAvailable()) return;
        localStorage.removeItem(STORAGE_KEY);
    }
};


// ============================================
// FileHandler Module
// ============================================
const FileHandler = {
    async parseExcelFile(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                    
                    if (jsonData.length === 0) {
                        resolve({ columns: [], data: [], error: '文件中没有数据，请检查文件内容' });
                        return;
                    }
                    
                    const columns = jsonData[0].map(col => String(col || '').trim()).filter(col => col);
                    
                    if (columns.length === 0) {
                        resolve({ columns: [], data: [], error: '文件中没有有效的列名' });
                        return;
                    }
                    
                    const dataRows = [];
                    for (let i = 1; i < jsonData.length; i++) {
                        const row = jsonData[i];
                        if (row && row.some(cell => cell !== undefined && cell !== null && cell !== '')) {
                            const rowObj = {};
                            columns.forEach((col, idx) => {
                                rowObj[col] = row[idx] !== undefined ? row[idx] : '';
                            });
                            dataRows.push(rowObj);
                        }
                    }
                    
                    if (dataRows.length === 0) {
                        resolve({ columns, data: [], error: '文件中没有数据行' });
                        return;
                    }
                    
                    resolve({ columns, data: dataRows });
                } catch (err) {
                    resolve({ columns: [], data: [], error: '文件解析失败，请确保文件未损坏' });
                }
            };
            
            reader.onerror = () => {
                resolve({ columns: [], data: [], error: '文件读取失败' });
            };
            
            reader.readAsArrayBuffer(file);
        });
    },
    
    isValidExcelFile(file) {
        const validExtensions = ['.xls', '.xlsx'];
        return validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    }
};

// ============================================
// DataProcessor Module
// ============================================
const DataProcessor = {
    filterColumns(data, selectedColumns) {
        return data.map(row => {
            const filtered = {};
            selectedColumns.forEach(col => {
                if (row.hasOwnProperty(col)) {
                    filtered[col] = row[col];
                }
            });
            return filtered;
        });
    },
    
    groupByCategory(data, categoryColumn) {
        const grouped = {};
        data.forEach(row => {
            const category = String(row[categoryColumn] || '未分类');
            if (!grouped[category]) grouped[category] = [];
            grouped[category].push(row);
        });
        return grouped;
    },
    
    sortBySalesAmount(groupedData, salesColumn) {
        const sorted = {};
        Object.keys(groupedData).forEach(category => {
            sorted[category] = [...groupedData[category]].sort((a, b) => {
                const salesA = parseFloat(a[salesColumn]) || 0;
                const salesB = parseFloat(b[salesColumn]) || 0;
                return salesB - salesA;
            });
        });
        return sorted;
    },
    
    processData(data, config) {
        const filtered = this.filterColumns(data, config.selectedColumns);
        const grouped = this.groupByCategory(filtered, config.categoryColumn);
        return this.sortBySalesAmount(grouped, config.salesColumn);
    }
};


// ============================================
// StateManager Module
// ============================================
const StateManager = {
    monthsData: [],
    colorIndex: 0,
    
    /**
     * 初始化状态管理器
     * 从本地存储加载数据（未登录时使用）
     */
    init() {
        const savedData = StorageManager.loadData();
        if (savedData.length > 0) {
            this.monthsData = savedData;
            this.colorIndex = savedData.length;
        }
    },
    
    /**
     * 从云端初始化数据
     * Requirements: 2.3, 4.4
     * @returns {Promise<boolean>} 是否成功加载云端数据
     */
    async initFromCloud() {
        if (!AuthManager.isLoggedIn()) {
            return false;
        }
        
        try {
            const result = await CloudSyncManager.downloadAllData();
            if (result.success && result.data) {
                this.monthsData = result.data.map(item => ({
                    id: item.id?.toString() || item.monthId || Date.now().toString(),
                    month: item.monthName || item.month,
                    color: item.color || '#E3F2FD',
                    importedAt: item.importedAt ? new Date(item.importedAt) : new Date(),
                    config: item.config || {},
                    groupedData: item.groupedData || {},
                    rawData: item.rawData || []
                }));
                this.colorIndex = this.monthsData.length;
                return true;
            }
            return false;
        } catch (error) {
            console.error('从云端加载数据失败:', error);
            return false;
        }
    },
    
    /**
     * 添加月度数据
     * Requirements: 4.1
     * @param {Object} monthData - 月度销售数据
     */
    async addMonthData(monthData) {
        this.monthsData.push(monthData);
        StorageManager.saveData(this.monthsData);
        
        // 如果已登录，同步到云端
        if (AuthManager.isLoggedIn()) {
            const cloudData = {
                monthId: monthData.id,
                monthName: monthData.month,
                color: monthData.color,
                config: monthData.config,
                groupedData: monthData.groupedData,
                rawData: monthData.rawData
            };
            
            const result = await CloudSyncManager.uploadData(cloudData);
            if (!result.success) {
                console.warn('云端同步失败:', result.error);
                // 数据已保存到本地，离线时会自动加入待同步队列
            }
        }
    },
    
    /**
     * 删除月度数据
     * Requirements: 4.2
     * @param {string} monthId - 月份数据ID
     */
    async removeMonthData(monthId) {
        this.monthsData = this.monthsData.filter(m => m.id !== monthId);
        StorageManager.saveData(this.monthsData);
        
        // 如果已登录，同步删除云端数据
        if (AuthManager.isLoggedIn()) {
            const result = await CloudSyncManager.deleteData(monthId);
            if (!result.success) {
                console.warn('云端删除失败:', result.error);
                // 离线时会自动加入待同步队列
            }
        }
    },
    
    getAllMonthsData() {
        return this.monthsData;
    },
    
    getNextColor() {
        const color = COLOR_PALETTE[this.colorIndex % COLOR_PALETTE.length];
        this.colorIndex++;
        return color;
    },
    
    getProductTrendData(productName) {
        const trendData = [];
        this.monthsData.forEach(monthData => {
            Object.entries(monthData.groupedData).forEach(([category, products]) => {
                products.forEach(product => {
                    const name = product[monthData.config.productNameColumn];
                    if (name === productName) {
                        trendData.push({
                            month: monthData.month,
                            salesAmount: parseFloat(product[monthData.config.salesColumn]) || 0,
                            quantity: parseFloat(product[monthData.config.quantityColumn]) || 0,
                            category: category
                        });
                    }
                });
            });
        });
        return trendData;
    },
    
    clear() {
        this.monthsData = [];
        this.colorIndex = 0;
        StorageManager.clearData();
    }
};

// ============================================
// SearchEngine Module
// ============================================
const SearchEngine = {
    search(allData, query) {
        if (!query || query.trim() === '') return [];
        
        const searchTerm = query.toLowerCase().trim();
        const results = [];
        
        allData.forEach(monthData => {
            const monthMatch = monthData.month.toLowerCase().includes(searchTerm);
            
            Object.entries(monthData.groupedData).forEach(([category, products]) => {
                const categoryMatch = category.toLowerCase().includes(searchTerm);
                
                products.forEach(product => {
                    const productName = product[monthData.config.productNameColumn] || '';
                    const productMatch = String(productName).toLowerCase().includes(searchTerm);
                    
                    if (monthMatch || categoryMatch || productMatch) {
                        results.push({
                            month: monthData.month,
                            monthColor: monthData.color,
                            category: category,
                            productName: String(productName),
                            quantity: parseFloat(product[monthData.config.quantityColumn]) || 0,
                            salesAmount: parseFloat(product[monthData.config.salesColumn]) || 0,
                            data: product,
                            config: monthData.config
                        });
                    }
                });
            });
        });
        
        return results;
    }
};


// ============================================
// ChartRenderer Module
// ============================================
const ChartRenderer = {
    chartInstance: null,
    
    renderTrendChart(canvas, data, productName) {
        this.destroyChart();
        const ctx = canvas.getContext('2d');
        
        this.chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(d => d.month),
                datasets: [{
                    label: productName,
                    data: data.map(d => d.salesAmount),
                    borderColor: '#2196F3',
                    backgroundColor: 'rgba(33, 150, 243, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.1,
                    pointBackgroundColor: '#2196F3',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => `销售金额: ¥${context.parsed.y.toLocaleString()}`
                        }
                    }
                },
                scales: {
                    x: { title: { display: true, text: '月份' }, grid: { display: false } },
                    y: {
                        title: { display: true, text: '销售金额' },
                        beginAtZero: true,
                        ticks: { callback: (value) => '¥' + value.toLocaleString() }
                    }
                }
            }
        });
    },
    
    destroyChart() {
        if (this.chartInstance) {
            this.chartInstance.destroy();
            this.chartInstance = null;
        }
    }
};


// ============================================
// UI Module
// ============================================
const UI = {
    currentParseResult: null,
    pendingDeleteId: null,
    
    showMessage(message, type = 'success') {
        const container = document.getElementById('message-container');
        const msgEl = document.createElement('div');
        msgEl.className = `message ${type}`;
        msgEl.textContent = message;
        container.appendChild(msgEl);
        setTimeout(() => msgEl.remove(), 3000);
    },
    
    showColumnSelection(columns) {
        const section = document.getElementById('column-selection');
        const checkboxContainer = document.getElementById('column-checkboxes');
        const selects = ['category-column', 'sales-column', 'product-column', 'quantity-column'];
        
        checkboxContainer.innerHTML = '';
        selects.forEach(id => {
            const select = document.getElementById(id);
            select.innerHTML = '<option value="">请选择...</option>';
        });
        
        columns.forEach(col => {
            const label = document.createElement('label');
            label.className = 'column-checkbox';
            label.innerHTML = `<input type="checkbox" value="${col}" checked> ${col}`;
            checkboxContainer.appendChild(label);
            
            selects.forEach(id => {
                const option = document.createElement('option');
                option.value = col;
                option.textContent = col;
                document.getElementById(id).appendChild(option);
            });
        });
        
        document.getElementById('month-name').value = '';
        section.style.display = 'block';
    },
    
    hideColumnSelection() {
        document.getElementById('column-selection').style.display = 'none';
    },
    
    getSelectedColumns() {
        const checkboxes = document.querySelectorAll('#column-checkboxes input[type="checkbox"]:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    },
    
    renderMonthsData(scrollToEnd = false) {
        const container = document.getElementById('months-container');
        const sliderNav = document.getElementById('slider-nav');
        const sliderInfo = document.getElementById('slider-info');
        const allData = StateManager.getAllMonthsData();
        
        container.innerHTML = '';
        
        if (allData.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>暂无数据，请上传Excel文件开始</p></div>';
            sliderNav.style.display = 'none';
            return;
        }
        
        // Show slider nav if more than 1 month
        sliderNav.style.display = allData.length > 1 ? 'flex' : 'none';
        sliderInfo.textContent = `共 ${allData.length} 个月份`;
        
        allData.forEach(monthData => {
            container.appendChild(this.createMonthRegion(monthData));
        });
        
        // Scroll to end (latest) if requested
        if (scrollToEnd) {
            setTimeout(() => {
                container.scrollLeft = container.scrollWidth;
            }, 100);
        }
        
        this.updateSliderButtons();
    },
    
    updateSliderButtons() {
        const container = document.getElementById('months-container');
        const prevBtn = document.getElementById('slider-prev');
        const nextBtn = document.getElementById('slider-next');
        
        if (!prevBtn || !nextBtn) return;
        
        prevBtn.disabled = container.scrollLeft <= 0;
        nextBtn.disabled = container.scrollLeft >= container.scrollWidth - container.clientWidth - 10;
    },
    
    scrollSlider(direction) {
        const container = document.getElementById('months-container');
        const scrollAmount = 360; // Width of one card + gap
        container.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
        setTimeout(() => this.updateSliderButtons(), 300);
    },
    
    createMonthRegion(monthData) {
        const region = document.createElement('div');
        region.className = 'month-region';
        region.style.backgroundColor = monthData.color;
        
        // Header with delete button
        const header = document.createElement('div');
        header.className = 'month-header';
        
        const title = document.createElement('span');
        title.textContent = monthData.month;
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'month-delete-btn';
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.title = '删除此月份数据';
        deleteBtn.addEventListener('click', () => this.confirmDelete(monthData.id, monthData.month));
        
        header.appendChild(title);
        header.appendChild(deleteBtn);
        region.appendChild(header);
        
        // Categories
        Object.entries(monthData.groupedData).forEach(([category, products]) => {
            const categoryGroup = document.createElement('div');
            categoryGroup.className = 'category-group';
            
            const categoryTitle = document.createElement('div');
            categoryTitle.className = 'category-title';
            categoryTitle.textContent = category;
            categoryGroup.appendChild(categoryTitle);
            
            const productList = document.createElement('ul');
            productList.className = 'product-list';
            
            products.forEach(product => {
                const productName = product[monthData.config.productNameColumn] || '';
                const quantity = parseFloat(product[monthData.config.quantityColumn]) || 0;
                const salesAmount = parseFloat(product[monthData.config.salesColumn]) || 0;
                
                const item = document.createElement('li');
                item.className = 'product-item';
                
                const nameSpan = document.createElement('span');
                nameSpan.className = 'product-name';
                nameSpan.textContent = productName;
                nameSpan.addEventListener('click', () => this.showTrendChart(productName));
                
                const infoDiv = document.createElement('div');
                infoDiv.className = 'product-info';
                
                const quantitySpan = document.createElement('span');
                quantitySpan.className = 'product-quantity';
                quantitySpan.textContent = `${quantity}件`;
                
                const salesSpan = document.createElement('span');
                salesSpan.className = 'product-sales';
                salesSpan.textContent = `¥${salesAmount.toLocaleString()}`;
                
                infoDiv.appendChild(quantitySpan);
                infoDiv.appendChild(salesSpan);
                
                item.appendChild(nameSpan);
                item.appendChild(infoDiv);
                productList.appendChild(item);
            });
            
            categoryGroup.appendChild(productList);
            region.appendChild(categoryGroup);
        });
        
        return region;
    },

    
    confirmDelete(monthId, monthName) {
        this.pendingDeleteId = monthId;
        document.getElementById('confirm-message').textContent = `确定要删除 "${monthName}" 的数据吗？`;
        document.getElementById('confirm-modal').style.display = 'flex';
    },
    
    hideConfirmModal() {
        document.getElementById('confirm-modal').style.display = 'none';
        this.pendingDeleteId = null;
    },
    
    async executeDelete() {
        if (this.pendingDeleteId) {
            await StateManager.removeMonthData(this.pendingDeleteId);
            this.renderMonthsData();
            this.showMessage('数据已删除', 'success');
        }
        this.hideConfirmModal();
    },
    
    showTrendChart(productName) {
        const trendData = StateManager.getProductTrendData(productName);
        const modal = document.getElementById('chart-modal');
        const chartTitle = document.getElementById('chart-title');
        const chartMessage = document.getElementById('chart-message');
        const canvas = document.getElementById('trend-chart');
        
        chartTitle.textContent = `${productName} - 销售趋势`;
        
        if (trendData.length < 2) {
            canvas.style.display = 'none';
            chartMessage.style.display = 'block';
            chartMessage.textContent = '该商品仅在一个月份有数据，无法生成趋势图';
        } else {
            canvas.style.display = 'block';
            chartMessage.style.display = 'none';
            ChartRenderer.renderTrendChart(canvas, trendData, productName);
        }
        
        modal.style.display = 'flex';
    },
    
    hideChartModal() {
        document.getElementById('chart-modal').style.display = 'none';
        ChartRenderer.destroyChart();
    },
    
    renderSearchResults(results) {
        const container = document.getElementById('months-container');
        container.innerHTML = '';
        
        if (results.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>没有找到匹配的结果</p></div>';
            return;
        }
        
        const byMonth = {};
        results.forEach(result => {
            if (!byMonth[result.month]) {
                byMonth[result.month] = { color: result.monthColor, categories: {} };
            }
            if (!byMonth[result.month].categories[result.category]) {
                byMonth[result.month].categories[result.category] = [];
            }
            byMonth[result.month].categories[result.category].push(result);
        });
        
        Object.entries(byMonth).forEach(([month, data]) => {
            const region = document.createElement('div');
            region.className = 'month-region';
            region.style.backgroundColor = data.color;
            
            const header = document.createElement('div');
            header.className = 'month-header';
            header.innerHTML = `<span>${month}</span>`;
            region.appendChild(header);
            
            Object.entries(data.categories).forEach(([category, products]) => {
                const categoryGroup = document.createElement('div');
                categoryGroup.className = 'category-group';
                
                const categoryTitle = document.createElement('div');
                categoryTitle.className = 'category-title';
                categoryTitle.textContent = category;
                categoryGroup.appendChild(categoryTitle);
                
                const productList = document.createElement('ul');
                productList.className = 'product-list';
                
                products.forEach(product => {
                    const item = document.createElement('li');
                    item.className = 'product-item';
                    
                    const nameSpan = document.createElement('span');
                    nameSpan.className = 'product-name';
                    nameSpan.textContent = product.productName;
                    nameSpan.addEventListener('click', () => this.showTrendChart(product.productName));
                    
                    const infoDiv = document.createElement('div');
                    infoDiv.className = 'product-info';
                    infoDiv.innerHTML = `
                        <span class="product-quantity">${product.quantity}件</span>
                        <span class="product-sales">¥${product.salesAmount.toLocaleString()}</span>
                    `;
                    
                    item.appendChild(nameSpan);
                    item.appendChild(infoDiv);
                    productList.appendChild(item);
                });
                
                categoryGroup.appendChild(productList);
                region.appendChild(categoryGroup);
            });
            
            container.appendChild(region);
        });
    }
};


// ============================================
// Event Listeners and Initialization
// ============================================
if (typeof document !== 'undefined') {
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize AuthUI event listeners
    AuthUI.initEventListeners();
    
    // Initialize network listener for CloudSync
    CloudSyncManager.initNetworkListener();
    
    // Try to restore session
    // Requirements: 2.4 - 页面加载时调用 AuthManager.restoreSession
    const sessionRestored = await AuthManager.restoreSession();
    
    if (sessionRestored) {
        // 已登录，更新UI并加载云端数据
        // Requirements: 2.3 - 根据登录状态初始化数据源
        AuthUI.updateHeaderUserStatus(AuthManager.getCurrentUser());
        AuthUI.updateSyncStatus('syncing');
        
        // 使用 StateManager.initFromCloud 从云端加载数据
        const cloudLoaded = await StateManager.initFromCloud();
        if (!cloudLoaded) {
            // 云端加载失败，使用本地数据
            StateManager.init();
        }
        AuthUI.updateSyncStatus('synced');
    } else {
        // 未登录，使用本地存储数据
        StateManager.init();
        AuthUI.updateHeaderUserStatus(null);
    }
    
    UI.renderMonthsData();
    
    // File input
    const fileInput = document.getElementById('file-input');
    const uploadArea = document.getElementById('upload-area');
    
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        if (!FileHandler.isValidExcelFile(file)) {
            UI.showMessage('请上传有效的Excel文件（.xls或.xlsx格式）', 'error');
            fileInput.value = '';
            return;
        }
        
        uploadArea.classList.add('loading');
        const result = await FileHandler.parseExcelFile(file);
        uploadArea.classList.remove('loading');
        
        if (result.error) {
            UI.showMessage(result.error, 'error');
            fileInput.value = '';
            return;
        }
        
        UI.currentParseResult = result;
        UI.showColumnSelection(result.columns);
        fileInput.value = '';
    });
    
    // Drag and drop
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) {
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            fileInput.files = dataTransfer.files;
            fileInput.dispatchEvent(new Event('change'));
        }
    });
    
    // Confirm columns
    document.getElementById('confirm-columns').addEventListener('click', async () => {
        const monthName = document.getElementById('month-name').value.trim();
        const categoryColumn = document.getElementById('category-column').value;
        const salesColumn = document.getElementById('sales-column').value;
        const productColumn = document.getElementById('product-column').value;
        const quantityColumn = document.getElementById('quantity-column').value;
        const selectedColumns = UI.getSelectedColumns();
        
        if (!monthName) { UI.showMessage('请输入月份名称', 'warning'); return; }
        if (!categoryColumn) { UI.showMessage('请选择品类列', 'warning'); return; }
        if (!salesColumn) { UI.showMessage('请选择销售金额列', 'warning'); return; }
        if (!productColumn) { UI.showMessage('请选择商品名称列', 'warning'); return; }
        if (!quantityColumn) { UI.showMessage('请选择销售数量列', 'warning'); return; }
        if (selectedColumns.length === 0) { UI.showMessage('请至少选择一列数据', 'warning'); return; }
        
        const allColumns = new Set(selectedColumns);
        [categoryColumn, salesColumn, productColumn, quantityColumn].forEach(c => allColumns.add(c));
        
        const config = {
            selectedColumns: Array.from(allColumns),
            categoryColumn,
            salesColumn,
            quantityColumn,
            productNameColumn: productColumn
        };
        
        const groupedData = DataProcessor.processData(UI.currentParseResult.data, config);
        
        const monthData = {
            id: Date.now().toString(),
            month: monthName,
            color: StateManager.getNextColor(),
            importedAt: new Date(),
            config,
            groupedData,
            rawData: UI.currentParseResult.data
        };
        
        // 添加数据（如果已登录会自动同步到云端）
        await StateManager.addMonthData(monthData);
        UI.hideColumnSelection();
        UI.renderMonthsData(true); // Scroll to latest
        UI.showMessage(`${monthName} 数据导入成功！`, 'success');
        UI.currentParseResult = null;
    });
    
    // Cancel columns
    document.getElementById('cancel-columns').addEventListener('click', () => {
        UI.hideColumnSelection();
        UI.currentParseResult = null;
    });
    
    // Search
    const searchInput = document.getElementById('search-input');
    let searchTimeout;
    
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        
        searchTimeout = setTimeout(() => {
            if (query === '') {
                UI.renderMonthsData();
            } else {
                const results = SearchEngine.search(StateManager.getAllMonthsData(), query);
                UI.renderSearchResults(results);
            }
        }, 300);
    });
    
    document.getElementById('search-clear').addEventListener('click', () => {
        searchInput.value = '';
        UI.renderMonthsData();
    });
    
    // Chart modal
    document.getElementById('modal-close').addEventListener('click', () => UI.hideChartModal());
    document.getElementById('chart-modal').addEventListener('click', (e) => {
        if (e.target.id === 'chart-modal') UI.hideChartModal();
    });
    
    // Confirm delete modal
    document.getElementById('confirm-modal-close').addEventListener('click', () => UI.hideConfirmModal());
    document.getElementById('confirm-no').addEventListener('click', () => UI.hideConfirmModal());
    document.getElementById('confirm-yes').addEventListener('click', () => UI.executeDelete());
    document.getElementById('confirm-modal').addEventListener('click', (e) => {
        if (e.target.id === 'confirm-modal') UI.hideConfirmModal();
    });
    
    // Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            UI.hideChartModal();
            UI.hideConfirmModal();
            AuthUI.hideAuthForms();
        }
    });
    
    // Slider navigation
    document.getElementById('slider-prev').addEventListener('click', () => UI.scrollSlider(-1));
    document.getElementById('slider-next').addEventListener('click', () => UI.scrollSlider(1));
    
    // Update slider buttons on scroll
    document.getElementById('months-container').addEventListener('scroll', () => {
        UI.updateSliderButtons();
    });
    
    // Initial scroll to end (show latest)
    setTimeout(() => {
        const container = document.getElementById('months-container');
        if (container.scrollWidth > container.clientWidth) {
            container.scrollLeft = container.scrollWidth;
            UI.updateSliderButtons();
        }
    }, 200);
});
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AuthManager, CloudSyncManager, LocalCacheManager, AuthUI, FileHandler, DataProcessor, StateManager, SearchEngine, ChartRenderer, StorageManager, COLOR_PALETTE };
}
