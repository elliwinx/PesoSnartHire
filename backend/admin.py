from flask import Blueprint, render_template, request, redirect, url_for, session, flash, jsonify
from werkzeug.security import check_password_hash, generate_password_hash
from db_connection import create_connection, run_query
from .notifications import get_notifications, mark_notification_read, get_unread_count, create_notification
from .recruitment_change_handler import revert_recruitment_type_change
from extensions import mail
from flask_mail import Message
from datetime import datetime, timedelta
import secrets
import json
import os
import logging

logger = logging.getLogger(__name__)


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

        # If must_change_password = 1, this is a NEW applicant who hasn't changed their password yet
        # If must_change_password = 0, this is an EXISTING applicant (already changed password once)
        is_new_applicant = applicant.get("must_change_password") == 1

        print(f"[v0] User detection for applicant {applicant_id}:")
        print(
            f"- must_change_password: {applicant.get('must_change_password')}")
        print(f"- Is new applicant: {is_new_applicant}")
        print(f"- Current status: {applicant.get('status')}")

        temp_password_plain = None

        if action == "approved":
            if is_new_applicant:
                # Only generate new credentials for first-time approval
                print(
                    f"[v0] NEW applicant {applicant_id} - generating credentials with must_change_password=1")
                temp_password_plain = secrets.token_urlsafe(8)
                password_hash = generate_password_hash(temp_password_plain)
                cursor.execute(
                    "UPDATE applicants SET password_hash = %s, temp_password = %s, must_change_password = 1 WHERE applicant_id = %s",
                    (password_hash, temp_password_plain, applicant_id)
                )
                applicant["temp_password"] = temp_password_plain
            else:
                # EXISTING applicant - keep current credentials and DO NOT reset must_change_password
                print(
                    f"[v0] EXISTING applicant {applicant_id} - keeping current credentials, NOT resetting must_change_password")
                temp_password_plain = applicant.get("temp_password")

        elif action == "reupload":
            # For reupload - use existing credentials
            print(
                f"[v0] Reupload request - using existing credentials for applicant {applicant_id}")
            temp_password_plain = applicant.get("temp_password")

        # EXISTING users keep their must_change_password = 0 (they already changed password)

        if action == "approved":
            new_status = "Approved"
            subject = "PESO SmartHire - Application Approved"

            if is_new_applicant:
                # NEW applicant - send email with credentials
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
                <p>— PESO SmartHire Admin</p>
                """
            else:
                # EXISTING applicant (residency change) - send approval without credentials
                body = f"""
                <p>Hi {applicant['first_name']},</p>
                <p>This is PESO SmartHire Team.</p>
                <p>Congratulations! Your residency change has been reviewed and approved.</p>
                <p>You now have full access to all features of the PESO SmartHire platform.</p>
                <p>You can log in using your existing credentials to continue using our services.</p>
                <p>Thank you for keeping your information up to date!</p>
                <p>— PESO SmartHire Admin</p>
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
            cursor.execute(
                "UPDATE applicants SET password_hash = NULL, temp_password = NULL WHERE applicant_id = %s",
                (applicant_id,)
            )

        elif action == "reupload":
            new_status = "Reupload"
            document_name = data.get("document_name", "Recommendation Letter")
            subject = "PESO SmartHire - Document Reupload Required"

            if is_new_applicant:
                # NEW applicant - send welcome email with credentials and reupload instructions
                body = f"""
                <p>Hi {applicant['first_name']},</p>
                <p>This is PESO SmartHire Team.</p>
                <p>We have reviewed your application for PESO SmartHire. To proceed with your application, we need you to upload your {document_name}.</p>
                <p>To help you get started, here are your login credentials:</p>
                <ul>
                    <li>Applicant ID: {applicant['applicant_code']}</li>
                    <li>Email: {applicant['email']}</li>
                    <li>Phone Number: {applicant['phone']}</li>
                    <li>Password: {temp_password_plain}</li>
                </ul>
                <p><strong>Steps to Upload Your Document:</strong></p>
                <ol>
                    <li>Log in to your account using the credentials above</li>
                    <li>Upload your {document_name}</li>
                </ol>
                <p>We'll review your document once it's uploaded and notify you of any updates.</p>
                <p>Thank you for choosing PESO SmartHire!</p>
                <p>— PESO SmartHire Admin</p>
                """
            else:
                # EXISTING applicant - regular reupload (don't force password change)
                body = f"""
                <p>Hi {applicant['first_name']},</p>
                <p>This is PESO SmartHire Team.</p>
                <p>We need you to provide an updated {document_name} for your application.</p>
                <p><strong>Required Action:</strong></p>
                <ol>
                    <li>Log in to your PESO SmartHire account</li>
                    <li>Upload your updated {document_name}</li>
                </ol>
                <p>We'll review your document once it's uploaded and update your application status accordingly.</p>
                <p>Note: If you've forgotten your password, you can reset it using the "Forgot Password" option on the login page.</p>
                <p>Thank you for your cooperation!</p>
                <p>— PESO SmartHire Admin</p>
                """

            success_message = "Re-upload request sent. Email notification sent to applicant."

        else:
            print(f"[v1] Invalid action: {action}")
            cursor.close()
            conn.close()
            return jsonify({"success": False, "message": "Invalid action."}), 400

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


@admin_bp.route('/applicants_for_reported_acc')
def applicants_for_reported_acc():
    """Show job posts reported by applicants for moderation."""
    if "admin_id" not in session:
        return redirect(url_for("admin.login"))
    
    conn = create_connection()
    if not conn:
        flash("Database connection failed", "danger")
        return redirect(url_for("admin.admin_home"))
    
    job_reports = []
    
    try:
        cursor = conn.cursor(dictionary=True)

        # Fetch job reports only (correct schema using created_at)
        cursor.execute("""
            SELECT 
                jr.id AS report_id,
                jr.applicant_id,
                jr.job_id,
                jr.reason,
                jr.details,
                jr.created_at AS reported_at,

                CONCAT(
                    COALESCE(reporter.first_name, 'Unknown'), ' ',
                    COALESCE(reporter.middle_name, ''), ' ',
                    COALESCE(reporter.last_name, 'Applicant')
                ) AS reported_by_name,

                COALESCE(j.job_position, 'Deleted Job') AS job_title,
                COALESCE(e.employer_name, 'Unknown Employer') AS employer_name,

                e.employer_id,
                COALESCE(jr.status, 'Pending') AS status,
                j.status AS job_status
            FROM job_reports jr
            LEFT JOIN applicants reporter ON jr.applicant_id = reporter.applicant_id
            LEFT JOIN jobs j ON jr.job_id = j.job_id
            LEFT JOIN employers e ON j.employer_id = e.employer_id
            ORDER BY jr.created_at DESC;
        """)

        job_reports = cursor.fetchall() or []

        cursor.close()

    except Exception as e:
        print(f"[ERROR fetching reported job posts: {str(e)}]")
        flash(f"Error loading reported job posts: {str(e)}", "danger")

    finally:
        conn.close()
    
    return render_template(
        'Admin/applicants_for_reported_acc.html', 
        job_reports=job_reports
    )


