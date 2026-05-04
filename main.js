/* ============================================================
   REBEL AI — main.js v4.0
   Full ChatGPT-like functionality with Voice Assistant
   ============================================================ */

'use strict';

// ── CONFIG ───────────────────────────────────────────────────
const CONFIG = {
  AI_BASE_URL    : 'https://api-rebix.vercel.app/api/gpt-5',
  AI_MODEL       : 'Rebel GPT-5',
  MAX_CHARS      : 4000,
  AVATAR_URL     : 'https://public.youware.com/users-website-assets/prod/a6330b2a-2d0c-4263-9e0e-f58a67b39c2d/3bd4f7557c4e4ed0adc20480987490fa.jpg',
  SYSTEM_PROMPT  : 'You are Rebel Gpt, an advanced AI assistant created by Rebel bhaiya. You are helpful, rebellious, and expert in coding. Always respond helpfully and intelligently.',
  EMAILJS        : { SERVICE_ID: 'service_e9bgcfc', TEMPLATE_ID: 'template_hkeeeoc', PUBLIC_KEY: 'WJPN774FeTnl3KAcH' },
  ELEVEN_KEYS    : ['sk_8fc19956a67359474720d2cd75e2a312ca85e748433d8f08', 'sk_6b8aaa9e530729ae9ac3592b0a3cd6af32485b66bfe146ce'],
  ELEVEN_VOICE_ID: 'N2lVS1w4EtoT3dr4eOWO',
  RAPID_KEY      : 'a5568a21demshaabda3585274b37p1ee4c7jsn5f301200dd8a',
};

function apiUrl(path) {
  const base = window.location.href.split('?')[0];
  return base.includes('.php') ? base + '?_route=' + encodeURIComponent(path) : path;
}

// ── STORAGE LAYER ────────────────────────────────────────────
const Store = {
  get: (k, d = null) => { try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del: (k) => { try { localStorage.removeItem(k); } catch {} },
};

const KEYS = {
  currentUser    : 'rbl_current_user',
  users          : 'rbl_users_v4',
  conversations  : 'rbl_convs_v4',
  adminPass      : 'rbl_admin_pass',
  adminToken     : 'rbl_admin_token',
  msgCount       : 'rbl_msg_count',
  elevenKeyIdx   : 'rbl_el_key_idx',
  sysLogs        : 'rbl_sys_logs',
  apiCalls       : 'rbl_api_calls',
  sessions       : 'rbl_sessions',
};

// ── USER SYSTEM ──────────────────────────────────────────────
const UserSystem = {
  getAll() { return Store.get(KEYS.users, []); },
  saveAll(u) { Store.set(KEYS.users, u); },
  getCurrent() { return Store.get(KEYS.currentUser, null); },
  setCurrent(u) { Store.set(KEYS.currentUser, u); },
  clearCurrent() { Store.del(KEYS.currentUser); },
  find(nameOrEmail, byName = true) {
    return this.getAll().find(u =>
      byName ? u.name?.toLowerCase() === nameOrEmail.toLowerCase()
             : u.email?.toLowerCase() === nameOrEmail.toLowerCase()
    );
  },
  register(name, email, password) {
    const users = this.getAll();
    const existing = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (existing) {
      existing.lastLogin = new Date().toISOString();
      existing.loginCount = (existing.loginCount || 0) + 1;
      if (password && !existing.password) existing.password = password;
      this.saveAll(users);
      this.setCurrent(existing);
      return existing;
    }
    const newUser = {
      id        : Date.now(),
      name, email, password: password || '',
      role      : 'User',
      status    : 'active',
      joined    : new Date().toISOString().slice(0,10),
      messages  : 0,
      device    : /mobile|android|iphone/i.test(navigator.userAgent) ? 'Mobile' : 'Desktop',
      lastLogin : new Date().toISOString(),
      loginCount: 1,
    };
    users.push(newUser);
    this.saveAll(users);
    this.setCurrent(newUser);
    Log.add('info', `New user: ${name} (${email})`);
    return newUser;
  },
  login(username, password) {
    const users = this.getAll();
    const user = users.find(u =>
      (u.name?.toLowerCase() === username.toLowerCase() ||
       u.email?.toLowerCase() === username.toLowerCase()) &&
      u.password === password
    );
    if (!user) return null;
    user.lastLogin = new Date().toISOString();
    user.loginCount = (user.loginCount || 0) + 1;
    this.saveAll(users);
    this.setCurrent(user);
    Log.add('info', `Login: ${user.name}`);
    return user;
  },
  incrementMessages(email) {
    const users = this.getAll();
    const u = users.find(x => x.email?.toLowerCase() === email?.toLowerCase());
    if (u) { u.messages = (u.messages || 0) + 1; this.saveAll(users); }
  },
};

// ── CONVERSATION SYSTEM ──────────────────────────────────────
const ConvSystem = {
  _convs: null,
  _activeId: null,
  getAll() {
    if (!this._convs) this._convs = Store.get(KEYS.conversations, []);
    return this._convs;
  },
  save() { Store.set(KEYS.conversations, this._convs); },
  getActive() { return this.getAll().find(c => c.id === this._activeId) || null; },
  create(title = 'New conversation') {
    const conv = {
      id       : Date.now(),
      title,
      messages : [],
      created  : new Date().toISOString(),
      updated  : new Date().toISOString(),
    };
    this.getAll().unshift(conv);
    this._activeId = conv.id;
    this.save();
    return conv;
  },
  setActive(id) { this._activeId = id; },
  addMessage(convId, role, content, imageData = null) {
    const conv = this.getAll().find(c => c.id === convId);
    if (!conv) return;
    conv.messages.push({ id: Date.now(), role, content, imageData, ts: Date.now() });
    conv.updated = new Date().toISOString();
    if (conv.messages.length === 1 && role === 'user') {
      conv.title = content.slice(0, 40) + (content.length > 40 ? '…' : '');
    }
    this.save();
  },
  deleteConv(id) {
    this._convs = this.getAll().filter(c => c.id !== id);
    if (this._activeId === id) this._activeId = this._convs[0]?.id || null;
    this.save();
  },
  getMessages(convId) {
    return this.getAll().find(c => c.id === convId)?.messages || [];
  },
};

// ── LOGGING ──────────────────────────────────────────────────
const Log = {
  add(level, msg) {
    const logs = Store.get(KEYS.sysLogs, []);
    logs.push({ id: Date.now(), level, msg: msg.slice(0,500), ts: Date.now() });
    if (logs.length > 500) logs.splice(0, logs.length - 500);
    Store.set(KEYS.sysLogs, logs);
  },
  getAll() { return Store.get(KEYS.sysLogs, []); },
  clear() { Store.set(KEYS.sysLogs, []); },
};

// ── ANALYTICS ────────────────────────────────────────────────
const Analytics = {
  trackApiCall(ms, ok) {
    const calls = Store.get(KEYS.apiCalls, []);
    calls.push({ ms, ok: ok ? 1 : 0, ts: Date.now() });
    if (calls.length > 200) calls.splice(0, calls.length - 200);
    Store.set(KEYS.apiCalls, calls);
    try { fetch(apiUrl('/api/track/api-call'), { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({response_ms:ms,success:ok}) }).catch(()=>{}); } catch {}
  },
  trackMsg(userEmail, type, ms) {
    Store.set(KEYS.msgCount, (Store.get(KEYS.msgCount, 0) || 0) + 1);
    try { fetch(apiUrl('/api/track/message'), { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({user_email:userEmail,type,response_ms:ms}) }).catch(()=>{}); } catch {}
  },
  pingSession() {
    const key = Store.get('rbl_session_key', null) || (() => { const k = Math.random().toString(36).slice(2); Store.set('rbl_session_key', k); return k; })();
    try { fetch(apiUrl('/api/session/ping'), { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({session_key:key}) }).catch(()=>{}); } catch {}
  },
};

// ── OTP ENGINE ───────────────────────────────────────────────
const OTPEngine = {
  _otp: '', _email: '', _timer: null,
  generate() { this._otp = String(Math.floor(100000 + Math.random() * 900000)); return this._otp; },
  setEmail(e) { this._email = e; },
  getEmail() { return this._email; },
  getOtp() { return this._otp; },
  clear() { this._otp = ''; this._email = ''; },
  verify(input) { return input.trim() === this._otp.trim() && this._otp !== ''; },
  async send(email) {
    const otp = this.generate();
    this._email = email;
    // Try EmailJS
    try {
      if (typeof emailjs !== 'undefined' && CONFIG.EMAILJS.PUBLIC_KEY !== 'YOUR_PUBLIC_KEY') {
        emailjs.init(CONFIG.EMAILJS.PUBLIC_KEY);
        await emailjs.send(CONFIG.EMAILJS.SERVICE_ID, CONFIG.EMAILJS.TEMPLATE_ID, {
          to_email: email, otp, to_name: email.split('@')[0], app_name: 'Rebel AI', expire: '10 minutes'
        });
        Log.add('info', `OTP sent to ${email}`);
        return { ok: true, devMode: false };
      }
    } catch {}
    // Try backend
    try {
      const r = await fetch(apiUrl('/api/otp/send'), { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email}) });
      const d = await r.json();
      if (d.ok) {
        if (d.dev_otp) this._otp = d.dev_otp;
        return { ok: true, devMode: !!d.dev_otp, otp: d.dev_otp };
      }
    } catch {}
    // Dev mode fallback
    console.warn('[Rebel AI Dev] OTP:', otp);
    Log.add('warn', `[DEV MODE] OTP for ${email}: ${otp}`);
    return { ok: true, devMode: true, otp };
  },
};

