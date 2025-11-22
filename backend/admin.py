from flask import Blueprint, render_template, request, redirect, url_for, session, flash, jsonify
from werkzeug.security import check_password_hash, generate_password_hash
from db_connection import create_connection, run_query
from .notifications import get_notifications, mark_notification_read, get_unread_count
from extensions import mail
from flask_mail import Message
import secrets
import json

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

    # Admin should only see system notifications, not employer job applications
    notifications = get_notifications(
        notification_type=notification_type,
        is_read=is_read,
        # Exclude employer-only notifications
        exclude_types=['job_application']
    )

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


@admin_bp.route("/approve-reupload/<int:applicant_id>", methods=["POST"])
def approve_reupload(applicant_id):
    try:
        conn = create_connection()
        if not conn:
            return jsonify({"success": False, "message": "Database connection failed"}), 500

        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT * FROM applicants WHERE applicant_id = %s", (applicant_id,))
        applicant = cursor.fetchone()

        if not applicant:
            cursor.close()
            conn.close()
            return jsonify({"success": False, "message": "Applicant not found"}), 404

        # Update status to Approved
        cursor.execute(
            "UPDATE applicants SET status = %s WHERE applicant_id = %s",
            ("Approved", applicant_id)
        )
        conn.commit()

        # Send approval email
        subject = "PESO SmartHire - Full Access Granted"
        body = f"""
        <p>Hi {applicant['first_name']},</p>
        <p>This is PESO SmartHire Team.</p>
        <p>Congratulations! Your reuploaded document has been reviewed and approved.</p>
        <p>You now have full access to all features of the PESO SmartHire platform.</p>
        <p>Thank you for your cooperation!</p>
        <p>— PESO SmartHire Admin</p>
        """
        msg = Message(subject=subject, recipients=[
                      applicant["email"]], html=body)
        mail.send(msg)

        cursor.close()
        conn.close()

        # Also flash server-side so the message is visible after reload
        flash("Applicant approved and notified successfully", "success")
        return jsonify({"success": True, "message": "Applicant approved and notified successfully"})

    except Exception as e:
        print(f"[v0] Error approving reupload: {e}")
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        flash(str(e), "danger")
        return jsonify({"success": False, "message": str(e)}), 500


@admin_bp.route("/approve-employer-reupload/<int:employer_id>", methods=["POST"])
def approve_employer_reupload(employer_id):
    try:
        conn = create_connection()
        if not conn:
            return jsonify({"success": False, "message": "Database connection failed"}), 500

        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT * FROM employers WHERE employer_id = %s", (employer_id,))
        employer = cursor.fetchone()

        if not employer:
            cursor.close()
            conn.close()
            return jsonify({"success": False, "message": "Employer not found"}), 404

        # Update status to Approved
        cursor.execute(
            "UPDATE employers SET status = %s WHERE employer_id = %s",
            ("Approved", employer_id)
        )
        conn.commit()

        # Send approval email
        subject = "PESO SmartHire - Full Access Granted"
        body = f"""
        <p>Dear {employer['employer_name']},</p>
        <p>This is PESO SmartHire Team.</p>
        <p>Congratulations! Your reuploaded documents have been reviewed and approved.</p>
        <p>You now have full access to all features of the PESO SmartHire employer platform.</p>
        <p>Thank you for your cooperation!</p>
        <p>— PESO SmartHire Admin</p>
        """
        msg = Message(subject=subject, recipients=[
                      employer["email"]], html=body)
        mail.send(msg)

        cursor.close()
        conn.close()

        flash("Employer approved and notified successfully", "success")
        return jsonify({"success": True, "message": "Employer approved and notified successfully"})

    except Exception as e:
        print(f"[v0] Error approving employer reupload: {e}")
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        flash(str(e), "danger")
        return jsonify({"success": False, "message": str(e)}), 500


