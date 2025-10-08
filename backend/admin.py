from flask import Blueprint, render_template, request, redirect, url_for, session, flash, jsonify
from werkzeug.security import check_password_hash, generate_password_hash
from db_connection import create_connection, run_query
from .notifications import get_notifications, mark_notification_read, get_unread_count
from extensions import mail
from flask_mail import Message
import secrets

admin_bp = Blueprint("admin", __name__)


# ===== Admin Home (Dashboard with notifications) =====
@admin_bp.route("/home")
def admin_home():
    if "admin_id" not in session:  # Protect route
        return redirect(url_for("admin.login"))
    return render_template("Admin/admin_home.html")


# ===== API: Get Notifications =====
@admin_bp.route("/api/notifications", methods=["GET"])
def api_get_notifications():
    if "admin_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    filter_param = request.args.get("filter", "all")
    notification_type = request.args.get("type")

    is_read = None
    if filter_param == "read":
        is_read = True
    elif filter_param == "unread":
        is_read = False
    elif filter_param == "all":
        is_read = None
    else:
        if not notification_type:
            notification_type = filter_param

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
# UPDATE NON-LIPEÑO STATUS + SEND EMAIL
# ==========================
@admin_bp.route("/update_nonlipeno_status/<int:applicant_id>", methods=["POST"])
def update_nonlipeno_status(applicant_id):
    try:
        data = request.get_json()
        print(f"[v0] Received data for applicant {applicant_id}: {data}")

        if not data or "action" not in data:
            print("[v0] No action provided in request")
            return jsonify({"success": False, "message": "No action provided."}), 400

        action = data["action"]

        conn = create_connection()
        if not conn:
            print("[v0] Database connection failed")
            return jsonify({"success": False, "message": "Database connection failed"}), 500

        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT * FROM applicants WHERE applicant_id = %s AND is_from_lipa = 0",
            (applicant_id,)
        )
        applicant = cursor.fetchone()

        if not applicant:
            print(f"[v0] Non-Lipeño applicant {applicant_id} not found in DB")
            cursor.close()
            conn.close()
            return jsonify({"success": False, "message": "Non-Lipeño applicant not found"}), 404

        if action == "approved":
            # Generate credentials if not already set
            if not applicant.get("temp_password"):
                temp_password_plain = secrets.token_urlsafe(8)
                password_hash = generate_password_hash(temp_password_plain)

                cursor.execute(
                    "UPDATE applicants SET password_hash = %s, temp_password = %s WHERE applicant_id = %s",
                    (password_hash, temp_password_plain, applicant_id)
                )
            else:
                temp_password_plain = applicant["temp_password"]

            new_status = "Approved"
            subject = "PESO SmartHire - Application Approved"
            body = f"""
            <p>Hi {applicant['first_name']},</p>
            <p>This is PESO SmartHire Team.</p>
            <p>Congratulations! Your registration has been reviewed and approved!</p>
            <p>Included below are your login credentials:</p>
            <ul>
                <li>Applicant ID: {applicant['applicant_code']}</li>
                <li>Email: {applicant['email']}</li>
                <li>Phone Number: {applicant['phone']}</li>
                <li>Password: {temp_password_plain}</li>
            </ul>
            <p><strong>Please change your password after logging in.</strong></p>
            <p>Thank you for joining our PESO SmartHire Platform.</p>
            """
            success_message = "Non-Lipeño applicant approved successfully! Credentials sent via email."

        elif action == "rejected":
            new_status = "Rejected"
            subject = "PESO SmartHire - Application Status Update"
            body = f"""
            <p>Hi {applicant['first_name']},</p>
            <p>This is PESO SmartHire Team.</p>
            <p>We regret to inform you that your application for PESO SmartHire has been reviewed but did not meet the current requirements.</p>
            <p>You may reapply in the future once you meet the qualifications.</p>
            <p>Thank you for your interest.</p>
            <p>— PESO SmartHire Admin</p>
            """
            success_message = "Non-Lipeño applicant has been rejected. Notification email sent."

        elif action == "reupload":
            new_status = "Reupload"
            subject = "PESO SmartHire - Endorsement Letter Required"
            body = f"""
            <p>Hi {applicant['first_name']},</p>
            <p>This is PESO SmartHire Team.</p>
            <p>We have reviewed your application for PESO SmartHire and noticed that your endorsement letter needs to be updated or is missing required information.</p>
            <p>Please re-upload your updated endorsement letter through your PESO SmartHire applicant portal as soon as possible.</p>
            <p>Thank you for your cooperation!</p>
            <p>— PESO SmartHire Admin</p>
            """
            success_message = "Re-upload request sent. Email notification sent to applicant."

        else:
            print(f"[v0] Invalid action: {action}")
            cursor.close()
            conn.close()
            return jsonify({"success": False, "message": "Invalid action."}), 400

        # Update status in database
        print(f"[v0] Updating applicant {applicant_id} to status {new_status}")
        cursor.execute(
            "UPDATE applicants SET status = %s WHERE applicant_id = %s",
            (new_status, applicant_id)
        )
        conn.commit()

        # Send email
        print(f"[v0] Sending email to {applicant['email']}")
        msg = Message(
            subject=subject,
            recipients=[applicant["email"]],
            html=body
        )
        mail.send(msg)

        cursor.close()
        conn.close()

        print(
            f"[v0] Status updated and email sent for applicant {applicant_id}")
        return jsonify({"success": True, "message": success_message})

    except Exception as e:
        print(f"[v0] Error updating status or sending email: {e}")
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        return jsonify({"success": False, "message": f"An error occurred: {str(e)}"}), 500


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

    query = "SELECT admin_code, email FROM admin WHERE admin_id = %s"
    admin_data = run_query(conn, query, (session["admin_id"],), fetch="one")
    conn.close()

    return render_template("Admin/admin_acc.html", admin=admin_data)


# ===== Admin Login =====
@admin_bp.route("/login", methods=["POST"])
def login():
    admin_code = request.form.get("adminID")
    email = request.form.get("adminEmail")
    password = request.form.get("adminPassword")

    if not admin_code or not email or not password:
        flash("Please fill in all fields.", "danger")
        return redirect(url_for("home"))

    conn = create_connection()
    if not conn:
        flash("Database connection failed.", "danger")
        return redirect(url_for("home"))

    query = "SELECT * FROM admin WHERE admin_code = %s AND email = %s"
    result = run_query(conn, query, (admin_code, email), fetch="one")
    conn.close()

    if result:
        if check_password_hash(result["password_hash"], password):
            session["admin_id"] = result["admin_id"]
            session["admin_code"] = result["admin_code"]
            session["admin_email"] = result["email"]

            flash("Welcome Back Administrator!", "success")
            return redirect(url_for("admin.admin_home"))
        else:
            flash("Invalid password.", "danger")
    else:
        flash("Invalid Admin ID or Email.", "danger")

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
