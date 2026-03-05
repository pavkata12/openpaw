/**
 * Chat History Manager - Frontend JavaScript
 * Manages conversation history sidebar, session switching, and persistence
 */

class ChatHistoryManager {
  constructor() {
    this.sessions = [];
    this.currentSessionId = null;
    this.init();
  }

  init() {
    this.loadSessions();
    this.setupEventListeners();
    this.currentSessionId = localStorage.getItem('openpaw-current-session') || this.createNewSession();
  }

  /**
   * Load all sessions from server
   */
  async loadSessions() {
    try {
      const response = await fetch('/api/sessions');
      if (!response.ok) throw new Error('Failed to load sessions');
      
      const data = await response.json();
      this.sessions = data.sessions || [];
      this.renderSessionList();
    } catch (e) {
      console.error('Failed to load sessions:', e);
    }
  }

  /**
   * Create new session
   */
  createNewSession() {
    const sessionId = crypto.randomUUID();
    localStorage.setItem('openpaw-current-session', sessionId);
    localStorage.setItem(`openpaw-session-${sessionId}`, JSON.stringify({
      id: sessionId,
      title: 'New Chat',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: []
    }));
    return sessionId;
  }

  /**
   * Switch to a session
   */
  switchSession(sessionId) {
    this.currentSessionId = sessionId;
    localStorage.setItem('openpaw-current-session', sessionId);
    
    // Clear current chat
    const chatLog = document.getElementById('chatLog');
    if (chatLog) chatLog.innerHTML = '';
    
    // Load session messages
    this.loadSessionMessages(sessionId);
    
    // Update UI
    this.renderSessionList();
  }

  /**
   * Load messages for a session
   */
  async loadSessionMessages(sessionId) {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`);
      if (!response.ok) throw new Error('Failed to load session');
      
      const data = await response.json();
      const session = data.session;
      
      if (!session || !session.history) return;
      
      const chatLog = document.getElementById('chatLog');
      if (!chatLog) return;
      
      // Render messages
      session.history.forEach(msg => {
        const div = document.createElement('div');
        div.className = msg.role === 'user' ? 'msg you' : 'msg paw';
        div.textContent = msg.content;
        chatLog.appendChild(div);
      });
      
      chatLog.scrollTop = chatLog.scrollHeight;
    } catch (e) {
      console.error('Failed to load session messages:', e);
    }
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId) {
    if (!confirm('Delete this conversation?')) return;
    
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) throw new Error('Failed to delete session');
      
      // Remove from localStorage
      localStorage.removeItem(`openpaw-session-${sessionId}`);
      
      // If current session, switch to new
      if (sessionId === this.currentSessionId) {
        this.currentSessionId = this.createNewSession();
      }
      
      await this.loadSessions();
    } catch (e) {
      console.error('Failed to delete session:', e);
    }
  }

  /**
   * Rename session
   */
  async renameSession(sessionId, newTitle) {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle })
      });
      
      if (!response.ok) throw new Error('Failed to rename session');
      
      await this.loadSessions();
    } catch (e) {
      console.error('Failed to rename session:', e);
    }
  }

  /**
   * Render session list in sidebar
   */
  renderSessionList() {
    const container = document.getElementById('sessionList');
    if (!container) return;
    
    if (this.sessions.length === 0) {
      container.innerHTML = `
        <div class="empty-sessions">
          <p>No conversations yet</p>
          <p class="hint">Start chatting to create your first conversation</p>
        </div>
      `;
      return;
    }
    
    // Sort by updated date (newest first)
    const sorted = [...this.sessions].sort((a, b) => b.updatedAt - a.updatedAt);
    
    // Group by date
    const today = new Date().setHours(0, 0, 0, 0);
    const yesterday = today - 24 * 60 * 60 * 1000;
    const weekAgo = today - 7 * 24 * 60 * 60 * 1000;
    
    const groups = {
      today: [],
      yesterday: [],
      week: [],
      older: []
    };
    
    sorted.forEach(session => {
      const date = new Date(session.updatedAt).setHours(0, 0, 0, 0);
      if (date === today) groups.today.push(session);
      else if (date === yesterday) groups.yesterday.push(session);
      else if (date >= weekAgo) groups.week.push(session);
      else groups.older.push(session);
    });
    
    let html = '';
    
    if (groups.today.length) {
      html += '<div class="session-group"><div class="group-label">Today</div>';
      html += groups.today.map(s => this.renderSessionItem(s)).join('');
      html += '</div>';
    }
    
    if (groups.yesterday.length) {
      html += '<div class="session-group"><div class="group-label">Yesterday</div>';
      html += groups.yesterday.map(s => this.renderSessionItem(s)).join('');
      html += '</div>';
    }
    
    if (groups.week.length) {
      html += '<div class="session-group"><div class="group-label">Previous 7 days</div>';
      html += groups.week.map(s => this.renderSessionItem(s)).join('');
      html += '</div>';
    }
    
    if (groups.older.length) {
      html += '<div class="session-group"><div class="group-label">Older</div>';
      html += groups.older.map(s => this.renderSessionItem(s)).join('');
      html += '</div>';
    }
    
    container.innerHTML = html;
    
    // Attach event listeners
    this.attachSessionListeners();
  }

  /**
   * Render single session item
   */
  renderSessionItem(session) {
    const isActive = session.key === `web:web-${this.currentSessionId}`;
    const title = this.getSessionTitle(session);
    const preview = this.getSessionPreview(session);
    const time = this.formatTime(session.updatedAt);
    
    return `
      <div class="session-item ${isActive ? 'active' : ''}" data-session-id="${session.key}">
        <div class="session-info">
          <div class="session-title">${this.escapeHtml(title)}</div>
          <div class="session-preview">${this.escapeHtml(preview)}</div>
          <div class="session-time">${time}</div>
        </div>
        <div class="session-actions">
          <button class="btn-icon btn-rename" title="Rename" data-action="rename">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button class="btn-icon btn-delete" title="Delete" data-action="delete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Get session title (from first message or default)
   */
  getSessionTitle(session) {
    if (session.title) return session.title;
    
    const firstUserMsg = session.history?.find(m => m.role === 'user');
    if (firstUserMsg) {
      return firstUserMsg.content.substring(0, 50) + (firstUserMsg.content.length > 50 ? '...' : '');
    }
    
    return 'New Chat';
  }

  /**
   * Get session preview (last message)
   */
  getSessionPreview(session) {
    if (!session.history || session.history.length === 0) return 'No messages yet';
    
    const lastMsg = session.history[session.history.length - 1];
    const content = lastMsg.content.substring(0, 60);
    return content + (lastMsg.content.length > 60 ? '...' : '');
  }

  /**
   * Format timestamp
   */
  formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    
    return date.toLocaleDateString();
  }