@admin_bp.route("/reported_applicants")
def reported_applicants():
    if "admin_id" not in session:
        return redirect(url_for("admin.login"))

    conn = create_connection()
    if not conn:
        flash("Database connection failed", "danger")
        return redirect(url_for("admin.employers_management"))

    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT 
                ar.id AS report_id,
                ar.applicant_id,
                ar.employer_id,
                ar.job_id,
                ar.reason,
                ar.details,
                ar.created_at AS reported_at,

                CONCAT(
                    COALESCE(app.first_name, 'Unknown'), ' ',
                    COALESCE(app.last_name, 'Applicant')
                ) AS applicant_name,

                COALESCE(emp.employer_name, 'Unknown Employer') AS employer_name,
                emp.email AS employer_email,
                COALESCE(job.job_position, 'N/A') AS job_title,
                COALESCE(ar.status, 'Pending') AS status
            FROM applicant_reports ar
            LEFT JOIN applicants app ON ar.applicant_id = app.applicant_id
            LEFT JOIN employers emp ON ar.employer_id = emp.employer_id
            LEFT JOIN jobs job ON ar.job_id = job.job_id
            ORDER BY ar.created_at DESC;
        """)
        reports = cursor.fetchall() or []
        cursor.close()
    except Exception as exc:
        print(f"[v1] Failed to load applicant reports: {exc}")
        reports = []
        flash("Unable to load reported applicants.", "danger")
    finally:
        conn.close()

    return render_template(
        "Admin/reported_applicants.html",
        reports=reports
    )


@admin_bp.route("/get_job_details/<int:job_id>")
def get_job_details(job_id):
    try:
        print(f"[DEBUG] Fetching job details for job_id: {job_id}")
        
        conn = create_connection()
        if not conn:
            print("[DEBUG] Database connection failed")
            return jsonify({"success": False, "message": "Database connection failed"}), 500

        cursor = conn.cursor(dictionary=True)
        print(f"[DEBUG] Executing SQL query for job_id: {job_id}")
        
        # CORRECTED QUERY - NO requirements column!
        cursor.execute("""
            SELECT 
                j.job_id,
                j.job_position,
                j.job_description,
                j.qualifications,
                j.work_schedule,
                j.min_salary,
                j.max_salary,
                j.status,
                j.created_at,
                j.job_expiration_date,
                j.application_count,
                e.employer_name,
                e.city,
                e.province,
                e.employer_id
            FROM jobs j
            LEFT JOIN employers e ON j.employer_id = e.employer_id
            WHERE j.job_id=%s
        """, (job_id,))
        
        job = cursor.fetchone()
        cursor.close()
        conn.close()

        if not job:
            print(f"[DEBUG] Job {job_id} not found in database")
            return jsonify({"success": False, "message": "Job not found"}), 404

        print(f"[DEBUG] Found job: {job.get('job_position')}")

        # Process qualifications for the requirements section
        raw_qualifications = job.get('qualifications') or ""
        requirements = []
        
        if raw_qualifications:
            if isinstance(raw_qualifications, str):
                requirements = [
                    req.strip() for req in raw_qualifications.replace("\r", "").split("\n")
                    if req.strip()
                ]
                if not requirements:
                    requirements = [req.strip() for req in raw_qualifications.split(",") if req.strip()]
        else:
            requirements = ["No qualifications specified."]

        # Build response payload
        payload = {
            "id": job.get("job_id"),
            "title": job.get("job_position"),
            "job_position": job.get("job_position"),
            "description": job.get("job_description"),
            "employment_type": job.get("work_schedule"),  # Use work_schedule as employment_type
            "work_schedule": job.get("work_schedule"),
            "requirements": requirements,  # From qualifications
            "qualifications": requirements,
            "min_salary": float(job.get("min_salary", 0)) if job.get("min_salary") else 0,
            "max_salary": float(job.get("max_salary", 0)) if job.get("max_salary") else 0,
            "status": job.get("status"),
            "posted_at": job.get("created_at").isoformat() if job.get("created_at") else None,
            "expiration_date": job.get("job_expiration_date").isoformat() if job.get("job_expiration_date") else None,
            "application_count": job.get("application_count", 0),
            "employer_name": job.get("employer_name"),
            "location": ", ".join(filter(None, [job.get("city"), job.get("province")])),
            "employer_id": job.get("employer_id")
        }

        print(f"[DEBUG] Successfully built payload for job {job_id}")
        return jsonify({"success": True, "job": payload})

    except Exception as e:
        print(f"[DEBUG] ERROR in get_job_details: {str(e)}")
        import traceback
        traceback.print_exc()
        
        if 'conn' in locals():
            try:
                conn.close()
            except:
                pass
            
        return jsonify({
            "success": False, 
            "message": f"Server error: {str(e)}"
        }), 500

@admin_bp.route("/job/<int:job_id>")
def admin_view_job(job_id):
    """Admin view for job details"""
    if "admin_id" not in session:
        return "Unauthorized", 401
    
    conn = create_connection()
    if not conn:
        return "Database connection failed", 500

    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT 
                j.job_id,
                j.job_position,
                j.job_description,
                j.qualifications,
                j.work_schedule,
                j.min_salary,
                j.max_salary,
                j.status,
                j.created_at,
                j.job_expiration_date,
                e.employer_name,
                e.city,
                e.province,
                e.employer_id
            FROM jobs j
            LEFT JOIN employers e ON j.employer_id = e.employer_id
            WHERE j.job_id=%s
        """, (job_id,))
        
        job = cursor.fetchone()
        
        if not job:
            return "Job not found", 404

        # Format qualifications as HTML list
        qualifications_html = ""
        if job.get('qualifications'):
            qualifications = [
                q.strip() for q in job['qualifications'].split('\n') 
                if q.strip()
            ]
            qualifications_html = "<ul style='margin: 0; padding-left: 20px;'>" + "".join([f"<li style='margin-bottom: 5px;'>{q}</li>" for q in qualifications]) + "</ul>"
        else:
            qualifications_html = "<p>No qualifications specified.</p>"

        # Format salary
        salary = "Not specified"
        if job.get('min_salary') and job.get('max_salary'):
            salary = f"₱{job['min_salary']:,.2f} - ₱{job['max_salary']:,.2f}"
        elif job.get('min_salary'):
            salary = f"₱{job['min_salary']:,.2f}"
        elif job.get('max_salary'):
            salary = f"₱{job['max_salary']:,.2f}"

        # Format work schedule
        work_schedule = job['work_schedule'].replace('-', ' ').title() if job.get('work_schedule') else "Not specified"

        # Render the job details HTML with your CSS style
        html_content = f"""
        <div class="modal-job-content">
            <div class="job-title-row">
                <h2 style="font-size: 24px; font-weight: bold; color: #2c3e50; margin: 0;">{job['job_position']}</h2>
            </div>
            
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <p style="margin: 8px 0; color: #555;"><strong>Company:</strong> {job['employer_name']}</p>
                <p style="margin: 8px 0; color: #555;"><strong>Location:</strong> {job['city']}, {job['province']}</p>
                <p style="margin: 8px 0; color: #555;"><strong>Salary:</strong> {salary}</p>
                <p style="margin: 8px 0; color: #555;"><strong>Work Schedule:</strong> {work_schedule}</p>
                <p style="margin: 8px 0; color: #555;"><strong>Status:</strong> 
                    <span style="color: {'#27ae60' if job['status'] == 'active' else '#e74c3c'}; font-weight: bold;">
                        {job['status'].title()}
                    </span>
                </p>
                <p style="margin: 8px 0; color: #555;"><strong>Posted:</strong> {job['created_at'].strftime('%B %d, %Y') if job['created_at'] else 'N/A'}</p>
                {f"<p style='margin: 8px 0; color: #555;'><strong>Expires:</strong> {job['job_expiration_date'].strftime('%B %d, %Y')}</p>" if job.get('job_expiration_date') else ''}
            </div>

            <div style="margin-bottom: 20px;">
                <h3 style="font-size: 16px; margin-top: 12px; margin-bottom: 5px; color: #7b1113; font-weight: 600;">Job Description</h3>
                <p style="color: #555; margin-bottom: 25px; font-size: 1rem; line-height: 1.5;">{job['job_description'] or 'No description provided.'}</p>
            </div>

            <div style="margin-bottom: 20px;">
                <h3 style="font-size: 16px; margin-top: 12px; margin-bottom: 5px; color: #7b1113; font-weight: 600;">Requirements</h3>
                {qualifications_html}
            </div>

            <div style="text-align: center; padding-top: 20px; border-top: 1px solid #eee;">
                <a href="/admin/employers/{job['employer_id']}" style="background: #7b1113; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-flex; align-items: center; gap: 8px; font-size: 14px;">
                    <i class="fa-solid fa-user-tie"></i> View Employer Profile
                </a>
            </div>
        </div>
        """

        return html_content

    except Exception as e:
        print(f"[ERROR] Failed to load job {job_id}: {e}")
        return f"<p style='color: red; text-align: center; padding: 20px;'>Error loading job details: {str(e)}</p>", 500
    
    finally:
        if 'conn' in locals():
            conn.close()
            