# ==========================
# UPDATE NON-LIPEÑO STATUS + SEND EMAIL
# ==========================
@admin_bp.route("/update_nonlipeno_status/<int:applicant_id>", methods=["POST"])
def update_nonlipeno_status(applicant_id):
    try:
        data = request.get_json()
        print(f"[v1] Received data for applicant {applicant_id}: {data}")

        if not data or "action" not in data:
            print("[v1] No action provided in request")
            return jsonify({"success": False, "message": "No action provided."}), 400

        action = data["action"]
        reason = None

        conn = create_connection()
        if not conn:
            print("[v1] Database connection failed")
            return jsonify({"success": False, "message": "Database connection failed"}), 500

        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT * FROM applicants WHERE applicant_id = %s AND is_from_lipa = 0",
            (applicant_id,)
        )
        applicant = cursor.fetchone()

        if not applicant:
            print(f"[v1] Non-Lipeño applicant {applicant_id} not found in DB")
            cursor.close()
            conn.close()
            return jsonify({"success": False, "message": "Non-Lipeño applicant not found"}), 404

        # -----------------------------
        # HANDLE PASSWORD CREATION
        # -----------------------------
        temp_password_plain = None
        has_credentials = applicant.get("password_hash") is not None

        if action in ["approved", "reupload"]:
            if not has_credentials:
                # --- EDITED: always generate a hashed password and temp_password ---
                temp_password_plain = secrets.token_urlsafe(8)
                password_hash = generate_password_hash(temp_password_plain)
                cursor.execute(
                    "UPDATE applicants SET password_hash = %s, temp_password = %s WHERE applicant_id = %s",
                    (password_hash, temp_password_plain, applicant_id)
                )
                # Update local dict so email uses the correct password
                applicant["temp_password"] = temp_password_plain
            else:
                # --- EDITED: use existing temp_password if available, otherwise mark for reset ---
                temp_password_plain = applicant.get(
                    "temp_password", "<reset_required>")

        # -----------------------------
        # DETERMINE STATUS AND EMAIL
        # -----------------------------
        if action == "approved":
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
            reason = data.get("reason") if isinstance(data, dict) else None
            subject = "PESO SmartHire - Application Status Update"
            reason_block = f"<p><strong>Reason:</strong> {reason}</p>" if reason else ""
            body = f"""
            <p>Hi {applicant['first_name']},</p>
            <p>This is PESO SmartHire Team.</p>
            <p>We regret to inform you that your application for PESO SmartHire has been reviewed but did not meet the current requirements.</p>
            {reason_block}
            <p>You may reapply in the future once you meet the qualifications.</p>
            <p>Thank you for your interest.</p>
            <p>— PESO SmartHire Admin</p>
            """
            success_message = "Non-Lipeño applicant has been rejected. Notification email sent."
            # --- EDITED: remove credentials if rejected ---
            cursor.execute(
                "UPDATE applicants SET password_hash = NULL, temp_password = NULL WHERE applicant_id = %s",
                (applicant_id,)
            )

        elif action == "reupload":
            new_status = "Reupload"
            document_name = data.get("document_name", "Recommendation Letter")
            subject = "PESO SmartHire - Document Reupload Required"
            body = f"""
            <p>Hi {applicant['first_name']},</p>
            <p>This is PESO SmartHire Team.</p>
            <p>We have reviewed your application for PESO SmartHire and noticed that your {document_name} needs to be updated or is missing required information.</p>
            <p>Please log in to your account and re-upload your updated {document_name} through the Account and Security page in your PESO SmartHire applicant portal as soon as possible.</p>
            <p>Here are your login credentials:</p>
            <ul>
                <li>Applicant ID: {applicant['applicant_code']}</li>
                <li>Email: {applicant['email']}</li>
                <li>Phone Number: {applicant['phone']}</li>
                <li>Password: {temp_password_plain}</li>
            </ul>
            <p><strong>Please change your password after logging in for security purposes.</strong></p>
            <p>Thank you for your cooperation!</p>
            <p>— PESO SmartHire Admin</p>
            """
            success_message = "Re-upload request sent. Email notification with login credentials sent to applicant."

        else:
            print(f"[v1] Invalid action: {action}")
            cursor.close()
            conn.close()
            return jsonify({"success": False, "message": "Invalid action."}), 400

        # -----------------------------
        # UPDATE STATUS + is_active
        # -----------------------------
        is_active_value = 1 if new_status == "Approved" else 0

        if reason:
            cursor.execute(
                "UPDATE applicants SET status = %s, rejection_reason = %s, is_active = %s WHERE applicant_id = %s",
                (new_status, reason, is_active_value, applicant_id)
            )
        else:
            cursor.execute(
                "UPDATE applicants SET status = %s, is_active = %s, approved_at = NOW() WHERE applicant_id = %s",
                (new_status, is_active_value, applicant_id)
            )

        conn.commit()

        # -----------------------------
        # SEND EMAIL
        # -----------------------------
        msg = Message(
            subject=subject,
            recipients=[applicant["email"]],
            html=body
        )
        mail.send(msg)

        cursor.close()
        conn.close()

        print(
            f"[v1] Status updated and email sent for applicant {applicant_id}")
        return jsonify({"success": True, "message": success_message})

    except Exception as e:
        print(f"[v1] Error updating status or sending email: {e}")
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        return jsonify({"success": False, "message": f"An error occurred: {str(e)}"}), 500


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