  /**
   * Escape HTML
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Attach event listeners to session items
   */
  attachSessionListeners() {
    document.querySelectorAll('.session-item').forEach(item => {
      const sessionKey = item.dataset.sessionId;
      
      // Click to switch session
      item.addEventListener('click', (e) => {
        if (e.target.closest('.session-actions')) return;
        const sessionId = sessionKey.replace('web:web-', '');
        this.switchSession(sessionId);
      });
      
      // Rename button
      const renameBtn = item.querySelector('[data-action="rename"]');
      if (renameBtn) {
        renameBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const newTitle = prompt('Enter new title:');
          if (newTitle) {
            this.renameSession(sessionKey, newTitle);
          }
        });
      }
      
      // Delete button
      const deleteBtn = item.querySelector('[data-action="delete"]');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const sessionId = sessionKey.replace('web:web-', '');
          this.deleteSession(sessionId);
        });
      }
    });
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // New chat button
    const newChatBtn = document.getElementById('newChatBtn');
    if (newChatBtn) {
      newChatBtn.addEventListener('click', () => {
        this.currentSessionId = this.createNewSession();
        this.switchSession(this.currentSessionId);
      });
    }
    
    // Toggle sidebar
    const toggleBtn = document.getElementById('toggleSidebar');
    const sidebar = document.getElementById('sidebar');
    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        localStorage.setItem('sidebar-collapsed', sidebar.classList.contains('collapsed'));
      });
      
      // Restore sidebar state
      if (localStorage.getItem('sidebar-collapsed') === 'true') {
        sidebar.classList.add('collapsed');
      }
    }
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  window.chatHistory = new ChatHistoryManager();
});