def safe_send_email(subject, recipient, body):
    """Send email with proper error handling"""
    if not recipient:
        print(f"❌ No recipient for: {subject}")
        return False
    
    try:
        msg = Message(
            subject=subject,
            recipients=[recipient],
            html=body,
            sender=("PESO SmartHire", "noreply@pesosmarthire.com")
        )
        mail.send(msg)
        print(f"✅ Email sent to: {recipient}")
        return True
    except Exception as e:
        print(f"❌ Failed to send email to {recipient}: {str(e)}")
        return False

@admin_bp.route("/test-job-report/<int:report_id>")
def test_job_report(report_id):
    """Test if we can fetch report data"""
    conn = create_connection()
    cursor = conn.cursor(dictionary=True)
    
    cursor.execute("""
        SELECT jr.id, jr.job_id, j.job_position, e.employer_name, e.email 
        FROM job_reports jr
        LEFT JOIN jobs j ON jr.job_id = j.job_id
        LEFT JOIN employers e ON j.employer_id = e.employer_id
        WHERE jr.id = %s
    """, (report_id,))
    
    report = cursor.fetchone()
    cursor.close()
    conn.close()
    
    return jsonify({
        "success": True,
        "report": report
    })

def ensure_job_report_details_column(cursor):
    cursor.execute("SHOW COLUMNS FROM job_reports LIKE 'details'")
    if not cursor.fetchone():
        cursor.execute("ALTER TABLE job_reports ADD COLUMN details TEXT NULL AFTER reason")