@admin_bp.route("/applicants/for-approval")
def applicants_for_approval():
    """Show non-Lipeño applicants needing approval"""
    if "admin_id" not in session:
        return redirect(url_for("admin.login"))

    conn = create_connection()
    cursor = conn.cursor(dictionary=True)

    # Get non-Lipeño applicants with Pending status
    cursor.execute("""
        SELECT applicant_id, first_name, middle_name, last_name, 
               created_at, status, is_from_lipa
        FROM applicants 
        WHERE is_from_lipa = 0 AND status = 'Pending'
        ORDER BY created_at DESC
    """)
    applicants = cursor.fetchall()

    cursor.close()
    conn.close()

    return render_template("Admin/applicants_for_approval.html", applicants=applicants)


@admin_bp.route("/applicants/view-all")
def applicants_view_all():
    """Show all applicants with Lipeño/Non-Lipeño filter"""
    if "admin_id" not in session:
        return redirect(url_for("admin.login"))

    conn = create_connection()
    cursor = conn.cursor(dictionary=True)

    # Get all applicants (all statuses)
    cursor.execute("""
        SELECT applicant_id, first_name, middle_name, last_name, 
               created_at, status, is_from_lipa
        FROM applicants 
        ORDER BY created_at DESC
    """)
    applicants = cursor.fetchall()

    cursor.close()
    conn.close()

    return render_template("Admin/applicants_view_all.html", applicants=applicants)


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


@admin_bp.route("/employers/for-approval")
def employers_for_approval():
    """Show employers (local and international) needing approval"""
    if "admin_id" not in session:
        return redirect(url_for("admin.login"))

    conn = create_connection()
    cursor = conn.cursor(dictionary=True)

    # Get employers with Pending status
    cursor.execute("""
        SELECT employer_id, employer_name, recruitment_type, 
               created_at, status
        FROM employers 
        WHERE status = 'Pending'
        ORDER BY created_at DESC
    """)
    employers = cursor.fetchall()

    cursor.close()
    conn.close()

    return render_template("Admin/employers_for_approval.html", employers=employers)


@admin_bp.route("/employers/view-all")
def employers_view_all():
    """Show all employers with Local/International filter"""
    if "admin_id" not in session:
        return redirect(url_for("admin.login"))

    conn = create_connection()
    cursor = conn.cursor(dictionary=True)

    # Get all employers (all statuses)
    cursor.execute("""
        SELECT employer_id, employer_name, recruitment_type, 
               created_at, status
        FROM employers 
        ORDER BY created_at DESC
    """)
    employers = cursor.fetchall()

    cursor.close()
    conn.close()

    return render_template("Admin/employers_view_all.html", employers=employers)


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


