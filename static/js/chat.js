let chatBody = null;
let chatInterval = null;
let isChatOpen = false;
let quickOptionsContainer = null;
let showSecondaryNext = false;
window.postChatShown = false;
let chatSessionEnded = false;

document.addEventListener("DOMContentLoaded", () => {
    chatBody = document.getElementById("chat-body");
    const chatInterface = document.getElementById("chat-interface");

    // 1. START POLLING IMMEDIATELY (Even if chat is closed)
    // This ensures we catch messages and show the badge on page load
    loadMessages();
    
    // Check for new messages every 3 seconds perpetually
    if (!chatInterval) {
        chatInterval = setInterval(loadMessages, 3000);
    }

    // Expose toggle function globally
// Expose toggle function globally
    window.toggleChatWindow = function () {
        if (!chatInterface) return;

        isChatOpen = !isChatOpen;

        if (isChatOpen) {
            chatInterface.classList.remove("hidden");

            // 1. Hide Badge Immediately
            const chatNotifBadge = document.getElementById("chatNotifBadge");
            if (chatNotifBadge) chatNotifBadge.style.display = "none";

            // 2. FORCE DATA LOAD IMMEDIATELY
            // This runs renderMessages(), which triggers the LocalStorage update
            // so the system knows you've "Seen" the message instantly.
            loadMessages(); 

            // If chat session ended, show the fixed message
            if (chatSessionEnded) {
                if (chatBody) {
                    chatBody.innerHTML = `
                        <div class="msg admin" style="
                            padding:15px; border-radius:10px; background:#f1f1f1; 
                            margin:10px 0; box-shadow:0 2px 6px rgba(0,0,0,0.1);
                            text-align:center; color:#666;
                        ">
                            Chat session ended. Thanks for chatting with us.
                        </div>
                    `;
                }
                return; 
            }
            
            scrollToBottom();
        } else {
            chatInterface.classList.add("hidden");

            // Mark session as ended
            chatSessionEnded = true;
        }
    };

    // Handle "Enter" key in input
    window.handleEnter = function (e) {
        if (e.key === "Enter") sendUserMessage();
    };
});

// ===== Send User Message =====
window.sendUserMessage = async function () {
    const input = document.getElementById("userMsgInput");
    const text = input.value.trim();
    if (!text) return;

    // Reset session if user sends a new message
    if (chatSessionEnded) chatSessionEnded = false;

    input.value = ""; // Clear input

    appendMessage(text, "user");
    scrollToBottom();

    try {
        await fetch("/api/send_message", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: text }),
        });
        loadMessages();
    } catch (err) {
        console.error("Failed to send message:", err);
    }
};

// ===== Load Messages =====
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

// ===== Render Messages =====
function renderMessages(messages) {
    if (!chatBody) return;

    // Save existing quick options container
    const existingQuickOptions = quickOptionsContainer;

    chatBody.innerHTML = "";
    if (existingQuickOptions) chatBody.appendChild(existingQuickOptions);

    // Append messages
    messages.forEach(m => {
        const div = document.createElement("div");
        div.className = `msg ${m.sender_type === "user" ? "user" : "admin"}`;
        
        // Ensure we have a valid ID or fallback to timestamp for tracking
        const msgId = m.id || m.created_at;
        div.setAttribute("data-msg-id", msgId); // Helpful for debugging

        div.innerHTML = `
            ${escapeHtml(m.message)}
            <div style="font-size:9px; opacity:0.7; text-align:${m.sender_type === "user" ? "right" : "left"}; margin-top:2px;">
                ${formatTime(m.created_at)}
            </div>
        `;
        chatBody.insertBefore(div, existingQuickOptions);
    });

    // Initialize quick options container if missing
    if (!quickOptionsContainer) {
        quickOptionsContainer = document.createElement("div");
        quickOptionsContainer.id = "quick-options-container";
        chatBody.appendChild(quickOptionsContainer);
    }

    // Add Step 2 if needed
    if (showSecondaryNext && !document.getElementById("post-chat-options-step2")) {
        showStep2Options(); // Refactored to reuse the existing function
    }

    // Auto-show post-chat options Step 1 for admin message
    const last = messages[messages.length - 1];
    if (last?.sender_type === "admin" && !window.postChatShown) {
        window.postChatShown = true;
        setTimeout(() => {
            showPostChatOptions();
            scrollToBottom();
        }, 1500);
    }

    // === UPDATED NOTIFICATION BADGE LOGIC ===
    const chatNotifBadge = document.getElementById("chatNotifBadge");
    const lastMsg = messages[messages.length - 1];
    
    // Unique ID for the last message (prefer ID, fallback to timestamp)
    const lastMsgId = lastMsg ? (lastMsg.id || lastMsg.created_at) : null;
    
    // Get the last message ID that the user actually SAW
    const seenMsgId = localStorage.getItem("chat_last_seen_id");

    if (isChatOpen) {
        // Since chat is open, we "read" the message immediately
        if (lastMsgId) {
            localStorage.setItem("chat_last_seen_id", lastMsgId);
        }
        // Hide badge while chat is open
        if (chatNotifBadge) chatNotifBadge.style.display = "none";
        
        scrollToBottom();
    } else {
        // Chat is CLOSED. Check if we should show badge.
        // Show ONLY if:
        // 1. Last sender is Admin
        // 2. AND The current last message ID is NOT the same as the one we last saw
        if (lastMsg?.sender_type === "admin" && lastMsgId != seenMsgId) {
            if (chatNotifBadge) {
                chatNotifBadge.style.display = "inline-block";
                chatNotifBadge.classList.add("pulse-animation"); // Optional: add simple animation class if defined
            }
        } else {
            if (chatNotifBadge) chatNotifBadge.style.display = "none";
        }
    }
}