@admin_bp.route("/job_reports/<int:report_id>/action", methods=['POST'])
def handle_job_report_action(report_id):
    if "admin_id" not in session:
        return jsonify({"success": False, "message": "Unauthorized"}), 401

    data = request.get_json(silent=True) or {}
    action = data.get("action")
    moderator_note = data.get("moderator_note", "").strip()
    days = data.get("days", 0)  # Get the days parameter

    print(f"📥 Received request - report_id: {report_id}, action: {action}, days: {days}")

    valid_actions = {"confirm", "reject"}
    if action not in valid_actions:
        return jsonify({"success": False, "message": "Invalid action"}), 400

    conn = create_connection()
    if not conn:
        return jsonify({"success": False, "message": "Database connection failed"}), 500

    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT 
                jr.id,
                jr.job_id,
                jr.reason,
                jr.details,
                jr.applicant_id AS reporter_id,
                j.job_position,
                j.employer_id,
                e.employer_name,
                e.email AS employer_email,
                a.email AS reporter_email,
                CONCAT(COALESCE(a.first_name, ''), ' ', COALESCE(a.last_name, '')) AS reporter_name
            FROM job_reports jr
            LEFT JOIN jobs j ON jr.job_id = j.job_id
            LEFT JOIN employers e ON j.employer_id = e.employer_id
            LEFT JOIN applicants a ON jr.applicant_id = a.applicant_id
            WHERE jr.id = %s
        """, (report_id,))
        report = cursor.fetchone()

        if not report:
            print(f"❌ Report {report_id} not found")
            return jsonify({"success": False, "message": "Report not found"}), 404

        job_id = report.get("job_id")
        job_position = report.get("job_position", "Job")
        employer_id = report.get("employer_id")

        print(f"📊 Report found - job_id: {job_id}, job_position: {job_position}")

        if action == "confirm":
            print("🔄 Processing CONFIRM action...")
            
            # Update job status to suspended
            cursor.execute(
                "UPDATE jobs SET status = %s WHERE job_id = %s",
                ("suspended", job_id)
            )
            cursor.execute(
                "UPDATE job_reports SET status = %s, updated_at = NOW() WHERE id = %s",
                ("Confirmed", report_id)
            )
            cursor.execute(
                "UPDATE applications SET status = %s WHERE job_id = %s",
                ("Cancelled", job_id)
            )
            
            # Get impacted applicants
            cursor.execute("""
                SELECT DISTINCT a.applicant_id, a.email, a.first_name, a.last_name
                FROM applications ap
                JOIN applicants a ON ap.applicant_id = a.applicant_id
                WHERE ap.job_id = %s
            """, (job_id,))
            impacted_applicants = cursor.fetchall() or []

            conn.commit()
            print("✅ Database updates committed")

            # ========== EMAIL SENDING ==========
            email_count = 0
            
            # 1. Send email to Employer
            employer_email = report.get("employer_email")
            if employer_email:
                try:
                    print(f"📧 Sending email to employer: {employer_email}")
                    safe_send_email(
                        "Job post suspended",
                        employer_email,
                        f"""
                        <p>Hello {report.get('employer_name','Employer')},</p>
                        <p>Your job post titled <strong>{job_position}</strong> has been reported and confirmed. 
                        It is now temporarily <strong>suspended</strong> and all applications have been cancelled.</p>
                        <p>You have <strong>{days} days</strong> to respond to this report.</p>
                        <p>Please contact PESO SmartHire admin for more details.</p>
                        """
                    )
                    email_count += 1
                except Exception as e:
                    print(f"❌ Employer email error: {e}")

            # 2. Send emails to Applicants
            for applicant in impacted_applicants:
                applicant_email = applicant.get("email")
                if applicant_email:
                    try:
                        print(f"📧 Sending email to applicant: {applicant_email}")
                        safe_send_email(
                            "Application cancelled",
                            applicant_email,
                            f"""
                            <p>Hi {applicant.get('first_name','Applicant')},</p>
                            <p>The job post <strong>{job_position}</strong> was suspended after our investigation. 
                            Your application has been cancelled automatically.</p>
                            <p>We apologize for any inconvenience.</p>
                            """
                        )
                        email_count += 1
                    except Exception as e:
                        print(f"❌ Applicant email error ({applicant['applicant_id']}): {e}")

            # 3. Send email to Reporter
            reporter_email = report.get("reporter_email")
            if reporter_email:
                try:
                    print(f"📧 Sending email to reporter: {reporter_email}")
                    safe_send_email(
                        "Report confirmed",
                        reporter_email,
                        f"""
                        <p>Hi {report.get('reporter_name','Applicant')},</p>
                        <p>Your report for <strong>{job_position}</strong> has been confirmed. 
                        The job post is now suspended.</p>
                        <p>Thank you for helping maintain the quality of our platform.</p>
                        """
                    )
                    email_count += 1
                except Exception as e:
                    print(f"❌ Reporter email error: {e}")

            print(f"✅ Process completed - {email_count} emails sent")

            return jsonify({
                "success": True,
                "message": f"{job_position} was suspended and all applications were cancelled. Employer has {days} days to respond.",
                "job_status": "suspended",
                "report_status": "Confirmed"
            })

        elif action == "reject":
            print("🔄 Processing REJECT action...")
            cursor.execute(
                "UPDATE job_reports SET status = %s, updated_at = NOW() WHERE id = %s",
                ("Rejected", report_id)
            )
            conn.commit()

            # Send rejection email to reporter
            reporter_email = report.get("reporter_email")
            if reporter_email:
                try:
                    print(f"📧 Sending rejection email to reporter: {reporter_email}")
                    safe_send_email(
                        "Report rejected",
                        reporter_email,
                        f"""
                        <p>Hi {report.get('reporter_name','Applicant')},</p>
                        <p>Your report for <strong>{job_position}</strong> was rejected. 
                        Our moderators did not find sufficient evidence.</p>
                        {f'<p>Moderator note: {moderator_note}</p>' if moderator_note else ''}
                        <p>Thank you for your understanding.</p>
                        """
                    )
                except Exception as e:
                    print(f"❌ Reporter rejection email error: {e}")

            return jsonify({
                "success": True,
                "message": "Report rejected and reporter notified.",
                "job_status": None,
                "report_status": "Rejected"
            })

    except Exception as exc:
        conn.rollback()
        print(f"❌ ERROR in handle_job_report_action: {exc}")
        import traceback
        traceback.print_exc()  # This will show the full error traceback
        return jsonify({"success": False, "message": f"Failed to update job status: {str(exc)}"}), 500
    finally:
        cursor.close()
        conn.close()


def ensure_applicant_suspension_column(cursor):
    cursor.execute("SHOW COLUMNS FROM applicants LIKE 'suspension_end_at'")
    if not cursor.fetchone():
        cursor.execute("ALTER TABLE applicants ADD COLUMN suspension_end_at DATETIME NULL AFTER updated_at")


@admin_bp.route("/applicant_reports/<int:report_id>/action", methods=['POST'])
def handle_applicant_report_action(report_id):
    """Moderate reported applicants (confirm/reject)."""
    if "admin_id" not in session:
        return jsonify({"success": False, "message": "Unauthorized"}), 401

    data = request.get_json(silent=True) or {}
    action = data.get("action")
    moderator_note = data.get("moderator_note", "").strip()
    suspension_days = int(data.get("suspension_days") or 0)

    valid_actions = {"confirm", "reject"}
    if action not in valid_actions:
        return jsonify({"success": False, "message": "Invalid action"}), 400

    conn = create_connection()
    if not conn:
        return jsonify({"success": False, "message": "Database connection failed"}), 500

    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT 
                ar.id,
                ar.applicant_id,
                ar.employer_id,
                ar.reason,
                ar.details,
                ar.status AS report_status,
                CONCAT(COALESCE(app.first_name, ''), ' ', COALESCE(app.last_name, '')) AS applicant_name,
                app.email AS applicant_email,
                emp.employer_name,
                emp.email AS employer_email
            FROM applicant_reports ar
            LEFT JOIN applicants app ON ar.applicant_id = app.applicant_id
            LEFT JOIN employers emp ON ar.employer_id = emp.employer_id
            WHERE ar.id = %s
        """, (report_id,))
        report = cursor.fetchone()

        if not report:
            return jsonify({"success": False, "message": "Report not found"}), 404

        applicant_id = report.get("applicant_id")
        employer_id = report.get("employer_id")

        if action == "confirm":
            ensure_applicant_suspension_column(cursor)
            suspension_end = None
            if suspension_days > 0:
                suspension_end = datetime.utcnow() + timedelta(days=suspension_days)
            cursor.execute(
                "UPDATE applicants SET status = %s, is_active = %s, suspension_end_at = %s, updated_at = NOW() WHERE applicant_id = %s",
                ("Suspended", 0, suspension_end, applicant_id)
            )
            cursor.execute(
                "UPDATE applications SET status = %s WHERE applicant_id = %s",
                ("On Hold", applicant_id)
            )
            cursor.execute(
                "UPDATE applicant_reports SET status = %s, updated_at = NOW() WHERE id = %s",
                ("Confirmed", report_id)
            )
            conn.commit()

            create_notification(
                notification_type="applicant_reported",
                title="Account suspended",
                message="Your account was suspended after an employer report.",
                applicant_id=applicant_id
            )
            create_notification(
                notification_type="employer_reported",
                title="Report confirmed",
                message=f"Your report for {report.get('applicant_name','the applicant')} was confirmed.",
                employer_id=employer_id
            )
            safe_send_email(
                "Account suspended",
                report.get("applicant_email"),
                f"<p>Hi {report.get('applicant_name','Applicant')},</p>"
                "<p>We confirmed the report filed against your account and applied a suspension.</p>"
                f"{f'<p>The suspension will lift automatically after {suspension_days} day(s).</p>' if suspension_days > 0 else '<p>The suspension is indefinite until further notice.</p>'}"
            )
            safe_send_email(
                "Report confirmed",
                report.get("employer_email"),
                f"<p>Hi {report.get('employer_name','Employer')},</p>"
                "<p>We confirmed the report you filed. The applicant has been suspended.</p>"
            )

            return jsonify({
                "success": True,
                "message": "Applicant suspended and both parties notified.",
                "applicant_status": "Suspended",
                "report_status": "Confirmed"
            })

        # Reject branch
        cursor.execute(
            "UPDATE applicant_reports SET status = %s, updated_at = NOW() WHERE id = %s",
            ("Rejected", report_id)
        )
        conn.commit()

        create_notification(
            notification_type="employer_reported",
            title="Report rejected",
            message="We reviewed your report and found no violation.",
            employer_id=employer_id
        )
        safe_send_email(
            "Report rejected",
            report.get("employer_email"),
            "<p>Your report was reviewed but we did not find a violation.</p>"
            f"{f'<p>Moderator note: {moderator_note}</p>' if moderator_note else ''}"
        )

        return jsonify({
            "success": True,
            "message": "Report rejected and reporter notified.",
            "applicant_status": None,
            "report_status": "Rejected"
        })
    except Exception as exc:
        conn.rollback()
        print(f"[v1] Failed to update applicant report {report_id}: {exc}")
        return jsonify({"success": False, "message": "Failed to update applicant status."}), 500
    finally:
        cursor.close()
        conn.close()