# ==========================
# UPDATE LOCAL RECRUITMENT EMPLOYER STATUS
# ==========================
@admin_bp.route("/update_local_employer_status/<int:employer_id>", methods=["POST"])
def update_local_employer_status(employer_id):
    try:
        data = request.get_json()
        if not data or "action" not in data:
            return jsonify({"success": False, "message": "No action provided."}), 400

        action = data["action"]
        reason = None
        documents_to_reupload = None

        conn = create_connection()
        if not conn:
            return jsonify({"success": False, "message": "Database connection failed"}), 500

        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT * FROM employers WHERE employer_id = %s AND recruitment_type = 'Local'",
            (employer_id,)
        )
        employer = cursor.fetchone()

        if not employer:
            cursor.close()
            conn.close()
            return jsonify({"success": False, "message": "Local employer not found"}), 404

        is_new_employer = not employer.get("password_hash")
        temp_password_plain = None

        if action == "approved":
            # Only generate password for NEW employers
            if is_new_employer:
                temp_password_plain = secrets.token_urlsafe(8)
                password_hash = generate_password_hash(temp_password_plain)
                cursor.execute(
                    "UPDATE employers SET password_hash = %s, temp_password = %s WHERE employer_id = %s",
                    (password_hash, temp_password_plain, employer_id)
                )
            else:
                # Existing employer - no new password
                temp_password_plain = None

            new_status = "Approved"
            subject = "PESO SmartHire - Local Recruitment Account Approved"

            if is_new_employer:
                credentials_block = f"""
                <p>Included below are your login credentials:</p>
                <ul>
                    <li>Employer Code: {employer['employer_code']}</li>
                    <li>Email: {employer['email']}</li>
                    <li>Phone Number: {employer['phone']}</li>
                    <li>Password: {temp_password_plain}</li>
                </ul>
                <p><strong>Please change your password after logging in for security purposes.</strong></p>
                """
            else:
                credentials_block = """
                <p><strong>Use your existing login credentials to access your account.</strong></p>
                """

            body = f"""
            <p>Dear {employer['employer_name']},</p>
            <p>This is PESO SmartHire Team.</p>
            <p>Congratulations! Your local recruitment account has been reviewed and approved!</p>
            <p>You may now post job orders and access your employer dashboard to manage your recruitment activities.</p>
            {credentials_block}
            <p>To get started, visit our platform and log in with your credentials. You can then begin posting job orders and managing your recruitment needs.</p>
            <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
            <p>Thank you for partnering with PESO SmartHire!</p>
            <p>— PESO SmartHire Admin</p>
            """
            success_message = "Local employer approved successfully! Email notification sent."

        elif action == "rejected":
            new_status = "Rejected"
            reason = data.get("reason") if isinstance(data, dict) else None
            subject = "PESO SmartHire - Local Recruitment Account Status Update"
            reason_block = f"<p><strong>Reason:</strong> {reason}</p>" if reason else ""
            body = f"""
            <p>Dear {employer['employer_name']},</p>
            <p>This is PESO SmartHire Team.</p>
            <p>We regret to inform you that your local recruitment account application has been reviewed but did not meet the current requirements.</p>
            {reason_block}
            <p>Please review the requirements and feel free to reapply in the future once you have met all the necessary qualifications.</p>
            <p>If you have any questions regarding this decision, please contact our support team.</p>
            <p>Thank you for your interest in PESO SmartHire.</p>
            <p>— PESO SmartHire Admin</p>
            """
            success_message = "Local employer rejected. Notification email sent."
            cursor.execute(
                "UPDATE employers SET password_hash = NULL, temp_password = NULL WHERE employer_id = %s",
                (employer_id,)
            )

        elif action == "reupload":
            # Only generate password for NEW employers
            if is_new_employer:
                temp_password_plain = secrets.token_urlsafe(8)
                password_hash = generate_password_hash(temp_password_plain)
                cursor.execute(
                    "UPDATE employers SET password_hash = %s, temp_password = %s WHERE employer_id = %s",
                    (password_hash, temp_password_plain, employer_id)
                )
            else:
                temp_password_plain = employer.get("temp_password")

            new_status = "Reupload"
            requested = data.get("document_name")
            if isinstance(requested, list):
                requested_list = requested
            elif isinstance(requested, str) and requested:
                requested_list = [requested]
            else:
                requested_list = []

            normalized_map = {
                "Business Permit": "business_permit",
                "PhilJobNet Registration": "philiobnet_registration",
                "Job Orders of Client": "job_orders_of_client",
                "DOLE - No Pending Case Certificate": "dole_no_pending_case",
                "DOLE - Authority to Recruit": "dole_authority_to_recruit",
                "DMW - No Pending Case Certificate": "dmw_no_pending_case",
                "DMW - License to Recruit": "license_to_recruit",
                "Company Logo": "company_logo"
            }

            normalized_docs = [
                normalized_map.get(doc.strip(), doc.strip(
                ).lower().replace(' ', '_').replace('-', '_'))
                for doc in requested_list
            ]

            documents_to_reupload = json.dumps(
                normalized_docs) if normalized_docs else None

            docs_block = ""
            if requested_list:
                docs_html = "".join([f"<li>{d}</li>" for d in requested_list])
                docs_block = f"<p>The documents we specifically request you to re-upload are:</p><ul>{docs_html}</ul>"

            subject = "PESO SmartHire - Local Recruitment Documents Update Required"

            if is_new_employer:
                credentials_block = f"""
                <p>Here are your login credentials:</p>
                <ul>
                    <li>Employer Code: {employer['employer_code']}</li>
                    <li>Email: {employer['email']}</li>
                    <li>Phone Number: {employer['phone']}</li>
                    <li>Password: {temp_password_plain}</li>
                </ul>
                <p><strong>Please change your password after logging in for security purposes.</strong></p>
                """
            else:
                credentials_block = """
                <p><strong>Use your existing login credentials to access your account.</strong></p>
                """

            body = f"""
            <p>Dear {employer['employer_name']},</p>
            <p>This is PESO SmartHire Team.</p>
            <p>We have reviewed your local recruitment account and noticed that some of your required documents need to be updated or are missing important information.</p>
            {docs_block}
            <p>Please log in to your account and re-upload the required documents through your employer dashboard as soon as possible.</p>
            {credentials_block}
            <p>Once you have updated your documents, we will review them promptly and notify you of the status.</p>
            <p>If you need any assistance, please contact our support team.</p>
            <p>Thank you for your cooperation!</p>
            <p>— PESO SmartHire Admin</p>
            """
            success_message = "Re-upload request sent. Email notification sent to employer."

        else:
            cursor.close()
            conn.close()
            return jsonify({"success": False, "message": "Invalid action."}), 400

        if new_status == "Approved":
            is_active_value = 1
        else:
            is_active_value = 0

        if reason:
            cursor.execute(
                "UPDATE employers SET status = %s, rejection_reason = %s, is_active = %s, documents_to_reupload = %s WHERE employer_id = %s",
                (new_status, reason, is_active_value,
                 documents_to_reupload, employer_id)
            )
        else:
            cursor.execute(
                "UPDATE employers SET status = %s, is_active = %s, documents_to_reupload = %s, approved_at = NOW() WHERE employer_id = %s",
                (new_status, is_active_value, documents_to_reupload, employer_id)
            )
        conn.commit()

        msg = Message(subject=subject, recipients=[
                      employer["email"]], html=body)
        mail.send(msg)

        cursor.close()
        conn.close()

        return jsonify({"success": True, "message": success_message})

    except Exception as e:
        print(f"[v1] Error updating status or sending email: {e}")
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        return jsonify({"success": False, "message": f"An error occurred: {str(e)}"}), 500