// ===== Append Message =====
function appendMessage(text, type) {
    if (!chatBody) chatBody = document.getElementById("chat-body");
    const div = document.createElement("div");
    div.className = `msg ${type}`;
    div.textContent = text;
    chatBody.appendChild(div);
    scrollToBottom();
}

// ===== Escape HTML =====
function escapeHtml(text) {
    if (!text) return text;
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ===== Format Time =====
function formatTime(dateString) {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ===== Scroll to Bottom =====
function scrollToBottom() {
    if (!chatBody) chatBody = document.getElementById("chat-body");
    if (chatBody) chatBody.scrollTop = chatBody.scrollHeight;
}

// ===== Post Chat Options Step 1 =====
function showPostChatOptions() {
    if (!chatBody) chatBody = document.getElementById("chat-body");
    if (!chatBody || document.getElementById("post-chat-options-step1")) return;

    if (!quickOptionsContainer) {
        quickOptionsContainer = document.createElement("div");
        quickOptionsContainer.id = "quick-options-container";
        chatBody.appendChild(quickOptionsContainer);
    }

    quickOptionsContainer.innerHTML = `
        <div class="msg admin" id="post-chat-options-step1" style="
            padding:15px; border-radius:10px; background:#f1f1f1; 
            margin:10px 0; box-shadow:0 2px 6px rgba(0,0,0,0.1); display:flex; flex-direction:column; gap:10px;
        ">
            <p style="margin:0 0 10px; font-weight:500;">Is there anything else I can help you with?</p>
            <div class="quick-options" style="display:flex; gap:8px;">
                <button class="chat-option-btn" onclick="handleYesNo('Yes')">Yes</button>
                <button class="chat-option-btn" onclick="handleYesNo('No')">No</button>
            </div>
        </div>
    `;
    scrollToBottom();
}

// ===== Handle Yes/No =====
function handleYesNo(option) {
    quickSelect(option);

    if (option === "Yes") {
        showSecondaryNext = true;

        setTimeout(() => {
            if (quickOptionsContainer) quickOptionsContainer.innerHTML = "";
            showStep2Options();
            scrollToBottom();
        }, 500);

    } else {
        showSecondaryNext = false;
        if (quickOptionsContainer) quickOptionsContainer.innerHTML = "";
    }
}

// ===== Quick Select =====
window.quickSelect = function (option) {
    const input = document.getElementById("userMsgInput");
    input.value = option;

    sendUserMessage();

    if (option === "Check my application" || 
        option === "Report a job" || 
        option === "Reset my password") {

        setTimeout(() => {
            if (quickOptionsContainer) quickOptionsContainer.innerHTML = "";
            showSecondaryNext = false;
            showPostChatOptions();
            scrollToBottom();
        }, 1000);
    }
};

function showStep2Options() {
    if (!quickOptionsContainer) return;

    quickOptionsContainer.innerHTML = `
        <div class="msg admin" id="post-chat-options-step2" style="
            padding:15px; border-radius:10px; background:#f1f1f1; 
            margin:10px 0; box-shadow:0 2px 6px rgba(0,0,0,0.1); display:flex; flex-direction:column; gap:10px;
        ">
            <p style="margin:0 0 6px; font-size:12px; color:#666;">Or pick a quick option:</p>
            <div class="quick-options" style="display:flex; gap:8px; flex-wrap:wrap;">
                <button class="chat-option-btn" onclick="quickSelect('Check my application')">Check my application</button>
                <button class="chat-option-btn" onclick="quickSelect('Report a job')">Report a job</button>
                <button class="chat-option-btn" onclick="quickSelect('Reset my password')">Reset my password</button>
            </div>
        </div>
    `;
}