@admin_bp.route('/update_report_status', methods=['POST'])
def update_report_status():
    if "admin_id" not in session:
        return jsonify({"status": "error", "message": "Unauthorized"}), 401

    report_id = request.form.get("report_id")
    new_status = request.form.get("status")
    days = request.form.get("days", 0)

    print(f"🔄 Updating report {report_id} to {new_status} with {days} days")

    conn = create_connection()
    if not conn:
        return jsonify({"status": "error", "message": "Database connection failed"})

    cursor = conn.cursor(dictionary=True)

    try:
        # Update the report status
        cursor.execute("""
            UPDATE job_reports
            SET status = %s
            WHERE id = %s
        """, (new_status, report_id))
        
        # If status is Confirmed, send emails and update job status
        if new_status == "Confirmed":
            # Get detailed report information
            cursor.execute("""
                SELECT 
                    jr.job_id,
                    jr.applicant_id AS reporter_id,
                    j.job_position,
                    j.employer_id,
                    e.employer_name,
                    e.email AS employer_email,
                    a.email AS reporter_email,
                    CONCAT(a.first_name, ' ', a.last_name) AS reporter_name
                FROM job_reports jr
                LEFT JOIN jobs j ON jr.job_id = j.job_id
                LEFT JOIN employers e ON j.employer_id = e.employer_id
                LEFT JOIN applicants a ON jr.applicant_id = a.applicant_id
                WHERE jr.id = %s
            """, (report_id,))
            report = cursor.fetchone()

            if report:
                job_id = report['job_id']
                job_position = report['job_position'] or "Job Post"
                employer_email = report['employer_email']
                
                print(f"📊 Processing job {job_id}: {job_position}")

                # 1. Update job status to suspended (sa employer side)
                cursor.execute(
                    "UPDATE jobs SET status = 'suspended' WHERE job_id = %s",
                    (job_id,)
                )

                # 2. ✅ CORRECTED: Update applications status to 'Cancelled' (NOT 'Withdrawn')
                cursor.execute(
                    "UPDATE applications SET status = 'Cancelled' WHERE job_id = %s",
                    (job_id,)
                )

                # 3. Get all applicants for this job to notify them
                cursor.execute("""
                    SELECT DISTINCT a.applicant_id, a.email, a.first_name, a.last_name
                    FROM applications ap
                    JOIN applicants a ON ap.applicant_id = a.applicant_id
                    WHERE ap.job_id = %s AND a.email IS NOT NULL
                """, (job_id,))
                impacted_applicants = cursor.fetchall()

                print(f"👥 Found {len(impacted_applicants)} applicants to notify")

                # 4. Send email to Employer
                if employer_email:
                    try:
                        safe_send_email(
                            "Job Post Suspended - PESO SmartHire",
                            employer_email,
                            f"""
                            <h3>Job Post Suspended</h3>
                            <p>Dear {report['employer_name']},</p>
                            <p>Your job post titled <strong>"{job_position}"</strong> has been reported and after review, has been confirmed.</p>
                            <p>The job post is now <strong style="color: red;">SUSPENDED</strong> and all applications have been cancelled.</p>
                            <p>You have <strong>{days} days</strong> to respond to this report.</p>
                            <p>Please contact PESO SmartHire administration for more details.</p>
                            <br>
                            <p>Best regards,<br>PESO SmartHire Team</p>
                            """
                        )
                        print(f"✅ Email sent to employer: {employer_email}")
                    except Exception as e:
                        print(f"❌ Failed to send email to employer: {e}")

                # 5. Send emails to Applicants
                for applicant in impacted_applicants:
                    applicant_email = applicant['email']
                    if applicant_email:
                        try:
                            safe_send_email(
                                "Application Cancelled - PESO SmartHire",  # ✅ Changed subject
                                applicant_email,
                                f"""
                                <h3>Application Cancelled</h3>
                                <p>Dear {applicant['first_name']},</p>
                                <p>Your application for the job post <strong>"{job_position}"</strong> has been <strong>CANCELLED</strong>.</p>
                                <p>The job post was suspended after our investigation team confirmed a report against it.</p>
                                <p>We apologize for any inconvenience this may cause.</p>
                                <br>
                                <p>Best regards,<br>PESO SmartHire Team</p>
                                """
                            )
                            print(f"✅ Email sent to applicant: {applicant_email}")
                        except Exception as e:
                            print(f"❌ Failed to send email to applicant {applicant['applicant_id']}: {e}")

                # 6. Send email to Reporter
                reporter_email = report.get('reporter_email')
                if reporter_email:
                    try:
                        safe_send_email(
                            "Report Confirmed - PESO SmartHire",
                            reporter_email,
                            f"""
                            <h3>Report Confirmed</h3>
                            <p>Dear {report.get('reporter_name', 'User')},</p>
                            <p>Your report for the job post <strong>"{job_position}"</strong> has been reviewed and confirmed.</p>
                            <p>The job post has been suspended and all applications cancelled.</p>
                            <p>Thank you for helping maintain the quality and safety of our platform.</p>
                            <br>
                            <p>Best regards,<br>PESO SmartHire Team</p>
                            """
                        )
                        print(f"✅ Email sent to reporter: {reporter_email}")
                    except Exception as e:
                        print(f"❌ Failed to send email to reporter: {e}")

        conn.commit()
        print(f"✅ Successfully updated report {report_id} to {new_status}")
        
        return jsonify({"status": "success", "message": "Status updated and notifications sent!"})

    except Exception as e:
        conn.rollback()
        print(f"❌ Database error: {e}")
        return jsonify({"status": "error", "message": f"Database error: {str(e)}"})
    finally:
        cursor.close()
        conn.close()