# ==========================
# UPDATE INTERNATIONAL RECRUITMENT EMPLOYER STATUS
# ==========================
@admin_bp.route("/update_international_employer_status/<int:employer_id>", methods=["POST"])
def update_international_employer_status(employer_id):
    try:
        data = request.get_json()
        if not data or "action" not in data:
            return jsonify({"success": False, "message": "No action provided."}), 400

        action = data["action"]
        reason = None
        documents_to_reupload = None

        conn = create_connection()
        if not conn:
            return jsonify({"success": False, "message": "Database connection failed"}), 500

        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT * FROM employers WHERE employer_id = %s AND recruitment_type = 'International'",
            (employer_id,)
        )
        employer = cursor.fetchone()

        if not employer:
            cursor.close()
            conn.close()
            return jsonify({"success": False, "message": "International employer not found"}), 404

        is_new_employer = not employer.get("password_hash")
        temp_password_plain = None

        if action == "approved":
            # Only generate password for NEW employers
            if is_new_employer:
                temp_password_plain = secrets.token_urlsafe(8)
                password_hash = generate_password_hash(temp_password_plain)
                cursor.execute(
                    "UPDATE employers SET password_hash = %s, temp_password = %s WHERE employer_id = %s",
                    (password_hash, temp_password_plain, employer_id)
                )
            else:
                # Existing employer - no new password
                temp_password_plain = None

            new_status = "Approved"
            subject = "PESO SmartHire - International Recruitment Account Approved"

            if is_new_employer:
                credentials_block = f"""
                <p>Included below are your login credentials:</p>
                <ul>
                    <li>Employer ID: {employer['employer_code']}</li>
                    <li>Email: {employer['email']}</li>
                    <li>Phone Number: {employer['phone']}</li>
                    <li>Password: {temp_password_plain}</li>
                </ul>
                <p><strong>Please change your password after logging in for security purposes.</strong></p>
                """
            else:
                credentials_block = """
                <p><strong>Use your existing login credentials to access your account.</strong></p>
                """

            body = f"""
            <p>Dear {employer['employer_name']},</p>
            <p>This is PESO SmartHire Team.</p>
            <p>Congratulations! Your international recruitment account has been reviewed and approved!</p>
            <p>You may now post overseas job orders and access your employer dashboard to manage your international recruitment activities.</p>
            {credentials_block}
            <p>To get started, visit our platform and log in with your credentials. You can then begin posting overseas job orders and managing your international recruitment needs.</p>
            <p>If you have any questions or need assistance, please contact our support team.</p>
            <p>Thank you for partnering with PESO SmartHire!</p>
            <p>— PESO SmartHire Admin</p>
            """
            success_message = "International employer approved successfully! Email notification sent."

        elif action == "rejected":
            new_status = "Rejected"
            reason = data.get("reason") if isinstance(data, dict) else None
            subject = "PESO SmartHire - International Recruitment Account Status Update"
            reason_block = f"<p><strong>Reason:</strong> {reason}</p>" if reason else ""
            body = f"""
            <p>Dear {employer['employer_name']},</p>
            <p>This is PESO SmartHire Team.</p>
            <p>We regret to inform you that your international recruitment account application has been reviewed but did not meet the current requirements.</p>
            {reason_block}
            <p>Please review the requirements and feel free to reapply in the future once you have met all the necessary qualifications for international recruitment.</p>
            <p>If you have any questions regarding this decision, please contact our support team.</p>
            <p>Thank you for your interest in PESO SmartHire.</p>
            <p>— PESO SmartHire Admin</p>
            """
            success_message = "International employer rejected. Notification email sent."
            cursor.execute(
                "UPDATE employers SET password_hash = NULL, temp_password = NULL WHERE employer_id = %s",
                (employer_id,)
            )

        elif action == "reupload":
            # Only generate password for NEW employers
            if is_new_employer:
                temp_password_plain = secrets.token_urlsafe(8)
                password_hash = generate_password_hash(temp_password_plain)
                cursor.execute(
                    "UPDATE employers SET password_hash = %s, temp_password = %s WHERE employer_id = %s",
                    (password_hash, temp_password_plain, employer_id)
                )
            else:
                temp_password_plain = employer.get("temp_password")

            new_status = "Reupload"
            requested = data.get("document_name")
            if isinstance(requested, list):
                requested_list = requested
            elif isinstance(requested, str) and requested:
                requested_list = [requested]
            else:
                requested_list = []

            normalized_map = {
                "Business Permit": "business_permit",
                "PhilJobNet Registration": "philiobnet_registration",
                "Job Orders of Client": "job_orders_of_client",
                "DOLE - No Pending Case Certificate": "dole_no_pending_case",
                "DOLE - Authority to Recruit": "dole_authority_to_recruit",
                "DMW - No Pending Case Certificate": "dmw_no_pending_case",
                "DMW - License to Recruit": "license_to_recruit",
                "Company Logo": "company_logo"
            }

            normalized_docs = [
                normalized_map.get(doc.strip(), doc.strip(
                ).lower().replace(' ', '_').replace('-', '_'))
                for doc in requested_list
            ]

            documents_to_reupload = json.dumps(
                normalized_docs) if normalized_docs else None

            docs_block = ""
            if requested_list:
                docs_html = "".join([f"<li>{d}</li>" for d in requested_list])
                docs_block = f"<p>The documents we specifically request you to re-upload are:</p><ul>{docs_html}</ul>"

            subject = "PESO SmartHire - International Recruitment Documents Update Required"

            if is_new_employer:
                credentials_block = f"""
                <p>Here are your login credentials:</p>
                <ul>
                    <li>Employer ID: {employer['employer_code']}</li>
                    <li>Email: {employer['email']}</li>
                    <li>Phone Number: {employer['phone']}</li>
                    <li>Password: {temp_password_plain}</li>
                </ul>
                <p><strong>Please change your password after logging in for security purposes.</strong></p>
                """
            else:
                credentials_block = """
                <p><strong>Use your existing login credentials to access your account.</strong></p>
                """

            body = f"""
            <p>Dear {employer['employer_name']},</p>
            <p>This is PESO SmartHire Team.</p>
            <p>We have reviewed your international recruitment account and noticed that some of your required documents need to be updated or are missing important information.</p>
            {docs_block}
            <p>Please log in to your account and re-upload the required documents through your employer dashboard as soon as possible.</p>
            {credentials_block}
            <p>Once you have updated your documents, we will review them promptly and notify you of the status.</p>
            <p>If you need any assistance, please contact our support team.</p>
            <p>Thank you for your cooperation!</p>
            <p>— PESO SmartHire Admin</p>
            """
            success_message = "Re-upload request sent. Email notification sent to international employer."

        else:
            cursor.close()
            conn.close()
            return jsonify({"success": False, "message": "Invalid action."}), 400

        if new_status == "Approved":
            is_active_value = 1
        else:
            is_active_value = 0

        if reason:
            cursor.execute(
                "UPDATE employers SET status = %s, rejection_reason = %s, is_active = %s, documents_to_reupload = %s WHERE employer_id = %s",
                (new_status, reason, is_active_value,
                 documents_to_reupload, employer_id)
            )
        else:
            cursor.execute(
                "UPDATE employers SET status = %s, is_active = %s, documents_to_reupload = %s, approved_at = NOW() WHERE employer_id = %s",
                (new_status, is_active_value, documents_to_reupload, employer_id)
            )
        conn.commit()

        msg = Message(subject=subject, recipients=[
                      employer["email"]], html=body)
        mail.send(msg)

        cursor.close()
        conn.close()

        return jsonify({"success": True, "message": success_message})

    except Exception as e:
        print(f"[v1] Error updating status or sending email: {e}")
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        return jsonify({"success": False, "message": f"An error occurred: {str(e)}"}), 500


