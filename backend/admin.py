from flask import Blueprint, render_template, request, redirect, url_for, session, flash, jsonify
from werkzeug.security import check_password_hash
from db_connection import create_connection, run_query
from .notifications import get_notifications, mark_notification_read, get_unread_count

admin_bp = Blueprint("admin", __name__)


# ===== Admin Home (Dashboard with notifications) =====
@admin_bp.route("/home")
def admin_home():
    if "admin_id" not in session:  # Protect route
        return redirect(url_for("admin.login"))
    return render_template("Admin/admin_home.html")


# ===== API: Get Notifications =====
# Single endpoint that handles:
#  - ?filter=all|read|unread
#  - ?filter=<notification_type>  (e.g. ?filter=applicant_approval)
#  - optional explicit ?type=... (still supported)
@admin_bp.route("/api/notifications", methods=["GET"])
def api_get_notifications():
    if "admin_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    filter_param = request.args.get("filter", "all")
    # Allow explicit ?type=... to override, but if not provided and filter isn't one of the
    # special filter values, treat filter as the notification_type.
    notification_type = request.args.get("type")

    # Convert filter to is_read parameter if it's one of the known filters
    is_read = None
    if filter_param == "read":
        is_read = True
    elif filter_param == "unread":
        is_read = False
    elif filter_param == "all":
        is_read = None
    else:
        # If filter is not read/unread/all and no explicit type was provided,
        # treat the filter value as notification_type
        if not notification_type:
            notification_type = filter_param

    # Debug log
    print(
        f"[v0] Fetching notifications - filter: {filter_param}, type: {notification_type}, is_read: {is_read}")

    notifications = get_notifications(
        notification_type=notification_type, is_read=is_read)

    print(f"[v0] Found {len(notifications)} notifications")

    return jsonify({
        "success": True,
        "notifications": notifications,
        "count": len(notifications)
    })


# ===== API: Mark Notification as Read =====
@admin_bp.route("/api/notifications/<int:notification_id>/read", methods=["POST"])
def api_mark_notification_read(notification_id):
    if "admin_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    result = mark_notification_read(notification_id)

    if result:
        return jsonify({"success": True, "message": "Notification marked as read"})
    else:
        return jsonify({"success": False, "message": "Failed to mark notification as read"}), 500


# ===== API: Get Unread Count =====
@admin_bp.route("/api/notifications/unread-count", methods=["GET"])
def api_unread_count():
    if "admin_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    count = get_unread_count()
    return jsonify({"success": True, "unread_count": count})


# ==========================
# VIEW NON-LIPEÑO APPLICANT PROFILE
# ==========================
@admin_bp.route("/view_nonlipeño/<int:applicant_id>")
def view_non_lipeño(applicant_id):
    try:
        conn = create_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM non_lipeno_applicants WHERE id = %s", (applicant_id,))
        applicant = cursor.fetchone()
        cursor.close()
        conn.close()

        if not applicant:
            print(f"❌ Applicant {applicant_id} not found")
            return "Applicant not found", 404

        print(f"✅ Loaded applicant: {applicant}")
        return render_template("Admin/applicant_profile.html", applicant=applicant)

    except Exception as e:
        print(f"❌ Error loading applicant: {e}")
        return "Error loading applicant profile", 500


# ==========================
# UPDATE NON-LIPEÑO STATUS + SEND EMAIL
# ==========================
@admin_bp.route("/update_nonlipeno_status/<int:applicant_id>", methods=["POST"])
def update_nonlipeno_status(applicant_id):
    try:
        data = request.get_json()
        print(f"🔹 Received data for applicant {applicant_id}: {data}")

        if not data or "action" not in data:
            print("❌ No action provided in request")
            return jsonify({"success": False, "message": "No action provided."}), 400

        action = data["action"]
        actions = {
            "approved": {
                "status": "Approved",
                "subject": "Application Approved – PESO SmartHire",
                "message": """Dear {first_name},

Congratulations! Your application for PESO SmartHire has been reviewed and approved.

Please check your PESO SmartHire portal for further updates or next steps.

Thank you and welcome aboard!

— PESO SmartHire Admin""",
                "alert": "Non-Lipeño applicant approved successfully!"
            },
            "rejected": {
                "status": "Rejected",
                "subject": "Application Status – PESO SmartHire",
                "message": """Dear {first_name},

We regret to inform you that your application for PESO SmartHire has been reviewed but did not meet the current requirements.

You may reapply in the future once you meet the qualifications.

Thank you for your interest.

— PESO SmartHire Admin""",
                "alert": "Non-Lipeño applicant has been rejected."
            },
            "reupload": {
                "status": "Reupload",
                "subject": "Endorsement Letter Required – Application Review Update",
                "message": """Dear {first_name},

We have reviewed your application for PESO SmartHire and noticed that your endorsement letter is missing or needs revision.

Please re-upload your updated endorsement letter through your PESO SmartHire applicant portal as soon as possible.

Thank you for your cooperation!

— PESO SmartHire Admin""",
                "alert": "Re-upload request sent and email notification sent to applicant."
            }
        }

        if action not in actions:
            print(f"❌ Invalid action: {action}")
            return jsonify({"success": False, "message": "Invalid action."}), 400

        # Extract details
        new_status = actions[action]["status"]
        email_subject = actions[action]["subject"]
        email_message_template = actions[action]["message"]
        success_message = actions[action]["alert"]

        conn = create_connection()
        cursor = conn.cursor(dictionary=True)

        # Get applicant info
        cursor.execute("SELECT first_name, email FROM non_lipeno_applicants WHERE id = %s", (applicant_id,))
        applicant = cursor.fetchone()
        if not applicant:
            print(f"❌ Applicant {applicant_id} not found in DB")
            return jsonify({"success": False, "message": "Applicant not found"}), 404

        print(f"🔹 Updating applicant {applicant_id} to status {new_status}")
        cursor.execute("UPDATE non_lipeno_applicants SET status = %s WHERE id = %s", (new_status, applicant_id))
        conn.commit()

        # Send email
        print(f"📧 Sending email to {applicant['email']}")
        msg = Message(
            subject=email_subject,
            recipients=[applicant["email"]],
            body=email_message_template.format(first_name=applicant["first_name"])
        )
        mail.send(msg)

        cursor.close()
        conn.close()

        print(f"✅ Status updated and email sent for applicant {applicant_id}")
        return jsonify({"success": True, "message": success_message})

    except Exception as e:
        print(f"❌ Error updating status or sending email: {e}")
        return jsonify({"success": False, "message": "An error occurred while updating status"}), 500



