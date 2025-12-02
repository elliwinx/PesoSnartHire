from flask import Blueprint, request, jsonify, session, render_template
from db_connection import create_connection, run_query
from datetime import datetime

chat_bp = Blueprint("chat", __name__)

# --- UTILS ---


def get_current_user():
    """Helper to identify who is logged in"""
    if 'applicant_id' in session:
        return session['applicant_id'], 'applicant'
    elif 'employer_id' in session:
        return session['employer_id'], 'employer'
    return None, None

# --- USER SIDE (Applicant/Employer) ---


@chat_bp.route("/api/my_messages", methods=["GET"])
def get_my_messages():
    user_id, user_type = get_current_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    conn = create_connection()
    # 1. Get or Create Conversation
    convo = run_query(conn, "SELECT conversation_id FROM support_conversations WHERE user_id=%s AND user_type=%s",
                      (user_id, user_type), fetch="one")

    if not convo:
        # Create new conversation if none exists
        run_query(
            conn, "INSERT INTO support_conversations (user_id, user_type) VALUES (%s, %s)", (user_id, user_type))
        convo = run_query(
            conn, "SELECT LAST_INSERT_ID() as conversation_id", fetch="one")
        conn.commit()

    convo_id = convo['conversation_id']

    # 2. Fetch Messages
    messages = run_query(
        conn, "SELECT * FROM support_messages WHERE conversation_id=%s ORDER BY created_at ASC", (convo_id,), fetch="all")

    conn.close()
    return jsonify({"success": True, "messages": messages, "conversation_id": convo_id})


@chat_bp.route("/api/send_message", methods=["POST"])
def send_message():
    # 1️⃣ Get user from session
    user_id, user_type = get_current_user()
    if not user_id:
        return jsonify({"error": "User not logged in"}), 401

    data = request.get_json()
    message = data.get("message", "").strip()

    if not message:
        return jsonify({"error": "Message cannot be empty"}), 400

    conn = create_connection()

    try:
        # 2️⃣ Ensure conversation exists
        convo = run_query(
            conn,
            "SELECT conversation_id FROM support_conversations WHERE user_id=%s AND user_type=%s",
            (user_id, user_type),
            fetch="one"
        )
        if not convo:
            run_query(
                conn,
                "INSERT INTO support_conversations (user_id, user_type) VALUES (%s, %s)",
                (user_id, user_type)
            )
            conn.commit()
            convo = run_query(
                conn,
                "SELECT conversation_id FROM support_conversations WHERE user_id=%s AND user_type=%s",
                (user_id, user_type),
                fetch="one"
            )

        convo_id = convo['conversation_id']

        # 3️⃣ Insert user message
        run_query(
            conn,
            "INSERT INTO support_messages (conversation_id, sender_type, message) VALUES (%s, 'user', %s)",
            (convo_id, message)
        )

        # 4️⃣ Update last message timestamp
        run_query(
            conn,
            "UPDATE support_conversations SET last_message_at=NOW() WHERE conversation_id=%s",
            (convo_id,)
        )

        # 5️⃣ QUICK-SELECT AUTO REPLIES
        lower_msg = message.lower()

        quick_replies = {
            "yes": "Sure! What else can I help you with?",
            "no": "Thank you! If you need anything else, feel free to message anytime.",
            "check my application": "No problem! Please wait a moment while we assist with your application status.",
            "report a job": "Got it! Let me guide you on how to report a job properly.",
            "reset my password": "Sure! Click 'Forgot password' on the login page to reset your password."
        }

        if lower_msg in quick_replies:
            auto_reply = quick_replies[lower_msg]
            run_query(
                conn,
                "INSERT INTO support_messages (conversation_id, sender_type, message) VALUES (%s, 'admin', %s)",
                (convo_id, auto_reply)
            )
            conn.commit()
            return jsonify({"success": True})

        # 6️⃣ Outside Office Hours auto reply
        now = datetime.now()
        start_time = now.replace(hour=8, minute=0, second=0, microsecond=0)
        end_time = now.replace(hour=17, minute=0, second=0, microsecond=0)

        if now.weekday() > 4 or not (start_time <= now <= end_time):
            auto_reply = (
                "Hello! You've reached us outside office hours (8 AM - 5 PM). "
                "We have received your message and an admin will reply as soon as we're back online."
            )
            run_query(
                conn,
                "INSERT INTO support_messages (conversation_id, sender_type, message) VALUES (%s, 'admin', %s)",
                (convo_id, auto_reply)
            )

        conn.commit()
        return jsonify({"success": True})

    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500

    finally:
        conn.close()

# --- ADMIN SIDE ---


@chat_bp.route("/admin/messages")
def admin_chat_page():
    if 'admin_id' not in session:
        return "Unauthorized", 401
    return render_template("Admin/admin_messages.html")


@chat_bp.route("/api/admin/conversations")
def get_admin_conversations():
    if 'admin_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    conn = create_connection()
    # Fetch conversations with user details
    query = """
        SELECT c.*, 
            (SELECT COUNT(*) FROM support_messages m WHERE m.conversation_id = c.conversation_id AND m.is_read = 0 AND m.sender_type = 'user') as unread_count,
            CASE 
                WHEN c.user_type = 'applicant' THEN (SELECT CONCAT(first_name, ' ', last_name) FROM applicants WHERE applicant_id = c.user_id)
                WHEN c.user_type = 'employer' THEN (SELECT employer_name FROM employers WHERE employer_id = c.user_id)
            END as user_name
        FROM support_conversations c
        ORDER BY c.last_message_at DESC
    """
    convos = run_query(conn, query, fetch="all")
    conn.close()
    return jsonify(convos)


@chat_bp.route("/api/admin/conversation/<int:convo_id>")
def get_admin_messages(convo_id):
    if 'admin_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    conn = create_connection()
    messages = run_query(
        conn, "SELECT * FROM support_messages WHERE conversation_id=%s ORDER BY created_at ASC", (convo_id,), fetch="all")

    # Mark as read
    run_query(conn, "UPDATE support_messages SET is_read=1 WHERE conversation_id=%s AND sender_type='user'", (convo_id,))
    conn.commit()
    conn.close()

    return jsonify(messages)


@chat_bp.route("/api/admin/reply", methods=["POST"])
def admin_reply():
    if 'admin_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    convo_id = data.get('conversation_id')
    message = data.get('message')

    conn = create_connection()
    run_query(conn, "INSERT INTO support_messages (conversation_id, sender_type, message) VALUES (%s, 'admin', %s)", (convo_id, message))
    run_query(
        conn, "UPDATE support_conversations SET last_message_at=NOW() WHERE conversation_id=%s", (convo_id,))
    conn.commit()
    conn.close()

    return jsonify({"success": True})