@admin_bp.route("/reupload-recruitment-type-change/<int:employer_id>", methods=["POST"])
def reupload_recruitment_type_change(employer_id):
    """
    Admin requests employer to reupload documents for new recruitment type
    Shows only DOLE or DMW documents based on new recruitment type
    """
    try:
        data = request.get_json()

        conn = create_connection()
        if not conn:
            return jsonify({"success": False, "message": "Database connection failed"}), 500

        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT * FROM employers WHERE employer_id = %s",
            (employer_id,)
        )
        employer = cursor.fetchone()

        if not employer:
            cursor.close()
            conn.close()
            return jsonify({"success": False, "message": "Employer not found"}), 404

        new_recruitment_type = employer["recruitment_type"]
        is_new_employer = not employer.get("password_hash")

        # Build document list based on NEW recruitment type
        if new_recruitment_type == "Local":
            documents_needed = ["dole_no_pending_case",
                                "dole_authority_to_recruit"]
            doc_labels = ["DOLE - No Pending Case Certificate",
                          "DOLE - Authority to Recruit"]
        else:  # International
            documents_needed = ["dmw_no_pending_case", "license_to_recruit"]
            doc_labels = ["DMW - No Pending Case Certificate",
                          "DMW - License to Recruit"]

        documents_to_reupload_json = json.dumps(documents_needed)

        # Update employer: set to Reupload status, mark as restricted to documents tab
        cursor.execute("""
            UPDATE employers 
            SET status = %s,
                is_active = 0,
                recruitment_type_change_pending = 1,
                documents_to_reupload = %s
            WHERE employer_id = %s
        """, ("Reupload", documents_to_reupload_json, employer_id))

        conn.commit()

        temp_password_plain = None
        if is_new_employer:
            temp_password_plain = secrets.token_urlsafe(8)
            password_hash = generate_password_hash(temp_password_plain)

            cursor.execute(
                "UPDATE employers SET password_hash = %s, temp_password = %s WHERE employer_id = %s",
                (password_hash, temp_password_plain, employer_id)
            )
            conn.commit()

        doc_list = "".join([f"<li>{label}</li>" for label in doc_labels])

        if is_new_employer:
            credentials_block = f"""
            <p>Please log in to your account using the credentials below and upload these documents in the <strong>Documents tab only</strong> (other features are temporarily restricted).</p>
            <ul>
                <li>Employer Code: {employer['employer_code']}</li>
                <li>Email: {employer['email']}</li>
                <li>Phone Number: {employer['phone']}</li>
                <li>Password: {temp_password_plain}</li>
            </ul>
            <p><strong>Important:</strong> Please change your password after logging in for security purposes.</p>
            """
        else:
            credentials_block = f"""
            <p>Please log in to your account using your existing credentials and upload these documents in the <strong>Documents tab only</strong> (other features are temporarily restricted).</p>
            <ul>
                <li>Employer Code: {employer['employer_code']}</li>
                <li>Email: {employer['email']}</li>
            </ul>
            """

        subject = f"PESO SmartHire - Reupload Required for {new_recruitment_type} Recruitment"
        body = f"""
        <p>Dear {employer['employer_name']},</p>
        <p>This is PESO SmartHire Team.</p>
        <p>We have reviewed your recruitment type change to <strong>{new_recruitment_type} recruitment</strong> and need you to reupload the required documents.</p>
        <p><strong>You must reupload the following documents:</strong></p>
        <ul>{doc_list}</ul>
        {credentials_block}
        <p>Once you have uploaded the required documents, we will review them and notify you of the status.</p>
        <p>Thank you for your cooperation!</p>
        <p>— PESO SmartHire Admin</p>
        """

        msg = Message(subject=subject, recipients=[
                      employer["email"]], html=body)
        mail.send(msg)

        cursor.close()
        conn.close()

        return jsonify({"success": True, "message": "Reupload request sent to employer"})

    except Exception as e:
        print(f"[v0] Error requesting recruitment type reupload: {e}")
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        return jsonify({"success": False, "message": str(e)}), 500