# ===== Admin Account & Security =====
@admin_bp.route("/account", methods=["GET", "POST"])
def account_settings():
    if "admin_id" not in session:
        return redirect(url_for("admin.login"))

    conn = create_connection()
    if not conn:
        flash("Database connection failed", "danger")
        return redirect(url_for("admin.admin_home"))

    if request.method == "POST":
        # Only allow email update
        new_email = request.form.get("email")
        update_query = "UPDATE admin SET email = %s WHERE admin_id = %s"
        result = run_query(conn, update_query,
                           (new_email, session["admin_id"]))
        conn.close()

        if result:
            flash("Email updated successfully", "success")
            session["admin_email"] = new_email
        else:
            flash("Failed to update email", "danger")

        return redirect(url_for("admin.account_settings"))

    # GET request → fetch current admin info
    query = "SELECT admin_code, email FROM admin WHERE admin_id = %s"
    admin_data = run_query(conn, query, (session["admin_id"],), fetch="one")
    conn.close()

    return render_template("Admin/admin_acc.html", admin=admin_data)


# ===== Admin Login =====
@admin_bp.route("/login", methods=["POST"])
def login():
    # Get form data
    admin_code = request.form.get("adminID")
    email = request.form.get("adminEmail")
    password = request.form.get("adminPassword")

    # Validate empty fields
    if not admin_code or not email or not password:
        flash("Please fill in all fields.", "danger")
        return redirect(url_for("home"))  # landing page

    # Connect to DB
    conn = create_connection()
    if not conn:
        flash("Database connection failed.", "danger")
        return redirect(url_for("home"))

    # Fetch admin
    query = "SELECT * FROM admin WHERE admin_code = %s AND email = %s"
    result = run_query(conn, query, (admin_code, email), fetch="one")
    conn.close()

    if result:
        # Check password hash
        if check_password_hash(result["password_hash"], password):
            # Login success → set session
            session["admin_id"] = result["admin_id"]
            session["admin_code"] = result["admin_code"]
            session["admin_email"] = result["email"]

            flash("Welcome Back Administrator!", "success")
            return redirect(url_for("admin.admin_home"))  # admin dashboard
        else:
            flash("Invalid password.", "danger")
    else:
        flash("Invalid Admin ID or Email.", "danger")

    # On any error → go back to landing page with modal
    return redirect(url_for("home"))


@admin_bp.route("/notifications")
def notifications_page():
    admin_id = session.get("admin_id")
    notifications = get_notifications()

    return render_template("Admin/admin_notif.html", notifications=notifications)


# ===== Admin: Applicants Management =====
@admin_bp.route("/applicants")
def applicants_management():
    return render_template("Admin/admin_applicant.html")


@admin_bp.route("/applicants/<int:applicant_id>")
def view_applicant(applicant_id):
    conn = create_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        "SELECT * FROM applicants WHERE applicant_id = %s", (applicant_id,))
    applicant = cursor.fetchone()
    cursor.close()
    conn.close()

    if not applicant:
        flash("Applicant not found", "danger")
        return redirect(url_for("admin.applicants_management"))

    # ✅ Check where the user came from
    referrer = request.referrer
    from_notifications = False
    if referrer and "/admin/notifications" in referrer:
        from_notifications = True

    return render_template(
        "Admin/applicant_profile.html",
        applicant=applicant,
        from_notifications=from_notifications
    )

# ===== Admin: Employers Management =====


@admin_bp.route("/employers")
def employers_management():
    return render_template("Admin/admin_employer.html")


@admin_bp.route("/employers/<int:employer_id>")
def view_employer(employer_id):
    conn = create_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        "SELECT * FROM employers WHERE employer_id = %s", (employer_id,)
    )
    employer = cursor.fetchone()
    cursor.close()
    conn.close()

    if not employer:
        flash("Employer not found", "danger")
        return redirect(url_for("admin.employers_management"))

    referrer = request.referrer
    from_notifications = False
    if referrer and "/admin/notifications" in referrer:
        from_notifications = True

    return render_template("Admin/employer_profile.html", employer=employer, from_notifications=from_notifications)