@admin_bp.route("/applicants/<int:applicant_id>")
def view_applicant(applicant_id):
    conn = create_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        "SELECT * FROM applicants WHERE applicant_id = %s", (applicant_id,)
    )
    applicant = cursor.fetchone()
    cursor.close()
    conn.close()

    if not applicant:
        flash("Applicant not found", "danger")
        return redirect(url_for("admin.applicants_management"))

    # Only prepare documents if applicant is non-Lipeño
    documents = []
    if not applicant.get("is_from_lipa") and applicant.get("recommendation_letter_path"):
        documents.append({
            "name": "Recommendation Letter",
            "last_updated": applicant.get("recommendation_letter_uploaded_at") or applicant.get("updated_at"),
            "expires_at": applicant.get("recommendation_letter_expiry")
        })

    referrer = request.referrer
    from_notifications = False
    if referrer and "/admin/notifications" in referrer:
        from_notifications = True

    return render_template(
        "Admin/applicant_profile.html",
        applicant=applicant,
        from_notifications=from_notifications,
        documents=documents
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

    LOCAL_DOCUMENTS = {
        "business_permit_path": "business_permit_expiry",
        "philiobnet_registration_path": "philiobnet_registration_expiry",
        "job_orders_of_client_path": "job_orders_expiry",
        "dole_no_pending_case_path": "dole_no_pending_case_expiry",
        "dole_authority_to_recruit_path": "dole_authority_expiry",
    }

    INTERNATIONAL_DOCUMENTS = {
        "business_permit_path": "business_permit_expiry",
        "philiobnet_registration_path": "philiobnet_registration_expiry",
        "job_orders_of_client_path": "job_orders_expiry",
        "dmw_no_pending_case_path": "dmw_no_pending_case_expiry",
        "license_to_recruit_path": "license_to_recruit_expiry",
    }

    UPLOADED_AT_MAP = {
        "business_permit_path": "business_permit_uploaded_at",
        "philiobnet_registration_path": "philiobnet_uploaded_at",
        "job_orders_of_client_path": "job_orders_uploaded_at",
        "dole_no_pending_case_path": "dole_no_pending_uploaded_at",
        "dole_authority_to_recruit_path": "dole_authority_uploaded_at",
        "dmw_no_pending_case_path": "dmw_no_pending_uploaded_at",
        "license_to_recruit_path": "license_to_recruit_uploaded_at",
    }

    ALL_DOCUMENTS = {**LOCAL_DOCUMENTS, **INTERNATIONAL_DOCUMENTS}

    documents = []
    for file_field, expiry_field in ALL_DOCUMENTS.items():
        if employer.get(file_field):  # Only process if file exists
            uploaded_at_field = UPLOADED_AT_MAP.get(file_field)
            last_updated_value = employer.get(uploaded_at_field)

            expires_at_value = employer.get(expiry_field)
            if expires_at_value and isinstance(expires_at_value, str):
                expires_at_value = datetime.fromisoformat(expires_at_value)

            documents.append({
                "name": file_field.replace("_path", "").replace("_", " ").title(),
                "last_updated": last_updated_value,
                "expires_at": expires_at_value
            })

    referrer = request.referrer
    from_notifications = False
    if referrer and "/admin/notifications" in referrer:
        from_notifications = True

    return render_template(
        "Admin/employer_profile.html",
        employer=employer,
        documents=documents,
        from_notifications=from_notifications,
        recruitment_type_change_pending=employer.get(
            "recruitment_type_change_pending", 0)
    )


@admin_bp.route("/delete-rejected-employer/<int:employer_id>", methods=["POST"])
def delete_rejected_employer(employer_id):
    """Delete a rejected employer record from the system.

    This allows the employer to retry registration with the same email/info.
    All associated documents and files are also deleted.
    """
    try:
        data = request.get_json() if request.is_json else {}

        conn = create_connection()
        if not conn:
            return jsonify({"success": False, "message": "Database connection failed"}), 500

        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT * FROM employers WHERE employer_id = %s AND status = 'Rejected'",
            (employer_id,)
        )
        employer = cursor.fetchone()

        if not employer:
            cursor.close()
            conn.close()
            return jsonify({"success": False, "message": "Employer not found or not in Rejected status"}), 404

        file_fields = [
            "company_logo_path",
            "business_permit_path",
            "philiobnet_registration_path",
            "job_orders_of_client_path",
            "dole_no_pending_case_path",
            "dole_authority_to_recruit_path",
            "dmw_no_pending_case_path",
            "license_to_recruit_path"
        ]

        for field in file_fields:
            file_path = employer.get(field)
            if file_path:
                try:
                    full_path = os.path.join("static", file_path)
                    if os.path.exists(full_path):
                        os.remove(full_path)
                        logger.info(f"Deleted file: {full_path}")
                except Exception as e:
                    logger.warning(f"Failed to delete file {file_path}: {e}")

        # Delete the employer record from database
        cursor.execute(
            "DELETE FROM employers WHERE employer_id = %s",
            (employer_id,)
        )
        conn.commit()

        cursor.close()
        conn.close()

        return jsonify({
            "success": True,
            "message": f"Rejected employer record deleted. They can now re-register with the same information."
        })

    except Exception as e:
        logger.exception(f"Error deleting rejected employer: {e}")
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        return jsonify({"success": False, "message": f"An error occurred: {str(e)}"}), 500