@admin_bp.route("/account-settings", methods=["GET", "POST"])
def account_settings():
    if "admin_id" not in session:
        return redirect(url_for("admin.login"))

    try:
        conn = create_connection()
        if not conn:
            flash("Database connection failed", "danger")
            return redirect(url_for("admin.admin_home"))

        if request.method == "POST":
            new_email = request.form.get("email")

            update_query = "UPDATE admin SET email = %s WHERE admin_id = %s"
            result = run_query(conn, update_query,
                               (new_email, session["admin_id"]))

            if result:
                flash("Email updated successfully", "success")
                session["admin_email"] = new_email
            else:
                flash("Failed to update email", "danger")

            conn.close()
            return redirect(url_for("admin.account_settings"))

        # --- GET Request ---
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT admin_code, email FROM admin WHERE admin_id = %s",
                       (session["admin_id"],))
        admin = cursor.fetchone()
        cursor.close()
        conn.close()

        if not admin:
            flash("Admin not found", "danger")
            return redirect(url_for("admin.admin_home"))

        return render_template("Admin/admin_acc.html", admin=admin)

    except Exception as e:
        print(f"[account_settings] Error: {e}")
        flash("An error occurred while loading account settings", "danger")
        return redirect(url_for("admin.admin_home"))


# This is for recruitment changing on edit state
@admin_bp.route("/approve-recruitment-type-change/<int:employer_id>", methods=["POST"])
def approve_recruitment_type_change(employer_id):
    """
    Admin approves employer recruitment type change
    Sets status to Approved and sends email with existing login credentials
    """
    try:
        conn = create_connection()
        if not conn:
            return jsonify({"success": False, "message": "Database connection failed"}), 500

        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT * FROM employers WHERE employer_id = %s",
            (employer_id,)
        )
        employer = cursor.fetchone()

        if not employer:
            cursor.close()
            conn.close()
            return jsonify({"success": False, "message": "Employer not found"}), 404

        # Update status to Approved
        cursor.execute("""
            UPDATE employers 
            SET status = %s, 
                recruitment_type_change_pending = 0,
                is_active = 1,
                approved_at = NOW()
            WHERE employer_id = %s
        """, ("Approved", employer_id))

        conn.commit()

        # Send approval email with EXISTING login credentials
        subject = f"PESO SmartHire - {employer['recruitment_type']} Recruitment Approved"
        body = f"""
        <p>Dear {employer['employer_name']},</p>
        <p>This is PESO SmartHire Team.</p>
        <p>Congratulations! Your recruitment type change has been reviewed and approved.</p>
        <p>You may now use your account to manage {employer['recruitment_type'].lower()} recruitment activities.</p>
        <p><strong>To log in, use your existing credentials:</strong></p>
        <ul>
            <li>Employer Code: {employer['employer_code']}</li>
            <li>Email: {employer['email']}</li>
            <li>Phone Number: {employer['phone']}</li>
            <li>Password: (the password you use daily)</li>
        </ul>
        <p>Thank you for partnering with PESO SmartHire!</p>
        <p>— PESO SmartHire Admin</p>
        """

        msg = Message(subject=subject, recipients=[
                      employer["email"]], html=body)
        mail.send(msg)

        cursor.close()
        conn.close()

        return jsonify({"success": True, "message": "Recruitment type change approved successfully!"})

    except Exception as e:
        print(f"[v0] Error approving recruitment type change: {e}")
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        return jsonify({"success": False, "message": str(e)}), 500


