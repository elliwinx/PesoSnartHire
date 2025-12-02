document.addEventListener("DOMContentLoaded", () => {
  const convoList = document.getElementById("convoList");
  const adminChatBody = document.getElementById("adminChatBody");
  const adminMsgInput = document.getElementById("adminMsgInput");
  const sendBtn = document.getElementById("sendBtn");
  const activeUserLabel = document.getElementById("activeUser");

  let activeConvoId = null;
  let pollingInterval = null;

  // 1. Initial Load of Conversations
  loadConversations();

  // 2. Poll Conversation List every 5 seconds (to check for new incoming chats)
  setInterval(loadConversations, 5000);

  // 3. Poll Active Chat every 3 seconds (if a chat is open)
  setInterval(() => {
    if (activeConvoId) loadAdminMessages();
  }, 3000);

  // --- Functions ---

  async function loadConversations() {
    try {
      const res = await fetch("/api/admin/conversations");
      if (!res.ok) return;
      const convos = await res.json();

      renderConversationList(convos);
    } catch (e) {
      console.error("Error loading conversations:", e);
    }
  }

  function renderConversationList(convos) {
    if (!convoList) return;

    const html = convos
      .map(
        (c) => `
            <div class="convo-item ${
              c.conversation_id === activeConvoId ? "active" : ""
            }" 
                 onclick="selectConversation(${
                   c.conversation_id
                 }, '${escapeHtml(c.user_name)}', '${c.user_type}')">
                
                ${
                  c.unread_count > 0
                    ? `<span class="unread-badge">${c.unread_count}</span>`
                    : ""
                }
                
                <strong>${escapeHtml(c.user_name || "Unknown User")}</strong>
                <small style="text-transform:capitalize;">
                    ${c.user_type} 
                    <span style="float:right; font-size:10px; color:#999;">${formatDate(
                      c.last_message_at
                    )}</span>
                </small>
            </div>
        `
      )
      .join("");

    // Simple check to avoid DOM trashing if list hasn't changed much
    // (Optional: You can implement smarter diffing here)
    convoList.innerHTML = html;
  }

  window.selectConversation = function (id, name, type) {
    activeConvoId = id;
    activeUserLabel.textContent = `${name} (${type})`;

    // Enable Inputs
    adminMsgInput.disabled = false;
    sendBtn.disabled = false;

    // Focus Input
    adminMsgInput.focus();

    // Load Messages Immediately
    loadAdminMessages();
  };

  async function loadAdminMessages() {
    if (!activeConvoId) return;

    try {
      const res = await fetch(`/api/admin/conversation/${activeConvoId}`);
      if (!res.ok) return;
      const messages = await res.json();

      renderChatBody(messages);
    } catch (e) {
      console.error("Error loading messages:", e);
    }
  }

  function renderChatBody(messages) {
    if (!adminChatBody) return;

    const html = messages
      .map(
        (m) => `
            <div class="msg ${m.sender_type}">
                ${escapeHtml(m.message)}
                <div style="font-size:9px; opacity:0.7; margin-top:2px; text-align:${
                  m.sender_type === "admin" ? "right" : "left"
                }">
                    ${formatTime(m.created_at)}
                </div>
            </div>
        `
      )
      .join("");

    // Only update if content changed (prevents scroll jumping)
    // Checking length is a simple proxy for "has content changed"
    if (adminChatBody.innerHTML.length !== html.length) {
      adminChatBody.innerHTML = html;
      adminChatBody.scrollTop = adminChatBody.scrollHeight;
    }
  }

  window.sendAdminReply = async function () {
    const text = adminMsgInput.value.trim();
    if (!text || !activeConvoId) return;

    adminMsgInput.value = ""; // Clear immediately

    // Optimistic Append
    adminChatBody.innerHTML += `
            <div class="msg admin">
                ${escapeHtml(text)}
                <div style="font-size:9px; opacity:0.7; margin-top:2px; text-align:right">Just now</div>
            </div>`;
    adminChatBody.scrollTop = adminChatBody.scrollHeight;

    try {
      await fetch("/api/admin/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: activeConvoId,
          message: text,
        }),
      });
      loadAdminMessages(); // Sync
      loadConversations(); // Update sidebar timestamp/order
    } catch (e) {
      console.error("Failed to send:", e);

      if (typeof showFlashMessage === "function") {
        showFlashMessage("Failed to send message.", "danger");
      } else {
        console.warn("showFlashMessage not found, unable to display UI error.");
      }
    }
  };

  // Enter key to send
  if (adminMsgInput) {
    adminMsgInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") window.sendAdminReply();
    });
  }

  // Utils
  function escapeHtml(text) {
    if (!text) return text;
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function formatTime(dateString) {
    if (!dateString) return "";
    return new Date(dateString).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatDate(dateString) {
    if (!dateString) return "";
    const d = new Date(dateString);
    const now = new Date();
    // If today, show time. If older, show date.
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString();
  }
});