@admin_bp.route("/update_local_employer_status/<int:employer_id>", methods=["POST"])
def update_local_employer_status(employer_id):
    try:
        data = request.get_json()
        print(f"[v1] Received data for employer {employer_id}: {data}")

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
            "SELECT * FROM employers WHERE employer_id = %s", (employer_id,))
        employer = cursor.fetchone()

        if not employer:
            print(f"[v1] Employer {employer_id} not found in DB")
            cursor.close()
            conn.close()
            return jsonify({"success": False, "message": "Employer not found"}), 404

        is_new_employer = employer.get("must_change_password") == 1

        temp_password_plain = None

        if action == "approved":
            if is_new_employer:
                # Only generate new credentials for first-time approval
                temp_password_plain = secrets.token_urlsafe(8)
                password_hash = generate_password_hash(temp_password_plain)
                cursor.execute(
                    "UPDATE employers SET password_hash = %s, temp_password = %s, must_change_password = 1 WHERE employer_id = %s",
                    (password_hash, temp_password_plain, employer_id)
                )
            else:
                # EXISTING employer - keep current credentials, DO NOT reset must_change_password
                temp_password_plain = employer.get("temp_password")

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
                <p><strong>You are required to change your password upon logging in for security purposes.</strong></p>
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

            # Do NOT delete if they're an existing employer or if recruitment type change was rejected
            should_delete = is_new_employer and employer.get(
                "recruitment_type_change_pending") == 0

            if should_delete:
                success_message = "Local employer rejected and record deleted. Notification email sent."

                file_fields = [
                    "company_logo_path",
                    "business_permit_path",
                    "philiobnet_registration_path",
                    "job_orders_of_client_path",
                    "dole_no_pending_case_path",
                    "dole_authority_to_recruit_path",
                    "dmw_no_pending_case_path",
                    "license_to_recruit_path"
                ]

                for field in file_fields:
                    file_path = employer.get(field)
                    if file_path:
                        try:
                            full_path = os.path.join("static", file_path)
                            if os.path.exists(full_path):
                                os.remove(full_path)
                                logger.info(f"Deleted file: {full_path}")
                        except Exception as e:
                            logger.warning(
                                f"Failed to delete file {file_path}: {e}")

                # Send email BEFORE deletion
                msg = Message(subject=subject, recipients=[
                              employer["email"]], html=body)
                mail.send(msg)

                # Delete the record
                cursor.execute(
                    "DELETE FROM employers WHERE employer_id = %s",
                    (employer_id,)
                )
                conn.commit()
                cursor.close()
                conn.close()

                return jsonify({"success": True, "message": success_message})
            else:
                success_message = "Local employer rejected. Notification email sent."

        elif action == "reupload":
            pass

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
                "UPDATE employers SET status = %s, rejection_reason = %s, is_active = %s WHERE employer_id = %s",
                (new_status, reason, is_active_value, employer_id)
            )
        else:
            cursor.execute(
                "UPDATE employers SET status = %s, is_active = %s, approved_at = NOW() WHERE employer_id = %s",
                (new_status, is_active_value, employer_id)
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


@admin_bp.route("/update_international_employer_status/<int:employer_id>", methods=["POST"])
def update_international_employer_status(employer_id):
    try:
        data = request.get_json()
        print(f"[v1] Received data for employer {employer_id}: {data}")

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
            "SELECT * FROM employers WHERE employer_id = %s", (employer_id,))
        employer = cursor.fetchone()

        if not employer:
            print(f"[v1] Employer {employer_id} not found in DB")
            cursor.close()
            conn.close()
            return jsonify({"success": False, "message": "Employer not found"}), 404

        is_new_employer = employer.get("must_change_password") == 1

        temp_password_plain = None

        if action == "approved":
            if is_new_employer:
                # Only generate new credentials for first-time approval
                temp_password_plain = secrets.token_urlsafe(8)
                password_hash = generate_password_hash(temp_password_plain)
                cursor.execute(
                    "UPDATE employers SET password_hash = %s, temp_password = %s, must_change_password = 1 WHERE employer_id = %s",
                    (password_hash, temp_password_plain, employer_id)
                )
            else:
                # EXISTING employer - keep current credentials, DO NOT reset must_change_password
                temp_password_plain = employer.get("temp_password")

            new_status = "Approved"
            subject = "PESO SmartHire - International Recruitment Account Approved"

            if is_new_employer:
                credentials_block = f"""
                <p>Included below are your login credentials:</p>
                <ul>
                    <li>Employer Code: {employer['employer_code']}</li>
                    <li>Email: {employer['email']}</li>
                    <li>Phone Number: {employer['phone']}</li>
                    <li>Password: {temp_password_plain}</li>
                </ul>
                <p><strong>You are required to change your password upon logging in for security purposes.</strong></p>
                """
            else:
                credentials_block = """
                <p><strong>Use your existing login credentials to access your account.</strong></p>
                """

            body = f"""
            <p>Dear {employer['employer_name']},</p>
            <p>This is PESO SmartHire Team.</p>
            <p>Congratulations! Your international recruitment account has been reviewed and approved!</p>
            <p>You may now post job orders and access your employer dashboard to manage your recruitment activities.</p>
            {credentials_block}
            <p>To get started, visit our platform and log in with your credentials. You can then begin posting job orders and managing your recruitment needs.</p>
            <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
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
            <p>Please review the requirements and feel free to reapply in the future once you have met all the necessary qualifications.</p>
            <p>If you have any questions regarding this decision, please contact our support team.</p>
            <p>Thank you for your interest in PESO SmartHire.</p>
            <p>— PESO SmartHire Admin</p>
            """

            # Do NOT delete if they're an existing employer or if recruitment type change was rejected
            should_delete = is_new_employer and employer.get(
                "recruitment_type_change_pending") == 0

            if should_delete:
                success_message = "International employer rejected and record deleted. Notification email sent."

                file_fields = [
                    "company_logo_path",
                    "business_permit_path",
                    "philiobnet_registration_path",
                    "job_orders_of_client_path",
                    "dole_no_pending_case_path",
                    "dole_authority_to_recruit_path",
                    "dmw_no_pending_case_path",
                    "license_to_recruit_path"
                ]

                for field in file_fields:
                    file_path = employer.get(field)
                    if file_path:
                        try:
                            full_path = os.path.join("static", file_path)
                            if os.path.exists(full_path):
                                os.remove(full_path)
                                logger.info(f"Deleted file: {full_path}")
                        except Exception as e:
                            logger.warning(
                                f"Failed to delete file {file_path}: {e}")

                # Send email BEFORE deletion
                msg = Message(subject=subject, recipients=[
                              employer["email"]], html=body)
                mail.send(msg)

                # Delete the record
                cursor.execute(
                    "DELETE FROM employers WHERE employer_id = %s",
                    (employer_id,)
                )
                conn.commit()
                cursor.close()
                conn.close()

                return jsonify({"success": True, "message": success_message})
            else:
                success_message = "International employer rejected. Notification email sent."

        elif action == "reupload":
            pass

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
                "UPDATE employers SET status = %s, rejection_reason = %s, is_active = %s WHERE employer_id = %s",
                (new_status, reason, is_active_value, employer_id)
            )
        else:
            cursor.execute(
                "UPDATE employers SET status = %s, is_active = %s, approved_at = NOW() WHERE employer_id = %s",
                (new_status, is_active_value, employer_id)
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

        # NEW employer: must_change_password = 1 (hasn't changed password yet)
        is_new_employer = employer.get("must_change_password") == 1

        new_recruitment_type = employer["recruitment_type"]
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
        # If new and missing temp_password, generate one. Otherwise keep existing temp_password (DO NOT reset for existing)
        if is_new_employer and not employer.get("temp_password"):
            temp_password_plain = secrets.token_urlsafe(8)
            password_hash = generate_password_hash(temp_password_plain)

            cursor.execute(
                "UPDATE employers SET password_hash = %s, temp_password = %s WHERE employer_id = %s",
                (password_hash, temp_password_plain, employer_id)
            )
            conn.commit()
        else:
            temp_password_plain = employer.get("temp_password")

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
    Reverts back to old recruitment type AND restores old documents
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

        revert_result = revert_recruitment_type_change(employer_id, conn)
        if not revert_result.get("success"):
            cursor.close()
            conn.close()
            return jsonify({"success": False, "message": f"Reversion failed: {revert_result.get('message')}"}), 500

        # Set status back to Approved, is_active to 1, clear pending flags and documents_to_reupload
        cursor.execute("""
            UPDATE employers
            SET recruitment_type = %s,
                recruitment_type_change_pending = 0,
                old_recruitment_type = NULL,
                status = 'Approved',
                is_active = 1,
                documents_to_reupload = NULL,
                approved_at = NOW()
            WHERE employer_id = %s
        """, (old_type, employer_id))

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
        <p>Your previous documents have been restored and you may continue your {old_type.lower()} recruitment activities.</p>
        <p>You may reapply for recruitment type change in the future once you meet all requirements.</p>
        <p>If you have any questions, please contact our support team.</p>
        <p>— PESO SmartHire Admin</p>
        """

        msg = Message(subject=subject, recipients=[
                      employer["email"]], html=body)
        mail.send(msg)

        cursor.close()
        conn.close()

        return jsonify({"success": True, "message": "Recruitment type change rejected successfully! Old documents restored."})

    except Exception as e:
        print(f"[v0] Error rejecting recruitment type change: {e}")
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        return jsonify({"success": False, "message": str(e)}), 500