@admin_bp.route("/reject-recruitment-type-change/<int:employer_id>", methods=["POST"])
def reject_recruitment_type_change(employer_id):
    """
    Admin rejects employer recruitment type change
    Reverts back to old recruitment type
    """
    try:
        data = request.get_json()
        reason = data.get("reason") if data else None

        conn = create_connection()
        if not conn:
            return jsonify({"success": False, "message": "Database connection failed"}), 500

        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT * FROM employers WHERE employer_id = %s",
            (employer_id,)
        )
        employer = cursor.fetchone()

        if not employer:
            cursor.close()
            conn.close()
            return jsonify({"success": False, "message": "Employer not found"}), 404

        old_type = employer["old_recruitment_type"]

        # Revert back to old recruitment type
        cursor.execute("""
            UPDATE employers 
            SET recruitment_type = %s,
                recruitment_type_change_pending = 0,
                old_recruitment_type = NULL,
                status = %s
            WHERE employer_id = %s
        """, (old_type, "Approved", employer_id))

        conn.commit()

        # Send rejection email
        subject = "PESO SmartHire - Recruitment Type Change Rejected"
        reason_block = f"<p><strong>Reason:</strong> {reason}</p>" if reason else ""
        body = f"""
        <p>Dear {employer['employer_name']},</p>
        <p>This is PESO SmartHire Team.</p>
        <p>We regret to inform you that your request to change your recruitment type has been reviewed but could not be approved at this time.</p>
        {reason_block}
        <p>Your recruitment type has been reverted back to <strong>{old_type}</strong> recruitment.</p>
        <p>You may reapply for recruitment type change in the future once you meet all requirements.</p>
        <p>If you have any questions, please contact our support team.</p>
        <p>— PESO SmartHire Admin</p>
        """

        msg = Message(subject=subject, recipients=[
                      employer["email"]], html=body)
        mail.send(msg)

        cursor.close()
        conn.close()

        return jsonify({"success": True, "message": "Recruitment type change rejected successfully!"})

    except Exception as e:
        print(f"[v0] Error rejecting recruitment type change: {e}")
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        return jsonify({"success": False, "message": str(e)}), 500