// ── TOAST SYSTEM ─────────────────────────────────────────────
const Toast = {
  show(msg, type = 'info', duration = 3500) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const icons = { success:'fa-check-circle', error:'fa-exclamation-circle', info:'fa-info-circle', warning:'fa-exclamation-triangle' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${icons[type] || icons.info} toast-icon"></i><span class="toast-msg">${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('removing');
      toast.addEventListener('animationend', () => toast.remove());
    }, duration);
  },
};

// ── AI ENGINE ────────────────────────────────────────────────
const AIEngine = {
  async ask(question, imageBase64 = null) {
    let url = `${CONFIG.AI_BASE_URL}?q=${encodeURIComponent(question)}`;
    if (imageBase64) url += `&image=${encodeURIComponent(imageBase64)}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    if (!data.status || !data.results) throw new Error('Invalid API response');
    return data.results;
  },
};

// ── MARKDOWN PARSER ──────────────────────────────────────────
function parseMarkdown(text) {
  if (!text) return '';
  let html = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) =>
      `<div class="code-block-wrapper"><div class="code-block-header"><span class="code-lang">${lang || 'code'}</span><button class="copy-code-btn" onclick="copyCode(this)"><i class="fas fa-copy"></i> Copy</button></div><pre><code>${code.trim()}</code></pre></div>`)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^\- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
  if (!html.startsWith('<')) html = '<p>' + html + '</p>';
  return html;
}

window.copyCode = function(btn) {
  const code = btn.closest('.code-block-wrapper').querySelector('code').textContent;
  navigator.clipboard.writeText(code).then(() => {
    btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
    setTimeout(() => { btn.innerHTML = '<i class="fas fa-copy"></i> Copy'; }, 2000);
  }).catch(() => Toast.show('Could not copy to clipboard', 'error'));
};

// ── UI HELPERS ───────────────────────────────────────────────
function el(id) { return document.getElementById(id); }
function show(id) { const e = el(id); if (e) e.style.display = ''; }
function hide(id) { const e = el(id); if (e) e.style.display = 'none'; }
function setText(id, val) { const e = el(id); if (e) e.textContent = val; }
function showErr(id, msg) {
  const e = el(id);
  if (!e) return;
  e.textContent = msg;
  e.style.display = msg ? 'block' : 'none';
  e.style.color = msg.startsWith('✓') ? 'var(--accent-green)' : 'var(--accent-red)';
}
function clearErr(...ids) { ids.forEach(id => showErr(id, '')); }

// ── MODAL MANAGER ────────────────────────────────────────────
const Modal = {
  _stack: [],
  open(id) {
    const m = el(id);
    if (!m) return;
    m.classList.add('show');
    document.body.style.overflow = 'hidden';
    this._stack.push(id);
  },
  close(id) {
    const m = el(id);
    if (!m) return;
    m.classList.remove('show');
    this._stack = this._stack.filter(x => x !== id);
    if (!this._stack.length) document.body.style.overflow = '';
  },
  closeAll() {
    this._stack.forEach(id => { const m = el(id); if (m) m.classList.remove('show'); });
    this._stack = [];
    document.body.style.overflow = '';
  },
};

// ── AUTH FLOW ────────────────────────────────────────────────
let _pendingAction = 'chat';
let _otpAttempts   = 0;
let _resendTimer   = null;

function showAuthStep(step) {
  ['authStepLogin','authStepEmail','authStepOtp','authStepCreate'].forEach(id => {
    const e = el(id);
    if (e) e.style.display = id === step ? 'block' : 'none';
  });
}

function openAuthModal(action = 'chat') {
  _pendingAction = action;
  clearErr('loginError', 'emailError', 'otpError', 'createError');
  ['loginUsername','loginPassword','authEmail','newUsername','newPassword','confirmPassword'].forEach(id => {
    const e = el(id); if (e) e.value = '';
  });
  showAuthStep('authStepLogin');
  Modal.open('authModal');
  setTimeout(() => el('loginUsername')?.focus(), 200);
}

function openAccessPicker() {
  const user = UserSystem.getCurrent();
  if (user && user.password) {
    Modal.open('accessModal');
  } else {
    openAuthModal('picker');
  }
}

// ── CHAT INTERFACE ───────────────────────────────────────────
let _selectedImage = null;
let _isTyping      = false;
let _currentConvId = null;

function openChatApp(user) {
  Modal.closeAll();
  el('landingPage').classList.add('hidden');
  el('chatApp').classList.remove('hidden');
  document.body.style.overflow = '';

  // Update sidebar user info
  setText('sidebarUserName', user.name);
  const av = el('sidebarAvatar');
  if (av) { av.textContent = user.name.charAt(0).toUpperCase(); }

  // Init or restore conversations
  const convs = ConvSystem.getAll();
  if (!convs.length || !_currentConvId) {
    const conv = ConvSystem.create();
    _currentConvId = conv.id;
  } else {
    _currentConvId = convs[0].id;
    ConvSystem.setActive(_currentConvId);
  }

  renderConvList();
  loadConversation(_currentConvId, true);
  Analytics.pingSession();
  setInterval(() => Analytics.pingSession(), 25000);
}

function loadConversation(convId, isNew = false) {
  _currentConvId = convId;
  ConvSystem.setActive(convId);
  const msgs = ConvSystem.getMessages(convId);
  const container = el('chatMessages');
  if (!container) return;
  container.innerHTML = '';
  renderConvList();

  if (!msgs.length || isNew) {
    el('welcomeScreen').style.display = 'flex';
    return;
  }
  el('welcomeScreen').style.display = 'none';
  msgs.forEach(m => {
    if (m.role === 'user') appendUserMessage(m.content, m.imageData, false);
    else appendAIMessage(m.content, false);
  });
}

function renderConvList() {
  const list = el('conversationList');
  if (!list) return;
  const convs = ConvSystem.getAll();
  list.innerHTML = '';
  if (!convs.length) {
    list.innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:0.8rem;padding:20px">No conversations yet</div>';
    return;
  }
  convs.forEach(conv => {
    const item = document.createElement('div');
    item.className = 'conv-item' + (conv.id === _currentConvId ? ' active' : '');
    item.dataset.id = conv.id;
    const date = new Date(conv.updated);
    const timeLabel = isToday(date) ? date.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : date.toLocaleDateString([], {month:'short',day:'numeric'});
    item.innerHTML = `
      <div class="conv-icon"><i class="fas fa-${conv.messages.length ? 'comment' : 'plus'}"></i></div>
      <div class="conv-text">
        <div class="conv-title">${escHtml(conv.title)}</div>
        <div class="conv-time">${timeLabel}</div>
      </div>
      <div class="conv-actions">
        <button class="conv-action-btn" title="Delete" data-delete="${conv.id}"><i class="fas fa-trash"></i></button>
      </div>`;
    item.addEventListener('click', (e) => {
      if (e.target.closest('[data-delete]')) {
        const id = parseInt(e.target.closest('[data-delete]').dataset.delete);
        ConvSystem.deleteConv(id);
        renderConvList();
        if (id === _currentConvId) {
          const remaining = ConvSystem.getAll();
          if (remaining.length) { _currentConvId = remaining[0].id; loadConversation(_currentConvId); }
          else { newConversation(); }
        }
        return;
      }
      loadConversation(conv.id);
    });
    list.appendChild(item);
  });
}

function newConversation() {
  const conv = ConvSystem.create();
  _currentConvId = conv.id;
  el('chatMessages').innerHTML = '';
  el('welcomeScreen').style.display = 'flex';
  renderConvList();
}

function isToday(d) {
  const now = new Date();
  return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function escHtml(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ── MESSAGE RENDERING ────────────────────────────────────────
function appendUserMessage(text, imageData = null, save = true) {
  el('welcomeScreen').style.display = 'none';
  const user = UserSystem.getCurrent();
  const row  = document.createElement('div');
  row.className = 'message-row user-row';
  const initials = user ? user.name.charAt(0).toUpperCase() : 'U';
  const timeStr  = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});

  let bubbleContent = '';
  if (imageData) bubbleContent += `<img src="${imageData}" alt="image" class="msg-image">`;
  if (text) bubbleContent += `<span>${escHtml(text)}</span>`;

  row.innerHTML = `
    <div class="msg-content">
      <div class="msg-header" style="justify-content:flex-end">
        <span class="msg-time">${timeStr}</span>
        <span class="msg-name">${escHtml(user?.name || 'You')}</span>
      </div>
      <div class="user-bubble msg-bubble">${bubbleContent}</div>
    </div>
    <div class="msg-avatar user-avatar">${initials}</div>`;
  el('chatMessages').appendChild(row);
  scrollToBottom();
  if (save && _currentConvId) ConvSystem.addMessage(_currentConvId, 'user', text, imageData);
}

function appendAIMessage(text, save = true, animate = true) {
  const row = document.createElement('div');
  row.className = 'message-row';
  const timeStr = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});

  row.innerHTML = `
    <div class="msg-avatar ai-avatar">🤖</div>
    <div class="msg-content">
      <div class="msg-header">
        <span class="msg-name gradient-text">Rebel AI</span>
        <span class="msg-model-badge">${CONFIG.AI_MODEL}</span>
        <span class="msg-time">${timeStr}</span>
      </div>
      <div class="ai-bubble msg-bubble" id="msgBubble_${Date.now()}"></div>
      <div class="msg-actions">
        <button class="msg-action-btn" title="Copy" onclick="copyMsgText(this)"><i class="fas fa-copy"></i></button>
        <button class="msg-action-btn" title="Thumbs up"><i class="fas fa-thumbs-up"></i></button>
        <button class="msg-action-btn" title="Thumbs down"><i class="fas fa-thumbs-down"></i></button>
        <button class="msg-action-btn" title="Regenerate" onclick="regenMsg(this)"><i class="fas fa-redo"></i></button>
      </div>
    </div>`;

  el('chatMessages').appendChild(row);
  const bubble = row.querySelector('.ai-bubble');

  if (animate) {
    // Typewriter animation
    let i = 0;
    const parsed = parseMarkdown(text);
    // For simple animation, stream the raw text then replace with HTML
    const span = document.createElement('span');
    bubble.appendChild(span);
    const typeNext = () => {
      if (i <= text.length) {
        span.textContent = text.slice(0, i);
        i += 3;
        scrollToBottom();
        setTimeout(typeNext, 8);
      } else {
        bubble.innerHTML = parsed;
      }
    };
    typeNext();
  } else {
    bubble.innerHTML = parseMarkdown(text);
  }

  scrollToBottom();
  if (save && _currentConvId) ConvSystem.addMessage(_currentConvId, 'assistant', text);
  return row;
}

function appendThinkingIndicator() {
  const row = document.createElement('div');
  row.className = 'message-row thinking-row';
  row.id = 'thinkingRow';
  row.innerHTML = `
    <div class="msg-avatar ai-avatar">🤖</div>
    <div class="msg-content">
      <div class="msg-bubble thinking-row" style="display:flex;align-items:center;gap:10px;background:var(--gradient-card);border:1px solid var(--border-subtle);padding:14px 18px;border-radius:var(--radius-md)">
        <div class="thinking-spinner"></div>
        <span class="thinking-text">Thinking…</span>
      </div>
    </div>`;
  el('chatMessages').appendChild(row);
  scrollToBottom();
}

window.copyMsgText = function(btn) {
  const text = btn.closest('.msg-content').querySelector('.ai-bubble').textContent;
  navigator.clipboard.writeText(text).then(() => {
    btn.innerHTML = '<i class="fas fa-check"></i>';
    setTimeout(() => { btn.innerHTML = '<i class="fas fa-copy"></i>'; }, 2000);
  });
};

window.regenMsg = async function(btn) {
  const conv = ConvSystem.getActive();
  if (!conv || conv.messages.length < 2) return;
  const lastUser = [...conv.messages].reverse().find(m => m.role === 'user');
  if (!lastUser) return;
  // Remove last AI message from DOM and data
  const rows = el('chatMessages').querySelectorAll('.message-row');
  if (rows.length) rows[rows.length - 1].remove();
  conv.messages = conv.messages.slice(0, -1);
  ConvSystem.save();
  await doSendMessage(lastUser.content, lastUser.imageData, false);
};

function scrollToBottom() {
  const c = el('messagesContainer');
  if (c) c.scrollTop = c.scrollHeight;
}

// ── SEND MESSAGE ─────────────────────────────────────────────
async function doSendMessage(text, imageBase64 = null, appendUser = true) {
  if (_isTyping) return;
  if (!text.trim() && !imageBase64) return;

  _isTyping = true;
  el('sendMsgBtn').disabled = true;

  if (appendUser) appendUserMessage(text, imageBase64, true);

  const t0 = performance.now();
  appendThinkingIndicator();

  const user = UserSystem.getCurrent();
  Log.add('info', `${user?.name || 'User'}: "${text.slice(0,60)}${text.length>60?'…':''}"`);

  try {
    const reply = await AIEngine.ask(text, imageBase64);
    const ms = Math.round(performance.now() - t0);
    el('thinkingRow')?.remove();
    appendAIMessage(reply, true, true);
    Analytics.trackApiCall(ms, true);
    Analytics.trackMsg(user?.email, 'text', ms);
    if (user) UserSystem.incrementMessages(user.email);
    Log.add('info', `Reply in ${ms}ms`);
    renderConvList();
  } catch (err) {
    el('thinkingRow')?.remove();
    appendAIMessage(`Sorry, I encountered an error: ${err.message}. Please try again.`, true, false);
    Log.add('error', `API error: ${err.message}`);
    Analytics.trackApiCall(Math.round(performance.now() - t0), false);
    Toast.show('Connection error — please retry', 'error');
  } finally {
    _isTyping = false;
    _selectedImage = null;
    el('imagePreviewBar').classList.remove('visible');
    el('imageFileInput').value = '';
    el('chatTextarea').value = '';
    updateSendBtn();
    el('sendMsgBtn').disabled = false;
    el('chatTextarea').focus();
  }
}

function updateSendBtn() {
  const ta = el('chatTextarea');
  const hasTxt = ta && ta.value.trim().length > 0;
  const sendBtn = el('sendMsgBtn');
  if (sendBtn) sendBtn.disabled = !hasTxt && !_selectedImage;
  const cc = el('charCounter');
  if (cc && ta) cc.textContent = `${ta.value.length} / ${CONFIG.MAX_CHARS}`;
}

// ── VOICE ASSISTANT ──────────────────────────────────────────
const VoiceAssistant = {
  isListening  : false,
  isSpeaking   : false,
  recognition  : null,
  wakeListener : null,
  wakeActive   : false,
  isHindiMode  : false,
  audioCtx     : null,
  analyser     : null,
  micStream    : null,
  animFrame    : null,
  _elevenIdx   : Store.get(KEYS.elevenKeyIdx, 0) || 0,

  init() {
    this.setupWaveform();
    setTimeout(() => this.startWakeWord(), 2000);
  },

  getElevenKey() { return CONFIG.ELEVEN_KEYS[this._elevenIdx % CONFIG.ELEVEN_KEYS.length]; },
  rotateElevenKey() {
    this._elevenIdx = (this._elevenIdx + 1) % CONFIG.ELEVEN_KEYS.length;
    Store.set(KEYS.elevenKeyIdx, this._elevenIdx);
  },

  setState(state) {
    const dot = el('voiceStatusDot');
    const lbl = el('voiceStatusText');
    const ring = el('voiceAvatarRing');
    if (!dot) return;
    dot.className = 'voice-status-dot ' + state;
    const labels = { idle:'STANDBY', listening:'LISTENING…', thinking:'THINKING…', speaking:'SPEAKING' };
    if (lbl) lbl.textContent = labels[state] || state.toUpperCase();
    if (ring) { ring.className = 'voice-avatar-ring ' + state; }
    const micIcon = el('voiceMicIcon');
    const micBtn  = el('voiceMicBtn');
    if (state === 'listening') {
      if (micIcon) micIcon.className = 'fas fa-microphone-slash';
      if (micBtn)  micBtn.classList.add('listening');
    } else {
      if (micIcon) micIcon.className = 'fas fa-microphone';
      if (micBtn)  micBtn.classList.remove('listening');
    }
    if (el('voiceMicLabel')) el('voiceMicLabel').textContent = state === 'listening' ? 'LISTENING…' : 'TAP TO SPEAK';
  },

  addTranscript(role, text) {
    const t = el('voiceTranscript');
    if (!t) return;
    const div = document.createElement('div');
    div.className = `transcript-msg ${role}`;
    const tags = { user:'YOU', ai:'AI', sys:'SYS' };
    div.innerHTML = `<span class="transcript-tag">${tags[role]||role.toUpperCase()}</span>${escHtml(text)}`;
    t.appendChild(div);
    t.scrollTop = t.scrollHeight;
  },

  setupWaveform() {
    const canvas = el('voiceWaveCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let phase = 0;
    let amplitude = 10;
    let targetAmp = 10;

    const draw = () => {
      this.animFrame = requestAnimationFrame(draw);
      const W = canvas.offsetWidth || 480;
      const H = canvas.height || 60;
      canvas.width = W;
      ctx.clearRect(0, 0, W, H);

      if (this.analyser) {
        const buf = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteTimeDomainData(buf);
        const avg = buf.reduce((a, b) => a + Math.abs(b - 128), 0) / buf.length;
        targetAmp = this.isListening ? 5 + avg * 2 : 5;
      } else {
        targetAmp = this.isSpeaking ? 18 + Math.sin(Date.now()/200)*12 : this.isListening ? 12 : 5;
      }
      amplitude += (targetAmp - amplitude) * 0.15;
      phase += this.isListening ? 0.08 : 0.03;

      const grad = ctx.createLinearGradient(0, 0, W, 0);
      grad.addColorStop(0, 'rgba(138,43,226,0.2)');
      grad.addColorStop(0.5, this.isListening ? 'rgba(0,206,209,0.8)' : this.isSpeaking ? 'rgba(16,185,129,0.8)' : 'rgba(138,43,226,0.5)');
      grad.addColorStop(1, 'rgba(138,43,226,0.2)');

      ctx.beginPath();
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2;
      for (let x = 0; x <= W; x++) {
        const y = H/2 + Math.sin(x * 0.02 + phase) * amplitude * Math.sin(x * 0.01 + phase * 0.5);
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Second wave
      ctx.beginPath();
      ctx.strokeStyle = this.isListening ? 'rgba(0,206,209,0.3)' : 'rgba(138,43,226,0.2)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= W; x++) {
        const y = H/2 + Math.sin(x * 0.015 + phase * 1.3 + 1) * amplitude * 0.6;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    };
    draw();
  },

  async startMicAudio() {
    try {
      if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.micStream = stream;
      const source = this.audioCtx.createMediaStreamSource(stream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);
    } catch {}
  },

  stopMicAudio() {
    if (this.micStream) { this.micStream.getTracks().forEach(t => t.stop()); this.micStream = null; }
    this.analyser = null;
  },

  startListening() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) { Toast.show('Speech recognition not supported in this browser', 'error'); return; }
    if (this.isListening) { this.stopListening(); return; }

    this.isListening = true;
    this.setState('listening');
    this.startMicAudio();

    const rec = new SpeechRec();
    rec.lang = this.isHindiMode ? 'hi-IN' : 'en-US';
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 3;
    this.recognition = rec;

    let finalText = '';
    let interimText = '';

    rec.onresult = (e) => {
      let final = '', interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        e.results[i].isFinal ? final += t : interim += t;
      }
      finalText += final;
      interimText = interim;
      const lbl = el('voiceStatusText');
      if (lbl) lbl.textContent = (finalText + interim).trim().slice(-60) || 'LISTENING…';
    };

    rec.onend = () => {
      this.isListening = false;
      this.setState('thinking');
      this.stopMicAudio();
      const text = (finalText + interimText).trim();
      if (text) {
        this.addTranscript('user', text);
        this.queryAI(text);
      } else {
        this.setState('idle');
        this.addTranscript('sys', 'No speech detected. Tap mic to try again.');
      }
    };

    rec.onerror = (e) => {
      if (e.error === 'no-speech') return;
      this.isListening = false;
      this.setState('idle');
      this.stopMicAudio();
      if (e.error === 'not-allowed') {
        Toast.show('Microphone permission denied', 'error');
        this.addTranscript('sys', 'Mic access denied. Enable in browser settings.');
      }
    };

    rec.start();
  },

  stopListening() {
    if (this.recognition) { try { this.recognition.stop(); } catch {} }
    this.isListening = false;
    this.setState('idle');
    this.stopMicAudio();
  },

  async queryAI(text) {
    // Check for mode switches
    if (/hindi|हिंदी/.test(text.toLowerCase())) {
      this.isHindiMode = true;
      this.addTranscript('sys', 'Switching to Hindi mode…');
      setText('voiceAvatarName', 'Sara — Rebel AI');
    } else if (/english|back to english/.test(text.toLowerCase())) {
      this.isHindiMode = false;
      this.addTranscript('sys', 'Switching to English mode…');
      setText('voiceAvatarName', 'Rebel AI');
    }

    this.setState('thinking');
    try {
      const prompt = this.isHindiMode
        ? `${CONFIG.SYSTEM_PROMPT} Please respond in Hindi.\n\nUser: ${text}`
        : text;
      const reply = await AIEngine.ask(prompt);
      this.addTranscript('ai', reply);
      await this.speak(reply);
    } catch (err) {
      this.setState('idle');
      this.addTranscript('sys', `Error: ${err.message}`);
    }
  },

  async speak(text) {
    this.isSpeaking = true;
    this.setState('speaking');
    const cleanText = text.replace(/<[^>]+>/g, '').replace(/[*#`]/g, '').slice(0, 1000);

    // Try ElevenLabs
    try {
      const key = this.getElevenKey();
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${CONFIG.ELEVEN_VOICE_ID}`, {
        method: 'POST',
        headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: cleanText,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 }
        })
      });
      if (res.ok) {
        const blob = await res.blob();
        const url  = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => { URL.revokeObjectURL(url); this._speechDone(); };
        audio.onerror = () => this._fallbackSpeak(cleanText);
        this._currentAudio = audio;
        await audio.play();
        return;
      } else if (res.status === 429 || res.status === 401) { this.rotateElevenKey(); }
    } catch {}

    // Fallback: Web Speech API
    this._fallbackSpeak(cleanText);
  },

  _fallbackSpeak(text) {
    if (!window.speechSynthesis) { this._speechDone(); return; }
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = this.isHindiMode ? 'hi-IN' : 'en-US';
    utt.rate = 0.95;
    utt.pitch = 0.9;
    const voices = window.speechSynthesis.getVoices();
    const pref = this.isHindiMode
      ? voices.find(v => v.lang.startsWith('hi'))
      : voices.find(v => v.lang === 'en-US' && /male|guy|david/i.test(v.name)) || voices.find(v => v.lang === 'en-US');
    if (pref) utt.voice = pref;
    utt.onend = () => this._speechDone();
    window.speechSynthesis.speak(utt);
  },

  _speechDone() {
    this.isSpeaking = false;
    this._currentAudio = null;
    this.setState('idle');
    this.startWakeWord();
  },

  stopSpeaking() {
    if (this._currentAudio) { this._currentAudio.pause(); this._currentAudio = null; }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    this._speechDone();
  },

  startWakeWord() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec || this.wakeActive || this.isListening) return;
    try {
      const wake = new SpeechRec();
      wake.lang = 'en-US';
      wake.continuous = true;
      wake.interimResults = true;
      this.wakeListener = wake;
      this.wakeActive = true;

      wake.onresult = (e) => {
        const last = e.results[e.results.length - 1];
        const text = last[0].transcript.toLowerCase();
        if (text.includes('hey rebel') || text.includes('hi rebel') || text.includes('hey, rebel')) {
          wake.stop();
          this.wakeActive = false;
          // Open voice modal if not open
          const modal = el('voiceModal');
          if (modal && !modal.classList.contains('show')) {
            Modal.open('voiceModal');
          }
          setTimeout(() => this.startListening(), 500);
        }
      };

      wake.onend = () => {
        this.wakeActive = false;
        const modal = el('voiceModal');
        if (!modal?.classList.contains('show') && !this.isListening) {
          setTimeout(() => this.startWakeWord(), 1500);
        }
      };

      wake.onerror = () => {
        this.wakeActive = false;
        setTimeout(() => this.startWakeWord(), 3000);
      };

      wake.start();
    } catch { this.wakeActive = false; }
  },
};

// ── ADMIN PANEL ──────────────────────────────────────────────
const AdminPanel = {
  _token: sessionStorage.getItem(KEYS.adminToken) || null,
  _cachedKeys: [],
  _activeTab: 'overview',
  _pollInterval: null,

  saveToken(t) { this._token = t; sessionStorage.setItem(KEYS.adminToken, t); },
  clearToken()  { this._token = null; sessionStorage.removeItem(KEYS.adminToken); },
  getToken()    { return this._token; },

  async api(path, opts = {}) {
    try {
      const headers = { ...(opts.headers || {}) };
      if (this.getToken()) headers['x-admin-token'] = this.getToken();
      const r = await fetch(apiUrl(path), { ...opts, headers });
      if (r.status === 401) { this.clearToken(); return { ok: false }; }
      return await r.json();
    } catch { return { ok: false }; }
  },

  async login(password) {
    const data = await this.api('/api/auth/verify', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ password })
    });
    if (data.ok && data.token) { this.saveToken(data.token); return true; }
    return false;
  },

  async logout() {
    await this.api('/api/auth/logout', { method: 'POST' });
    this.clearToken();
    stopPolling();
  },

  startPolling() {
    if (this._pollInterval) return;
    this._pollInterval = setInterval(async () => {
      if (!this.getToken()) return;
      const data = await this.api('/api/stats/poll');
      if (data.ok) this.applyStats(data);
    }, 4000);
  },

  stopPolling() {
    if (this._pollInterval) { clearInterval(this._pollInterval); this._pollInterval = null; }
  },

  applyStats(data) {
    setText('statTotalMessages', (data.totalMessages || 0).toLocaleString());
    setText('statTotalUsers', (data.totalUsers || 0).toLocaleString());
    setText('statActiveKeys', (data.activeKeys || 0).toLocaleString());
    setText('statAvgMs', data.avgMs ? data.avgMs + ' ms' : '—');
  },

  async renderUsers(filter = '') {
    const data = await this.api('/api/users');
    if (!data.ok) return;
    let list = data.users || [];
    if (filter) list = list.filter(u => (u.name + u.email).toLowerCase().includes(filter));
    const tbody = el('usersTableBody');
    if (!tbody) return;
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:20px">No users found</td></tr>'; return; }
    tbody.innerHTML = list.map(u => `
      <tr>
        <td style="color:var(--text-muted);font-size:0.75rem">#${u.id}</td>
        <td>
          <div style="display:flex;align-items:center;gap:9px">
            <div style="width:32px;height:32px;border-radius:50%;background:var(--gradient-primary);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.8rem;flex-shrink:0">${u.name.charAt(0).toUpperCase()}</div>
            <div>
              <div style="font-weight:600;font-size:0.85rem">${escHtml(u.name)}</div>
              <div style="font-size:0.7rem;color:var(--text-muted)">${u.device || 'Unknown'}</div>
            </div>
          </div>
        </td>
        <td style="font-size:0.8rem;color:var(--text-secondary)">${escHtml(u.email || '—')}</td>
        <td><span class="badge badge-${u.role.toLowerCase()}">${u.role}</span></td>
        <td><span class="badge badge-${u.status}">${u.status === 'active' ? '● Active' : '○ Inactive'}</span></td>
        <td style="font-weight:600;color:var(--accent-teal)">${(u.messages || 0).toLocaleString()}</td>
        <td style="font-size:0.75rem;color:var(--text-muted)">${u.last_login ? new Date(u.last_login).toLocaleDateString() : '—'}</td>
        <td>
          <button class="table-btn" title="Toggle" onclick="AdminPanel.toggleUser(${u.id})"><i class="fas fa-power-off"></i></button>
          <button class="table-btn danger" title="Delete" onclick="AdminPanel.deleteUser(${u.id})"><i class="fas fa-trash"></i></button>
        </td>
      </tr>`).join('');
  },

  async toggleUser(id) {
    await this.api('/api/users/' + id + '/toggle', { method: 'PUT' });
    this.renderUsers();
  },

  async deleteUser(id) {
    if (!confirm('Delete this user?')) return;
    await this.api('/api/users/' + id, { method: 'DELETE' });
    this.renderUsers();
    Toast.show('User deleted', 'success');
  },

  async renderApiKeys() {
    const data = await this.api('/api/keys');
    if (!data.ok) return;
    this._cachedKeys = data.keys || [];
    const tbody = el('apiKeysTableBody');
    if (!tbody) return;
    tbody.innerHTML = (this._cachedKeys).map(k => {
      const pct = Math.min(100, Math.round((k.usage / (k.max_limit || 1)) * 100));
      const masked = k.key_value.slice(0,12) + '••••';
      return `<tr>
        <td style="color:var(--text-muted);font-size:0.75rem">#${k.id}</td>
        <td style="font-weight:600">${escHtml(k.name)}</td>
        <td>
          <span id="mask_${k.id}" style="font-family:var(--font-mono);font-size:0.78rem;color:var(--text-muted)">${masked}</span>
          <span id="full_${k.id}" style="display:none;font-family:var(--font-mono);font-size:0.72rem;color:var(--accent-teal)">${k.key_value}</span>
          <button class="table-btn" onclick="AdminPanel.revealKey(${k.id})"><i class="fas fa-eye"></i></button>
        </td>
        <td>
          <div style="font-size:0.8rem;margin-bottom:4px">${k.usage}/${k.max_limit}</div>
          <div style="height:4px;background:rgba(255,255,255,0.07);border-radius:2px;width:80px"><div style="height:4px;background:${pct>80?'var(--accent-red)':pct>50?'var(--accent-yellow)':'var(--accent-green)'};border-radius:2px;width:${pct}%"></div></div>
        </td>
        <td><span class="badge badge-${k.status}">${k.status}</span></td>
        <td style="font-size:0.75rem;color:var(--text-muted)">${k.created}</td>
        <td>
          <button class="table-btn" onclick="AdminPanel.copyKey(${k.id})"><i class="fas fa-copy"></i></button>
          <button class="table-btn" onclick="AdminPanel.toggleKey(${k.id})"><i class="fas fa-power-off"></i></button>
          <button class="table-btn danger" onclick="AdminPanel.deleteKey(${k.id})"><i class="fas fa-trash"></i></button>
        </td>
      </tr>`;
    }).join('') || '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:20px">No API keys</td></tr>';
  },

  revealKey(id) {
    const m = el('mask_'+id), f = el('full_'+id);
    if (!m||!f) return;
    const show = f.style.display === 'none';
    f.style.display = show ? 'inline' : 'none';
    m.style.display = show ? 'none' : 'inline';
  },

  copyKey(id) {
    const k = this._cachedKeys.find(x => x.id === id);
    if (!k) return;
    navigator.clipboard.writeText(k.key_value).then(() => Toast.show('API key copied!', 'success'));
  },

  async toggleKey(id) {
    await this.api('/api/keys/' + id + '/toggle', { method: 'PUT' });
    this.renderApiKeys();
  },

  async deleteKey(id) {
    if (!confirm('Delete this key?')) return;
    await this.api('/api/keys/' + id, { method: 'DELETE' });
    this.renderApiKeys();
    Toast.show('Key deleted', 'success');
  },

  async renderLogs() {
    const filter = el('logFilterSelect')?.value || 'all';
    const url = filter !== 'all' ? `/api/logs?filter=${filter}` : '/api/logs';
    const data = await this.api(url);
    const terminal = el('logTerminal');
    if (!terminal) return;
    if (!data.ok) { terminal.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:20px">Unable to load logs</div>'; return; }
    terminal.innerHTML = (data.logs || []).map(log => {
      const t = new Date(log.created_at);
      const ts = t.toLocaleTimeString('en',{hour12:false}) + '.' + String(t.getMilliseconds()).padStart(3,'0');
      return `<div class="log-entry"><span class="log-time">${ts}</span><span class="log-level ${log.level}">[${(log.level||'info').toUpperCase()}]</span><span class="log-msg">${escHtml(log.msg)}</span></div>`;
    }).join('') || '<div style="color:var(--text-muted);text-align:center;padding:20px">No logs yet</div>';
    terminal.scrollTop = terminal.scrollHeight;
  },

  switchTab(tab) {
    this._activeTab = tab;
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-nav-item').forEach(b => b.classList.remove('active'));
    el(`tab-${tab}`)?.classList.add('active');
    document.querySelector(`.admin-nav-item[data-tab="${tab}"]`)?.classList.add('active');
    if (tab === 'overview') this.loadOverview();
    if (tab === 'users')    this.renderUsers();
    if (tab === 'apikeys')  this.renderApiKeys();
    if (tab === 'logs')     this.renderLogs();
    if (tab === 'settings') this.loadSettings();
  },

  async loadOverview() {
    const data = await this.api('/api/stats');
    if (data.ok) this.applyStats(data);
  },

  async loadSettings() {
    const data = await this.api('/api/settings');
    if (data.ok && data.settings) {
      const pe = el('systemPromptEdit');
      if (pe && data.settings.system_prompt) pe.value = data.settings.system_prompt;
    }
  },

  initDashboard() {
    this.switchTab('overview');
    this.startPolling();
    el('adminLoginBox').style.display = 'none';
    el('adminDashboard').style.display = 'flex';

    // Nav items
    document.querySelectorAll('.admin-nav-item[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
    });

    // Log filter
    el('logFilterSelect')?.addEventListener('change', () => this.renderLogs());

    // Clear logs
    el('clearLogsBtn')?.addEventListener('click', async () => {
      await this.api('/api/logs', { method: 'DELETE' });
      this.renderLogs();
    });

    // User search
    el('userSearchInput')?.addEventListener('input', (e) => this.renderUsers(e.target.value.toLowerCase()));

    // Save prompt
    el('savePromptBtn')?.addEventListener('click', async () => {
      const val = el('systemPromptEdit')?.value || '';
      await this.api('/api/settings', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({key:'system_prompt',val}) });
      showErr('promptSaveMsg', '✓ Saved!');
      setTimeout(() => showErr('promptSaveMsg', ''), 2500);
    });

    // Change password
    el('changePassBtn')?.addEventListener('click', async () => {
      const np = el('newAdminPass')?.value || '';
      const cp = el('confirmAdminPass')?.value || '';
      if (!np || np.length < 6) { showErr('passChangeMsg', 'Min 6 characters'); return; }
      if (np !== cp) { showErr('passChangeMsg', 'Passwords do not match'); return; }
      await this.api('/api/settings/password', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({new_pass:np}) });
      this.clearToken();
      showErr('passChangeMsg', '✓ Password changed! Please re-login.');
    });

    // Gen API key
    el('genApiKeyBtn')?.addEventListener('click', async () => {
      const name  = prompt('Key name:');
      if (!name) return;
      const limit = parseInt(prompt('Usage limit:', '1000') || '1000') || 1000;
      await this.api('/api/keys/generate', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name,limit}) });
      this.renderApiKeys();
      Toast.show('API key generated!', 'success');
    });

    // Logout
    el('adminLogoutBtn')?.addEventListener('click', async () => {
      await this.logout();
      el('adminDashboard').style.display = 'none';
      el('adminLoginBox').style.display = 'block';
    });

    // Close dash
    el('closeAdminDashBtn')?.addEventListener('click', () => {
      this.stopPolling();
      Modal.close('adminModal');
    });
  },
};
window.AdminPanel = AdminPanel;

// ── MAIN INIT ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // EmailJS init
  if (typeof emailjs !== 'undefined') {
    try { emailjs.init(CONFIG.EMAILJS.PUBLIC_KEY); } catch {}
  }

  // Scroll animation observer
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } });
  }, { threshold: 0.15 });
  document.querySelectorAll('.animate-in').forEach(el => observer.observe(el));

  // Navbar scroll
  const nav = el('mainNav');
  window.addEventListener('scroll', () => nav?.classList.toggle('scrolled', window.pageYOffset > 30), { passive: true });

  // Smooth scroll for nav links
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      const t = document.querySelector(a.getAttribute('href'));
      if (t) window.scrollTo({ top: t.offsetTop - 80, behavior: 'smooth' });
    });
  });

  // ── LANDING PAGE BUTTONS ──────────────────────────────────
  el('heroAccessBtn')?.addEventListener('click', openAccessPicker);
  el('heroVoiceBtn')?.addEventListener('click', () => {
    const user = UserSystem.getCurrent();
    user ? Modal.open('voiceModal') : openAuthModal('voice');
  });
  el('tryNowNavBtn')?.addEventListener('click', openAccessPicker);
  el('adminNavBtn')?.addEventListener('click', () => Modal.open('adminModal'));

  // ── ACCESS MODAL ─────────────────────────────────────────
  el('closeAccessModal')?.addEventListener('click', () => Modal.close('accessModal'));
  el('accessChatCard')?.addEventListener('click', () => {
    Modal.close('accessModal');
    const user = UserSystem.getCurrent();
    if (user) openChatApp(user); else openAuthModal('chat');
  });
  el('accessVoiceCard')?.addEventListener('click', () => {
    Modal.close('accessModal');
    const user = UserSystem.getCurrent();
    if (user) Modal.open('voiceModal'); else openAuthModal('voice');
  });

  // Close modals on backdrop click
  ['accessModal', 'authModal'].forEach(id => {
    el(id)?.addEventListener('click', e => { if (e.target === el(id)) Modal.close(id); });
  });

  // Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      ['accessModal','authModal','adminModal'].forEach(id => Modal.close(id));
    }
  });

  // ── AUTH FLOW ─────────────────────────────────────────────
  el('closeAuthModal')?.addEventListener('click', () => { Modal.close('authModal'); OTPEngine.clear(); });

  // Login
  el('loginBtn')?.addEventListener('click', doLogin);
  el('loginUsername')?.addEventListener('keypress', e => { if (e.key==='Enter') el('loginPassword')?.focus(); });
  el('loginPassword')?.addEventListener('keypress', e => { if (e.key==='Enter') doLogin(); });

  function doLogin() {
    const username = el('loginUsername')?.value.trim() || '';
    const password = el('loginPassword')?.value.trim() || '';
    clearErr('loginError');
    if (!username) { showErr('loginError', 'Please enter your username'); return; }
    if (!password) { showErr('loginError', 'Please enter your password'); return; }
    const user = UserSystem.login(username, password);
    if (!user) {
      showErr('loginError', 'Invalid username or password');
      el('loginPassword').style.borderColor = 'var(--accent-red)';
      setTimeout(() => { el('loginPassword').style.borderColor = ''; el('loginPassword').value = ''; }, 800);
      return;
    }
    Modal.close('authModal');
    OTPEngine.clear();
    afterLoginAction(user);
  }

  function afterLoginAction(user) {
    if (_pendingAction === 'voice') { Modal.open('voiceModal'); }
    else if (_pendingAction === 'picker') { Modal.open('accessModal'); }
    else { openChatApp(user); }
  }

  el('goRegisterBtn')?.addEventListener('click', () => {
    clearErr('emailError');
    el('authEmail').value = '';
    showAuthStep('authStepEmail');
    setTimeout(() => el('authEmail')?.focus(), 200);
  });

  el('backToLoginBtn')?.addEventListener('click', () => { OTPEngine.clear(); showAuthStep('authStepLogin'); });

  // Send OTP
  el('sendOtpBtn')?.addEventListener('click', async () => {
    const email = el('authEmail')?.value.trim() || '';
    clearErr('emailError');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showErr('emailError', 'Enter a valid email address'); return; }
    el('sendOtpBtn').disabled = true;
    el('sendOtpText').style.display = 'none';
    el('sendOtpLoader').style.display = 'inline';
    const result = await OTPEngine.send(email);
    el('sendOtpBtn').disabled = false;
    el('sendOtpText').style.display = 'inline';
    el('sendOtpLoader').style.display = 'none';
    if (result.ok) {
      setText('otpSentToLabel', `OTP sent to ${email}`);
      document.querySelectorAll('.otp-box').forEach(b => b.value = '');
      showAuthStep('authStepOtp');
      startResendTimer(60);
      if (result.devMode) showDevOtpToast(result.otp);
      setTimeout(() => document.querySelectorAll('.otp-box')[0]?.focus(), 200);
    } else {
      showErr('emailError', 'Failed to send OTP. Try again.');
    }
  });
  el('authEmail')?.addEventListener('keypress', e => { if (e.key==='Enter') el('sendOtpBtn')?.click(); });

  // OTP boxes
  const otpBoxes = document.querySelectorAll('.otp-box');
  otpBoxes.forEach((box, idx) => {
    box.addEventListener('input', function() {
      this.value = this.value.replace(/\D/g,'').slice(-1);
      if (this.value) { this.classList.add('filled'); if (idx < otpBoxes.length-1) otpBoxes[idx+1].focus(); }
      else this.classList.remove('filled');
      if ([...otpBoxes].every(b => b.value)) el('verifyOtpBtn')?.click();
    });
    box.addEventListener('keydown', function(e) {
      if (e.key === 'Backspace' && !this.value && idx > 0) { otpBoxes[idx-1].focus(); otpBoxes[idx-1].classList.remove('filled'); }
    });
    box.addEventListener('paste', function(e) {
      e.preventDefault();
      const paste = (e.clipboardData||window.clipboardData).getData('text').replace(/\D/g,'');
      otpBoxes.forEach((b,i) => { b.value = paste[i]||''; if (paste[i]) b.classList.add('filled'); });
      if (paste.length >= 6) el('verifyOtpBtn')?.click();
    });
  });

  let _otpAttempts = 0;
  el('verifyOtpBtn')?.addEventListener('click', () => {
    const entered = [...otpBoxes].map(b=>b.value).join('');
    if (entered.length < 6) { showErr('otpError', 'Enter all 6 digits'); return; }
    _otpAttempts++;
    if (_otpAttempts > 5) { showErr('otpError', 'Too many attempts. Please restart.'); setTimeout(() => { showAuthStep('authStepEmail'); OTPEngine.clear(); _otpAttempts=0; }, 2000); return; }
    if (OTPEngine.verify(entered)) {
      _otpAttempts = 0;
      clearErr('otpError');
      ['newUsername','newPassword','confirmPassword'].forEach(id => { const e = el(id); if(e) e.value=''; });
      showAuthStep('authStepCreate');
      setTimeout(() => el('newUsername')?.focus(), 200);
    } else {
      showErr('otpError', 'Incorrect OTP. Try again.');
      otpBoxes.forEach(b => { b.classList.add('error'); b.value=''; b.classList.remove('filled'); });
      setTimeout(() => otpBoxes.forEach(b => b.classList.remove('error')), 600);
      otpBoxes[0].focus();
    }
  });

  el('backToEmailBtn')?.addEventListener('click', () => { OTPEngine.clear(); _otpAttempts=0; showAuthStep('authStepEmail'); });
  el('resendOtpBtn')?.addEventListener('click', async () => {
    const email = OTPEngine.getEmail(); if (!email) { showAuthStep('authStepEmail'); return; }
    const r = await OTPEngine.send(email);
    if (r.ok) { _otpAttempts=0; startResendTimer(60); otpBoxes.forEach(b=>{b.value='';b.classList.remove('filled');}); clearErr('otpError'); if(r.devMode) showDevOtpToast(r.otp); }
    else showErr('otpError', 'Resend failed. Try again.');
  });

  // Create Account
  el('createAccountBtn')?.addEventListener('click', () => {
    const name = el('newUsername')?.value.trim() || '';
    const pass = el('newPassword')?.value.trim() || '';
    const conf = el('confirmPassword')?.value.trim() || '';
    clearErr('createError');
    if (!name || name.length < 2) { showErr('createError', 'Username must be at least 2 characters'); return; }
    if (name.length > 30)         { showErr('createError', 'Username too long (max 30 chars)'); return; }
    if (!pass || pass.length < 6) { showErr('createError', 'Password must be at least 6 characters'); return; }
    if (pass !== conf)            { showErr('createError', 'Passwords do not match'); el('confirmPassword').value=''; el('confirmPassword').focus(); return; }
    if (UserSystem.find(name))    { showErr('createError', 'Username already taken. Choose another.'); return; }
    const email = OTPEngine.getEmail();
    const user = UserSystem.register(name, email, pass);
    // Sync to backend
    try { fetch(apiUrl('/api/users/register'), {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,email,password:pass,device:user.device})}).catch(()=>{}); } catch {}
    OTPEngine.clear();
    // Pre-fill login
    const lun = el('loginUsername'); if(lun) lun.value = name;
    const sub = el('loginSubtitle'); if(sub) { sub.textContent='✓ Account created! Login with your credentials.'; sub.style.color='var(--accent-green)'; setTimeout(()=>{sub.textContent='Sign in to continue';sub.style.color='';}, 5000); }
    showAuthStep('authStepLogin');
    setTimeout(() => el('loginPassword')?.focus(), 200);
    Toast.show('Account created successfully!', 'success');
  });

  el('newUsername')?.addEventListener('keypress', e => { if(e.key==='Enter') el('newPassword')?.focus(); });
  el('newPassword')?.addEventListener('keypress', e => { if(e.key==='Enter') el('confirmPassword')?.focus(); });
  el('confirmPassword')?.addEventListener('keypress', e => { if(e.key==='Enter') el('createAccountBtn')?.click(); });

  function startResendTimer(seconds) {
    const btn = el('resendOtpBtn');
    const timer = el('resendTimer');
    if (btn) btn.disabled = true;
    clearInterval(_resendTimer);
    let s = seconds;
    if (timer) timer.textContent = ` (${s}s)`;
    _resendTimer = setInterval(() => {
      s--;
      if (timer) timer.textContent = s > 0 ? ` (${s}s)` : '';
      if (s <= 0) { clearInterval(_resendTimer); if (btn) btn.disabled = false; }
    }, 1000);
  }

  function showDevOtpToast(otp) {
    Toast.show(`Dev OTP: <strong style="font-size:1.2rem;letter-spacing:3px;color:var(--accent-teal)">${otp}</strong>`, 'info', 20000);
  }

  // ── CHAT APP ───────────────────────────────────────────────
  el('closeChatBtn')?.addEventListener('click', () => {
    el('chatApp').classList.add('hidden');
    el('landingPage').classList.remove('hidden');
    document.body.style.overflow = '';
  });

  el('newChatBtn')?.addEventListener('click', newConversation);

  // Toggle sidebar
  el('toggleSidebar')?.addEventListener('click', () => {
    const sidebar = el('chatSidebar');
    sidebar.classList.toggle('mobile-open');
    sidebar.classList.toggle('collapsed');
  });
  el('sidebarOverlay')?.addEventListener('click', () => {
    el('chatSidebar').classList.remove('mobile-open');
  });

  el('sidebarVoiceBtn')?.addEventListener('click', () => Modal.open('voiceModal'));

  // Textarea auto-resize & send
  const textarea = el('chatTextarea');
  textarea?.addEventListener('input', () => {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 180) + 'px';
    updateSendBtn();
  });
  textarea?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      doSendCurrent();
    }
  });

  el('sendMsgBtn')?.addEventListener('click', doSendCurrent);

  async function doSendCurrent() {
    const text = el('chatTextarea')?.value.trim() || '';
    if (!text && !_selectedImage) return;
    el('chatTextarea').value = '';
    el('chatTextarea').style.height = 'auto';
    updateSendBtn();
    await doSendMessage(text, _selectedImage, true);
    _selectedImage = null;
    el('imagePreviewBar').classList.remove('visible');
    el('imageFileInput').value = '';
  }

  // Image upload
  el('uploadImageBtn')?.addEventListener('click', () => el('imageFileInput')?.click());
  el('imageFileInput')?.addEventListener('change', function() {
    const file = this.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      _selectedImage = e.target.result;
      el('previewThumb').src = _selectedImage;
      setText('previewFileName', file.name);
      setText('previewFileSize', (file.size / 1024).toFixed(0) + ' KB');
      el('imagePreviewBar').classList.add('visible');
      updateSendBtn();
    };
    reader.readAsDataURL(file);
  });
  el('removeImageBtn')?.addEventListener('click', () => {
    _selectedImage = null;
    el('imageFileInput').value = '';
    el('imagePreviewBar').classList.remove('visible');
    updateSendBtn();
  });

  // Voice input in chat
  el('voiceInputBtn')?.addEventListener('click', () => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) { Toast.show('Speech recognition not supported', 'error'); return; }
    const rec = new SpeechRec();
    rec.lang = 'en-US';
    rec.interimResults = true;
    const btn = el('voiceInputBtn');
    btn?.classList.add('active');
    rec.onresult = (e) => {
      const text = [...e.results].map(r=>r[0].transcript).join('');
      if (el('chatTextarea')) { el('chatTextarea').value = text; updateSendBtn(); }
    };
    rec.onend = () => btn?.classList.remove('active');
    rec.start();
  });

  // Suggestion cards
  document.querySelectorAll('.suggestion-card').forEach(card => {
    card.addEventListener('click', () => {
      const prompt = card.dataset.prompt;
      if (prompt && el('chatTextarea')) {
        el('chatTextarea').value = prompt;
        updateSendBtn();
        el('chatTextarea').focus();
      }
    });
  });

  // Keyboard shortcut Ctrl/Cmd+N for new chat
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'n' && !el('chatApp').classList.contains('hidden')) {
      e.preventDefault();
      newConversation();
    }
  });

  // ── VOICE MODAL ───────────────────────────────────────────
  el('voiceCloseBtn')?.addEventListener('click', () => {
    VoiceAssistant.stopListening();
    VoiceAssistant.stopSpeaking();
    Modal.close('voiceModal');
  });
  el('voiceMicBtn')?.addEventListener('click', () => VoiceAssistant.startListening());
  el('voiceStopSpeakBtn')?.addEventListener('click', () => VoiceAssistant.stopSpeaking());
  el('voiceClearBtn')?.addEventListener('click', () => {
    const t = el('voiceTranscript');
    if (t) { t.innerHTML = '<div class="transcript-msg sys"><span class="transcript-tag">SYS</span>Transcript cleared.</div>'; }
  });

  document.querySelectorAll('.quick-cmd-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cmd = btn.dataset.cmd;
      if (cmd && !VoiceAssistant.isListening && !VoiceAssistant.isSpeaking) {
        VoiceAssistant.addTranscript('user', cmd);
        VoiceAssistant.queryAI(cmd);
      }
    });
  });

  VoiceAssistant.init();

  // ── ADMIN MODAL ───────────────────────────────────────────
  el('adminLoginBtn')?.addEventListener('click', async () => {
    const pass = el('adminPassInput')?.value || '';
    clearErr('adminLoginError');
    if (!pass) { showErr('adminLoginError', 'Enter admin password'); return; }
    el('adminLoginBtn').disabled = true;
    el('adminLoginBtn').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in…';
    const ok = await AdminPanel.login(pass);
    el('adminLoginBtn').disabled = false;
    el('adminLoginBtn').innerHTML = '<i class="fas fa-sign-in-alt"></i> Login to Admin';
    if (ok) {
      AdminPanel.initDashboard();
    } else {
      showErr('adminLoginError', 'Invalid admin password');
      el('adminPassInput').value = '';
      Log.add('warn', 'Failed admin login attempt');
    }
  });
  el('adminPassInput')?.addEventListener('keypress', e => { if(e.key==='Enter') el('adminLoginBtn')?.click(); });

  el('closeAdminLoginBtn')?.addEventListener('click', () => Modal.close('adminModal'));
  el('adminModal')?.addEventListener('click', e => { if(e.target===el('adminModal')) Modal.close('adminModal'); });

  // Check if already admin logged in
  if (AdminPanel.getToken()) {
    el('adminLoginBox').style.display = 'none';
    el('adminDashboard').style.display = 'flex';
    AdminPanel.initDashboard();
  }

  // ── SIDEBAR SEARCH ────────────────────────────────────────
  el('sidebarSearch')?.addEventListener('input', function() {
    const q = this.value.toLowerCase();
    document.querySelectorAll('.conv-item').forEach(item => {
      const title = item.querySelector('.conv-title')?.textContent.toLowerCase() || '';
      item.style.display = title.includes(q) ? '' : 'none';
    });
  });

  // ── AUTO-OPEN CHAT IF LOGGED IN ───────────────────────────
  // Don't auto-open; let user decide from landing page
  const user = UserSystem.getCurrent();
  if (user) {
    // Update any logged-in UI elements
    const av = el('sidebarAvatar');
    if (av) av.textContent = user.name.charAt(0).toUpperCase();
    setText('sidebarUserName', user.name);
  }

  // Init analytics session ping
  Analytics.pingSession();

  // ── Prevent scroll during modals ─────────────────────────
  document.querySelectorAll('.modal-overlay, .voice-modal-overlay, .admin-modal-overlay').forEach(m => {
    m.addEventListener('wheel', e => e.preventDefault(), { passive: false });
  });

});
