document.addEventListener("DOMContentLoaded", () => {
  const chatInterface = document.getElementById("chat-interface");
  const chatBody = document.getElementById("chat-body");
  let chatInterval = null;
  let isChatOpen = false;

  // Expose toggle function globally
  window.toggleChatWindow = function () {
    if (!chatInterface) return;

    isChatOpen = !isChatOpen;

    if (isChatOpen) {
      chatInterface.classList.remove("hidden");
      loadMessages();
      // Start polling every 3 seconds
      chatInterval = setInterval(loadMessages, 3000);
      scrollToBottom();
    } else {
      chatInterface.classList.add("hidden");
      if (chatInterval) clearInterval(chatInterval);
    }
  };

  // Handle "Enter" key in input
  window.handleEnter = function (e) {
    if (e.key === "Enter") sendUserMessage();
  };

  // Send Message Function
  window.sendUserMessage = async function () {
    const input = document.getElementById("userMsgInput");
    const text = input.value.trim();
    if (!text) return;

    input.value = ""; // Clear input

    // Optimistic UI: Show message immediately
    appendMessage(text, "user");
    scrollToBottom();

    try {
      await fetch("/api/send_message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      // Fetch latest to ensure sync
      loadMessages();
    } catch (err) {
      console.error("Failed to send message:", err);
      // Optional: Show error state on the message
    }
  };

  async function loadMessages() {
    try {
      const res = await fetch("/api/my_messages");
      if (!res.ok) return;

      const data = await res.json();
      if (data.success) {
        renderMessages(data.messages);
      }
    } catch (e) {
      console.error(e);
    }
  }

  function renderMessages(messages) {
    if (!chatBody) return;

    if (messages.length === 0) {
      chatBody.innerHTML =
        '<div style="text-align:center; color:#999; font-size:12px; margin-top:20px;">No messages yet.<br>Start a conversation with our admin!</div>';
      return;
    }

    // Build HTML string
    const html = messages
      .map(
        (m) => `
            <div class="msg ${m.sender_type === "user" ? "user" : "admin"}">
                ${escapeHtml(m.message)}
                <div style="font-size:9px; opacity:0.7; text-align:${
                  m.sender_type === "user" ? "right" : "left"
                }; margin-top:2px;">
                    ${formatTime(m.created_at)}
                </div>
            </div>
        `
      )
      .join("");

    // Only update DOM if content is different (prevents flickering)
    // Note: simplistic check, can be improved with diffing if needed
    if (chatBody.innerHTML.length !== html.length) {
      // We use length check as a rough proxy to avoid replacing DOM if identical
      // Ideally compare actual content strings, but timestamps might drift slightly in some systems
      chatBody.innerHTML = html;
      scrollToBottom();
    }
  }

  function appendMessage(text, type) {
    const div = document.createElement("div");
    div.className = `msg ${type}`;
    div.textContent = text;
    chatBody.appendChild(div);
  }

  function scrollToBottom() {
    if (chatBody) chatBody.scrollTop = chatBody.scrollHeight;
  }

  // Utility: Prevent XSS
  function escapeHtml(text) {
    if (!text) return text;
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatTime(dateString) {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
});
