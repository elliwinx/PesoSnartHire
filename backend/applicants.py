import os
import secrets
from apscheduler.schedulers.background import BackgroundScheduler
from dateutil.relativedelta import relativedelta
from flask import request
from .recaptcha import verify_recaptcha
from .notifications import create_notification, get_notifications, mark_notification_read
from flask_mail import Message
from extensions import mail
from db_connection import create_connection, run_query
from werkzeug.utils import secure_filename
from datetime import datetime, date, timedelta
from flask import Blueprint, render_template, request, redirect, url_for, session, flash, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
import magic


def ensure_job_report_details_column(cursor):
    """Ensure job_reports.details column exists before inserts."""
    cursor.execute("SHOW COLUMNS FROM job_reports LIKE 'details'")
    if not cursor.fetchone():
        cursor.execute(
            "ALTER TABLE job_reports ADD COLUMN details TEXT NULL AFTER reason")


def ensure_applicant_suspension_column(conn):
    cursor = conn.cursor()
    cursor.execute("SHOW COLUMNS FROM applicants LIKE 'suspension_end_at'")
    exists = cursor.fetchone()
    if not exists:
        cursor.execute(
            "ALTER TABLE applicants ADD COLUMN suspension_end_at DATETIME NULL AFTER updated_at")
        conn.commit()
    cursor.close()


def release_expired_suspensions(conn):
    ensure_applicant_suspension_column(conn)
    cursor = conn.cursor(dictionary=True)
    cursor.execute("""
        SELECT applicant_id, email, first_name, last_name
        FROM applicants
        WHERE suspension_end_at IS NOT NULL
          AND status = 'Suspended'
          AND suspension_end_at <= NOW()
    """)
    rows = cursor.fetchall() or []
    for row in rows:
        cursor.execute(
            "UPDATE applicants SET status = %s, is_active = 1, suspension_end_at = NULL, updated_at = NOW() WHERE applicant_id = %s",
            ("Active", row["applicant_id"])
        )
        create_notification(
            notification_type="applicant_reported",
            title="Account restored",
            message="Your suspension period has ended. You can now access your account.",
            applicant_id=row["applicant_id"]
        )
        try:
            msg = Message(
                subject="Account restored",
                recipients=[row.get("email")],
                html=f"<p>Hi {row.get('first_name', 'Applicant')},</p><p>Your suspension period has ended. You may now continue using PESO SmartHire.</p>"
            )
            mail.send(msg)
        except Exception as exc:
            print(f"[v1] Failed to send suspension end email: {exc}")
    conn.commit()
    cursor.close()


applicants_bp = Blueprint("applicants", __name__)

DOCUMENT_VALIDITY_MONTHS = 12  # 1 year


# Normalize datetime/date values
def to_date(value):
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return None


def is_document_expired(expiry_date):
    expiry = to_date(expiry_date)
    if not expiry:
        return False

    today = datetime.now().date()
    return today > expiry


def will_expire_in_7_days(expiry_date):
    expiry = to_date(expiry_date)
    if not expiry:
        return False

    today = datetime.now().date()
    days_left = (expiry - today).days

    return 1 <= days_left <= 7


def check_expired_recommendations():
    conn = create_connection()
    if not conn:
        print("[v0] DB connection failed")
        return

    try:
        # --- 0. Reset warning flags daily for non-expired docs ---
        run_query(
            conn,
            "UPDATE applicants SET recommendation_warning_sent = 0 WHERE recommendation_letter_expiry > NOW()"
        )
        conn.commit()

        # Fetch all applicants with a recommendation letter expiry
        applicants = run_query(
            conn,
            """
            SELECT applicant_id, first_name, last_name, email, recommendation_letter_expiry, status,
                   recommendation_warning_sent, recommendation_warning_date
            FROM applicants
            WHERE recommendation_letter_expiry IS NOT NULL
            """,
            fetch="all"
        )

        today = datetime.now().date()

        for applicant in applicants:
            expiry_date = to_date(applicant["recommendation_letter_expiry"])
            last_warning_date = applicant.get("recommendation_warning_date")
            if last_warning_date:
                last_warning_date = to_date(last_warning_date)

            # --- 1. Send pre-expiry warning (7 days before) ---
            if will_expire_in_7_days(expiry_date) and applicant.get("recommendation_warning_sent") != 1:
                # Only send once per day
                if last_warning_date != today:
                    warning_subject = "Your Recommendation Letter Will Expire Soon"
                    warning_body = f"""
                    <p>Hi {applicant['first_name']},</p>
                    <p>This is a reminder that your recommendation letter will expire in less than 7 days.</p>
                    <p>Please prepare a new copy to avoid any interruption in your application.</p>
                    """
                    try:
                        msg = Message(subject=warning_subject,
                                      recipients=[applicant["email"]],
                                      html=warning_body)
                        mail.send(msg)

                        # Mark as warning sent
                        run_query(
                            conn,
                            """
                            UPDATE applicants
                            SET recommendation_warning_sent = 1,
                                recommendation_warning_date = %s
                            WHERE applicant_id = %s
                            """,
                            (today, applicant["applicant_id"])
                        )
                        conn.commit()

                        print(f"Warning email sent to {applicant['email']}")
                    except Exception as e:
                        print(
                            f"Failed to send warning email to {applicant['email']}: {e}")

            # --- 2. Send expired email ---
            if is_document_expired(expiry_date):
                if applicant.get("status") != "Reupload":
                    # Update status and deactivate
                    run_query(
                        conn,
                        "UPDATE applicants SET status=%s, is_active=%s WHERE applicant_id=%s",
                        ("Reupload", 0, applicant["applicant_id"])
                    )
                    conn.commit()

                    # Email for expired document
                    subject = "Recommendation Letter Expired - Action Required"
                    body = f"""
                    <p>Hi {applicant['first_name']},</p>
                    <p>Your recommendation letter has expired. Please upload a new recommendation letter to continue your application.</p>
                    """
                    try:
                        msg = Message(subject=subject,
                                      recipients=[applicant["email"]],
                                      html=body)
                        mail.send(msg)
                        print(f"Expired email sent to {applicant['email']}")
                    except Exception as e:
                        print(
                            f"Failed to send expired email to {applicant['email']}: {e}")

        release_expired_suspensions(conn)

    except Exception as e:
        print(f"[v0] Error checking expired recommendations: {e}")
    finally:
        conn.close()


UPLOAD_FOLDER = "static/uploads"


# ==== APPLICANT REGISTRATION ====
def save_file(file, subfolder):
    # Read first 2048 bytes to check file type
    header = file.read(2048)
    file.seek(0)  # Reset cursor
    mime = magic.from_buffer(header, mime=True)

    if mime != 'application/pdf':
        raise ValueError("Invalid file type. Only real PDFs allowed.")

    if not file:
        return None
    folder_path = os.path.join(UPLOAD_FOLDER, subfolder)
    os.makedirs(folder_path, exist_ok=True)
    filename = secure_filename(file.filename)
    file_path = os.path.join(folder_path, filename)
    file.save(file_path)
    # Return relative path for URL
    return os.path.join("uploads", subfolder, filename).replace("\\", "/")


def register_applicant(form, files):
    print("[v0] Starting applicant registration...")
    conn = create_connection()
    if not conn:
        print("[v0] Database connection failed")
        return False, "DB connection failed"

    try:
        email = form.get("applicantEmailAddress")
        phone = form.get("applicantPhoneNumber")

        # ==== Check if applicant already exists ====
        existing = run_query(conn,
                             "SELECT applicant_id FROM applicants WHERE (first_name=%s AND last_name=%s AND age=%s) OR email=%s",
                             (form.get("applicantFirstName"), form.get(
                                 "applicantLastName"), form.get("applicantAge"), email),
                             fetch="all"
                             )
        if existing:
            print(f"[v0] Applicant already exists: {email}")
            return False, "You are already registered. Please log in or contact admin."

        # ==== Determine applicant type ====
        province = form.get("applicantProvince", "").strip()
        city = form.get("applicantCity", "").strip()
        barangay = form.get("applicantBarangay", "").strip()

        is_from_lipa = (province == "Batangas" and city == "City of Lipa")

        is_pwd = int(form.get("pwd") == "on")
        has_work_exp = int(form.get("workExperience") == "on")
        accepted_terms = int(session.get("accepted_terms", 0))
        accepted_terms_at = session.get("accepted_terms_at", None)

        print(f"[v0] Applicant is from Lipa: {is_from_lipa}")

        # ==== Save uploaded files ====
        profile_path = save_file(
            files.get("applicantProfilePic"), "profile_pics")
        resume_path = save_file(files.get("applicantResume"), "resumes")
        recommendation_path = None
        recommendation_expiry = None
        if not is_from_lipa:
            recommendation_path = save_file(
                files.get("applicantRecommendationLetter"), "recommendations"
            )

            recommendation_uploaded_at = datetime.now() if recommendation_path else None
            recommendation_expiry = (
                recommendation_uploaded_at +
                relativedelta(months=DOCUMENT_VALIDITY_MONTHS)
                if recommendation_uploaded_at else None
            )
        else:
            recommendation_path = None
            recommendation_uploaded_at = None
            recommendation_expiry = None

        city = form.get("applicantCity")
        barangay = form.get("applicantBarangay")

        pwd_type = form.get("applicantIsPWD") if is_pwd else None
        years_exp = form.get("applicantHasWorkExp") if has_work_exp else None

        # ==== Set status (Active - Lipeno) (Pending - Nonlipeno)====
        status = "Approved" if is_from_lipa else "Pending"

        temp_password_plain = secrets.token_urlsafe(8)
        password_hash = generate_password_hash(temp_password_plain)

        # ==== Insert applicant into DB ====
        query = """
        INSERT INTO applicants (
            last_name, first_name, middle_name, age, sex,
            phone, email, is_from_lipa, province, city, barangay, education,
            is_pwd, pwd_type, has_work_exp, years_experience, registration_reason,
            profile_pic_path, resume_path, recommendation_letter_path, recommendation_letter_uploaded_at, recommendation_letter_expiry, recommendation_warning_sent,
            accepted_terms, accepted_terms_at, status, is_active,
            password_hash, temp_password, must_change_password
        ) VALUES (
            %(last_name)s, %(first_name)s, %(middle_name)s, %(age)s, %(sex)s,
            %(phone)s, %(email)s, %(is_from_lipa)s, %(province)s, %(city)s, %(barangay)s, %(education)s,
            %(is_pwd)s, %(pwd_type)s, %(has_work_exp)s, %(years_experience)s, %(registration_reason)s,
            %(profile_pic_path)s, %(resume_path)s, %(recommendation_letter_path)s, %(recommendation_letter_uploaded_at)s, %(recommendation_letter_expiry)s, %(recommendation_warning_sent)s,
            %(accepted_terms)s, %(accepted_terms_at)s, %(status)s, %(is_active)s,
            %(password_hash)s, %(temp_password)s, %(must_change_password)s
        )
        """
        data = {
            "last_name": form.get("applicantLastName"),
            "first_name": form.get("applicantFirstName"),
            "middle_name": form.get("applicantMiddleName"),
            "age": int(form.get("applicantAge")),
            "sex": form.get("applicantSex"),
            "phone": phone,
            "email": email,
            "is_from_lipa": is_from_lipa,
            "province": province,
            "city": city,
            "barangay": barangay,
            "education": form.get("applicantEducationalAttainment"),
            "is_pwd": is_pwd,
            "pwd_type": pwd_type,
            "has_work_exp": has_work_exp,
            "years_experience": years_exp,
            "registration_reason": form.get("applicantReason"),
            "profile_pic_path": profile_path,
            "resume_path": resume_path,
            "recommendation_letter_path": recommendation_path,
            "recommendation_letter_uploaded_at": recommendation_uploaded_at,
            "recommendation_letter_expiry": recommendation_expiry,
            "recommendation_warning_sent": 0,
            "accepted_terms": accepted_terms,
            "accepted_terms_at": accepted_terms_at,
            "status": status,
            "is_active": 1 if is_from_lipa else 0,
            "password_hash": password_hash,
            "temp_password": temp_password_plain,
            "must_change_password": 1
        }

        print("Inserting applicant into database...")
        run_query(conn, query, data)
        conn.commit()
        print("Applicant inserted and committed successfully")

        applicant_id_row = run_query(
            conn,
            "SELECT LAST_INSERT_ID() as id",
            fetch="one"
        )
        applicant_id = applicant_id_row["id"] if applicant_id_row else None
        print(f"[v0] Applicant ID: {applicant_id}")

        applicant_code = "N/A"
        if applicant_id:
            applicant_code_row = run_query(
                conn,
                "SELECT applicant_code FROM applicants WHERE applicant_id=%s",
                (applicant_id,),
                fetch="one"
            )
            applicant_code = applicant_code_row["applicant_code"] if applicant_code_row and applicant_code_row.get(
                "applicant_code") else "N/A"
            print(f"[v0] Applicant Code: {applicant_code}")

        if is_from_lipa:
            print("Creating notification for Lipeno applicant (auto-approved)...")
            create_notification(
                notification_type="applicant_approval",
                title="New Lipeno Applicant Registered",
                message="1 Lipeno applicant has been auto-approved",
                count=1,
                related_ids=[applicant_id] if applicant_id else None,
                residency_type="Lipeno",
                applicant_id=applicant_id   # <-- NEW explicit FK
            )
            print("Notification created for Lipeno applicant")
        else:
            print("Creating notification for Non-Lipeno applicant (pending approval)...")
            create_notification(
                notification_type="applicant_approval",
                title="Non-Lipeno Applicant Account Pending Approval",
                message="1 non-Lipeno applicant registration needs approval",
                count=1,
                related_ids=[applicant_id] if applicant_id else None,
                residency_type="Non-Lipeno",
                applicant_id=applicant_id   # <-- NEW explicit FK
            )
            print("Notification created for Non-Lipeno applicant")

        # ==== Send Email ====
        try:
            if is_from_lipa:
                subject = "PESO SmartHire - Registration Successful"
                body = f"""
                <p>Hi {form.get('applicantFirstName')},</p>
                <p>This is PESO SmartHire Team.</p>
                <p>Congratulations! Your registration is approved!</p>
                <p>Included below is your login credentials:</p>
                <ul>
                    <li>Applicant ID: {applicant_code}</li>
                    <li>Email: {email}</li>
                    <li>Phone Number: {phone}</li>
                    <li>Password: {temp_password_plain}</li>
                </ul>
                <p><strong>Please change your password after logging in.</strong></p>
                <p>Thank you for joining our PESO SmartHire Platform.</p>
                """
            else:
                subject = "PESO SmartHire - Registration Submitted"
                body = f"""
                <p>Hi {form.get('applicantFirstName')},</p>
                <p>This is PESO SmartHire Team.</p>
                <p>Your registration is submitted and pending admin approval.</p>
                <p>After approval, you will receive your login credentials.</p>
                <p>Thank you for joining our PESO SmartHire Platform.</p>
                """
            msg = Message(subject=subject, recipients=[email], html=body)
            mail.send(msg)
            print(f"Email sent successfully to {email}")
        except Exception as e:
            print(f"Failed to send email: {e}")

        success_message = (
            "Registration successful! Login credentials have been sent to your email."
            if is_from_lipa else
            "Registration submitted! Please wait for admin approval."
        )
        print(f"Registration completed successfully for {email}")
        return True, success_message

    except Exception as e:
        print(f"[v0] Error during registration: {e}")
        conn.rollback()
        return False, f"Registration failed: {str(e)}"
    finally:
        conn.close()


# ==== APPLICANT LOG IN ====
@applicants_bp.route("/login", methods=["POST"])
def login():
    email = request.form.get("applicantEmail")
    applicant_id = request.form.get("applicantID")
    phone = request.form.get("applicantPhoneNumber")
    password = request.form.get("applicantPassword")

    recaptcha_token = request.form.get("g-recaptcha-response")
    if not recaptcha_token:
        flash("Please complete the reCAPTCHA verification.", "danger")
        session['login_error'] = True
        return redirect(url_for("home"))

    recaptcha_result = verify_recaptcha(recaptcha_token, request.remote_addr)
    if not recaptcha_result.get("success"):
        print("[v0] reCAPTCHA failed:", recaptcha_result)
        flash("reCAPTCHA verification failed. Please confirm you're not a robot.", "danger")
        session['login_error'] = True
        return redirect(url_for("home"))

    conn = create_connection()
    if not conn:
        flash("DB connection failed.", "danger")
        session['login_error'] = True
        return redirect(url_for("home"))

    query = """
    SELECT * FROM applicants
    WHERE email=%s AND applicant_code=%s AND phone=%s
    """
    result = run_query(conn, query, (email, applicant_id, phone), fetch="one")

    if not result:
        flash("Invalid login credentials. Please check your Applicant ID, email, and phone number.", "danger")
        session['login_error'] = True
        conn.close()
        return redirect(url_for("home"))

    applicant = result

    if applicant["status"] not in ["Approved", "Reupload"]:
        flash("Your account is pending approval. Please wait for admin confirmation.", "warning")
        session['login_error'] = True
        conn.close()
        return redirect(url_for("home"))

    if not check_password_hash(applicant["password_hash"], password):
        flash("Incorrect password. Please try again.", "danger")
        session['login_error'] = True
        conn.close()
        return redirect(url_for("home"))

    session["applicant_id"] = applicant["applicant_id"]
    session["applicant_name"] = applicant["first_name"]
    session["applicant_email"] = applicant["email"]
    session["applicant_status"] = applicant["status"]

    # Force password change only for "Approved" status with must_change_password = 1
    if applicant["status"] == "Approved" and applicant.get("must_change_password") == 1:
        session["must_change_password"] = True
        flash("You must change your password before accessing your account.", "warning")
        conn.close()
        return redirect(url_for("applicants.forced_password_change"))

    session["must_change_password"] = False
    conn.close()
    flash(f"Welcome back, {applicant['first_name']}!", "success")
    return redirect(url_for("applicants.applicant_home"))


@applicants_bp.route("/change-password-required", methods=["GET", "POST"], endpoint="forced_password_change")
def forced_password_change():
    """Force user to change password on first login after approval"""
    if "applicant_id" not in session:
        flash("Please log in first.", "warning")
        return redirect(url_for("home"))

    if request.method == "GET":
        # Prevent visiting the page directly
        return redirect(url_for("applicants.applicant_home"))

    # POST logic starts here
    applicant_id = session["applicant_id"]
    new_password = request.form.get("newPassword")
    confirm_password = request.form.get("confirmPassword")

    if not new_password or not confirm_password:
        flash("Please fill in all password fields.", "danger")
        return redirect(url_for("applicants.applicant_home"))

    if new_password != confirm_password:
        flash("Passwords do not match.", "danger")
        return redirect(url_for("applicants.applicant_home"))

    if len(new_password) < 8:
        flash("Password must be at least 8 characters long.", "danger")
        return redirect(url_for("applicants.applicant_home"))

    conn = create_connection()
    if not conn:
        flash("Database connection failed.", "danger")
        return redirect(url_for("applicants.applicant_home"))

    try:
        hashed_password = generate_password_hash(new_password)
        run_query(
            conn,
            """UPDATE applicants
               SET password_hash = %s, must_change_password = 0
               WHERE applicant_id = %s""",
            (hashed_password, applicant_id)
        )
        conn.commit()
        conn.close()

        session["must_change_password"] = False

        flash("Password changed successfully! You can now access your account.", "success")
        return redirect(url_for("applicants.applicant_home"))

    except Exception as e:
        conn.rollback()
        conn.close()
        flash(f"Error updating password: {e}", "danger")
        return redirect(url_for("applicants.applicant_home"))


# ===== Applicant Navigation Pages =====
@applicants_bp.route("/applicant_home")
def applicant_home():
    if "applicant_id" not in session:
        flash("Please log in to access this page.", "warning")
        return redirect(url_for("home"))

    if session.get("applicant_status") == "Reupload":
        flash("Please complete your document reupload first.", "info")
        return redirect(url_for("applicants.account_security"))

    # 🔹 Fetch active jobs
    conn = create_connection()
    if not conn:
        flash("Database connection failed.", "danger")
        return redirect(url_for("home"))

    try:
        applicant_id = session["applicant_id"]

        jobs = run_query(
            conn,
            """
            SELECT
                jobs.job_id,
                jobs.job_position,
                employers.employer_name AS company_name,
                jobs.work_schedule,
                jobs.num_vacancy,
                jobs.min_salary,
                jobs.max_salary,
                jobs.job_description,
                jobs.qualifications,
                jobs.created_at,
                employers.employer_name AS company_name,
                employers.company_logo_path,
                employers.industry AS industry,
                employers.recruitment_type AS type_of_recruitment,
                employers.city AS location,
                (SELECT COUNT(*) FROM applicant_blacklist 
                WHERE applicant_id = %s 
                AND employer_id = employers.employer_id
                AND (expires_at IS NULL OR expires_at > NOW())
                ) as is_blacklisted,
                (SELECT COUNT(*) FROM applications
                 WHERE applications.job_id = jobs.job_id
                 AND applications.applicant_id = %s
                 AND TRIM(applications.status) != 'Cancelled' 
                ) as has_applied
            FROM jobs
            LEFT JOIN employers ON jobs.employer_id = employers.employer_id
            WHERE jobs.status = 'active'
            ORDER BY jobs.created_at DESC
            """,
            (applicant_id, applicant_id),
            fetch="all"
        )

    except Exception as e:
        flash(f"Failed to fetch jobs: {e}", "danger")
        jobs = []
    finally:
        conn.close()

    return render_template("Applicant/applicant_home.html", jobs=jobs)


@applicants_bp.route('/apply/<int:job_id>', methods=['POST'])
def apply_job(job_id):
    if "applicant_id" not in session:
        return jsonify({"success": False, "message": "You must login first."}), 401

    conn = create_connection()
    if not conn:
        return jsonify({"success": False, "message": "Database connection failed."}), 500

    try:
        applicant_id = session["applicant_id"]

        # ✅ NEW: Check if applicant is blacklisted from this employer
        job_details = run_query(
            conn,
            """SELECT j.job_position, j.employer_id, e.employer_name 
               FROM jobs j 
               JOIN employers e ON j.employer_id = e.employer_id 
               WHERE j.job_id = %s""",
            (job_id,),
            fetch="one"
        )

        if not job_details:
            return jsonify({"success": False, "message": "Job not found."}), 404

        employer_id = job_details["employer_id"]
        employer_name = job_details["employer_name"]

        # Check blacklist status
        is_blacklisted = run_query(
            conn,
            """SELECT COUNT(*) as blacklisted 
               FROM applicant_blacklist 
               WHERE applicant_id = %s AND employer_id = %s 
               AND (expires_at IS NULL OR expires_at > NOW())""",
            (applicant_id, employer_id),
            fetch="one"
        )

        if is_blacklisted and is_blacklisted["blacklisted"] > 0:
            return jsonify({
                "success": False,
                "message": f"You are restricted from applying to {employer_name} due to a previous report."
            }), 403

        # 1. CHECK STATUS (Don't just check existence)
        existing_app = run_query(
            conn,
            "SELECT id, status FROM applications WHERE job_id=%s AND applicant_id=%s",
            (job_id, applicant_id),
            fetch="one"
        )

        is_reactivation = False

        if existing_app:
            # If application exists AND is active (not Cancelled), block them
            if existing_app['status'] != 'Cancelled':
                return jsonify({"success": False, "message": "You have already applied to this job."}), 400

            # If it IS Cancelled, we will Reactivate it instead of inserting new
            is_reactivation = True
            application_id = existing_app['id']

        applicant_details = run_query(
            conn,
            "SELECT first_name, last_name FROM applicants WHERE applicant_id = %s",
            (applicant_id,),
            fetch="one"
        )

        # 2. PERFORM INSERT OR UPDATE
        if is_reactivation:
            # A. REACTIVATE: Update the old 'Cancelled' row back to 'Pending'
            run_query(
                conn,
                "UPDATE applications SET status = 'Pending', applied_at = NOW() WHERE id = %s",
                (application_id,)
            )

            # Add History Log for Reactivation
            run_query(
                conn,
                """INSERT INTO applications_history 
                   (application_id, old_status, new_status, changed_by, changed_at, note) 
                   VALUES (%s, 'Cancelled', 'Pending', %s, NOW(), 'Applicant re-applied')""",
                (application_id, applicant_id)
            )
        else:
            # B. NEW APPLICATION: Insert fresh row
            run_query(
                conn,
                "INSERT INTO applications (job_id, applicant_id, applied_at, status) VALUES (%s, %s, NOW(), 'Pending')",
                (job_id, applicant_id)
            )

        # 3. NOTIFICATIONS & COUNTS (Same logic for both)
        if job_details and applicant_details:
            job_position = job_details["job_position"]
            applicant_name = f"{applicant_details['first_name']} {applicant_details['last_name']}"

            # Send Notification
            try:
                create_notification(
                    notification_type='job_application',
                    title=f"New Application for {job_position}",
                    message=f"{applicant_name} has applied (or re-applied) to your job posting",
                    count=1,
                    related_ids=[job_id],
                    employer_id=employer_id
                )
            except Exception as notif_error:
                print(f"[v0] Error creating notification: {notif_error}")

            # Increment Employer Count
            try:
                run_query(
                    conn, "UPDATE employers SET application_count = application_count + 1 WHERE employer_id = %s", (employer_id,))
            except Exception:
                pass  # Ignore if column missing

            # Increment Job Count
            try:
                run_query(
                    conn, "UPDATE jobs SET application_count = application_count + 1 WHERE job_id = %s", (job_id,))
            except Exception:
                pass

        conn.commit()

        # Fetch updated count for frontend
        new_count_row = run_query(
            conn, "SELECT application_count FROM jobs WHERE job_id = %s", (job_id,), fetch="one")
        new_count = new_count_row["application_count"] if new_count_row else 0

        return jsonify({
            "success": True,
            "message": "Application submitted successfully!",
            "application_count": new_count
        })

    except Exception as e:
        conn.rollback()
        return jsonify({"success": False, "message": f"Error submitting application: {str(e)}"}), 500
    finally:
        conn.close()


@applicants_bp.route("/job/<int:job_id>")
def job_page(job_id):
    if "applicant_id" not in session:
        return "Please log in to view job details.", 401

    conn = create_connection()
    if not conn:
        return "Database connection failed.", 500

    try:
        job = run_query(
            conn,
            "SELECT j.*, e.employer_name AS company_name, e.company_logo_path "
            "FROM jobs j "
            "LEFT JOIN employers e ON j.employer_id = e.employer_id "
            "WHERE j.job_id = %s",
            (job_id,),
            fetch="one"
        )

        if not job:
            return "Job not found.", 404

        # Fetch the applicant's application ID for this job
        applicant_id = session.get("applicant_id")
        application = run_query(
            conn,
            "SELECT id FROM applications WHERE applicant_id=%s AND job_id=%s",
            (applicant_id, job_id),
            fetch="one"
        )
        application_id = application["id"] if application else None

        # Return modal HTML with both job and application_id
        return render_template(
            "Applicant/job_modal_content.html",
            job=job,
            application_id=application_id
        )

    except Exception as e:
        print(f"[job_page] Error fetching job {job_id}: {e}")
        return "An error occurred while fetching job details.", 500

    finally:
        conn.close()


@applicants_bp.route("/notifications")
def notifications():
    if "applicant_id" not in session:
        flash("Please log in to access this page.", "warning")
        return redirect(url_for("home"))

    if session.get("applicant_status") == "Reupload":
        flash("Please complete your document reupload first.", "info")
        return redirect(url_for("applicants.account_security"))

    # Fetch notifications for the current applicant and pass to template
    try:
        all_notifs = get_notifications(limit=200)
        applicant_id = session.get('applicant_id')
        notifications = []
        # Normalize types that should NOT be shown to applicants (admin-only)
        admin_only_types = {
            'employer_approval', 'applicant_approval', 'employer_reported', 'employer_outdated_docu', 'applicant_batch'
        }
        for n in (all_notifs or []):
            try:
                # First, always skip admin-only notification types regardless of FK (defensive for existing bad rows)
                if n.get('notification_type') in admin_only_types:
                    continue

                # direct FK match
                if n.get('applicant_id') == applicant_id:
                    notifications.append(n)
                    continue

                # fallback: related_ids may contain the applicant id (stored as ints or strings)
                related = n.get('related_ids') or []
                related_norm = [int(x) if isinstance(x, (int, str)) and str(
                    x).isdigit() else None for x in related]
                related_norm = [x for x in related_norm if x is not None]
                if applicant_id in related_norm:
                    notifications.append(n)
            except Exception:
                # be resilient to malformed related_ids
                continue
        notifications.sort(key=lambda x: x.get(
            'created_at') or '', reverse=True)
        notifications.sort(key=lambda x: int(x.get('is_read', 1)))
    except Exception as e:
        print('[v0] Failed to load notifications:', e)
        notifications = []

    return render_template("Applicant/notif.html", notifications=notifications)

# In applicants.py


@applicants_bp.route('/api/notifications/unread-count')
def get_unread_notif_count():
    if 'applicant_id' not in session:
        return jsonify({'success': False, 'count': 0})

    applicant_id = session['applicant_id']
    conn = create_connection()
    if not conn:
        return jsonify({'success': False, 'count': 0})

    try:
        # Count only unread notifications for this specific applicant
        # Filtering out admin-only types to be safe
        query = """
        SELECT COUNT(*) as count 
        FROM notifications 
        WHERE applicant_id = %s 
          AND is_read = 0 
          AND notification_type NOT IN ('employer_approval', 'applicant_approval', 'employer_reported', 'employer_outdated_docu', 'applicant_batch', 'job_application')
        """
        result = run_query(conn, query, (applicant_id,), fetch="one")
        count = result['count'] if result else 0

        return jsonify({'success': True, 'count': count})
    except Exception as e:
        print(f"[v0] Error fetching unread count: {e}")
        return jsonify({'success': False, 'count': 0})
    finally:
        conn.close()


@applicants_bp.route('/api/notifications/<int:notif_id>/read', methods=['POST'])
def mark_applicant_notification_read(notif_id):
    if 'applicant_id' not in session:
        return jsonify({'success': False, 'message': 'Not logged in'}), 401

    applicant_id = session['applicant_id']
    conn = create_connection()
    if not conn:
        return jsonify({'success': False, 'message': 'DB connection failed'}), 500

    try:
        # 1. Verify ownership
        row = run_query(
            conn,
            'SELECT applicant_id FROM notifications WHERE notification_id = %s',
            (notif_id,),
            fetch='one'
        )

        if not row:
            conn.close()
            return jsonify({'success': False, 'message': 'Notification not found'}), 404

        # Check if notification belongs to this applicant
        if row.get('applicant_id') and row.get('applicant_id') != applicant_id:
            conn.close()
            return jsonify({'success': False, 'message': 'Unauthorized'}), 403

        # 2. Update status directly (Reuse connection)
        run_query(
            conn, "UPDATE notifications SET is_read = 1 WHERE notification_id = %s", (notif_id,))
        conn.commit()
        conn.close()

        return jsonify({'success': True})

    except Exception as e:
        # Ensure connection is closed on error
        if conn and conn.is_connected():
            conn.close()
        print(f'[v0] Error marking notification read: {e}')
        return jsonify({'success': False, 'message': str(e)}), 500


@applicants_bp.route('/applications')
def applications_page():
    """Render the applicant's Applications page. The page uses client-side JS to load data from /applicants/api/applications."""
    if 'applicant_id' not in session:
        flash('Please log in to access this page.', 'warning')
        return redirect(url_for('home'))

    if session.get('applicant_status') == 'Reupload':
        flash('Please complete your document reupload first.', 'info')
        return redirect(url_for('applicants.account_security'))

    # Render the template; JS will call /applicants/api/applications to populate the list
    return render_template('Applicant/application.html')


@applicants_bp.route('/api/applications')
def api_applications():
    """Return JSON list of applications for the logged-in applicant."""
    if 'applicant_id' not in session:
        return jsonify({'success': False, 'message': 'Not logged in'}), 401

    applicant_id = session['applicant_id']
    conn = create_connection()
    if not conn:
        return jsonify({'success': False, 'message': 'DB connection failed'}), 500

    try:
        # Get filter from query params (default to 'all')
        filter_status = request.args.get('filter', 'all').lower()

        rows = run_query(
            conn,
            """
            SELECT
                a.id,
                a.job_id,
                j.job_position,
                e.employer_name,
                e.city,
                a.applied_at,
                COALESCE(a.status, 'Pending') AS status
            FROM applications a
            LEFT JOIN jobs j ON a.job_id = j.job_id
            LEFT JOIN employers e ON j.employer_id = e.employer_id
            WHERE a.applicant_id = %s
            ORDER BY a.applied_at DESC
            """,
            (applicant_id,),
            fetch='all'
        ) or []

        apps = []
        for r in rows:
            d = r.get('applied_at')
            if hasattr(d, 'isoformat'):
                date_str = d.isoformat()
            else:
                date_str = str(d) if d is not None else None

            app_data = {
                'id': r.get('id'),
                'job_position': r.get('job_position') or 'N/A',
                'employer_name': r.get('employer_name') or 'N/A',
                'location': r.get('city') or '',
                'applied_at': date_str,
                'status': r.get('status') or 'Pending'
            }

            # Apply filter
            if filter_status == 'all' or filter_status == '':
                apps.append(app_data)
            elif app_data['status'].lower().replace(' ', '-') == filter_status:
                apps.append(app_data)

        return jsonify({'applications': apps, 'success': True})
    except Exception as e:
        print('[v0] Error fetching applications:', e)
        return jsonify({'success': False, 'message': 'Failed to load applications'}), 500
    finally:
        conn.close()


@applicants_bp.route('/api/applications/<int:application_id>')
def api_get_application_details(application_id):
    """Return full details for a single application including job info."""
    if 'applicant_id' not in session:
        return jsonify({'success': False, 'message': 'Not logged in'}), 401

    applicant_id = session['applicant_id']
    conn = create_connection()
    if not conn:
        return jsonify({'success': False, 'message': 'DB connection failed'}), 500

    try:
        # Get application details with full job and employer info
        row = run_query(
            conn,
            """
            SELECT
                a.id,
                a.job_id,
                a.applied_at,
                COALESCE(a.status, 'Pending') AS status,
                j.job_position,
                j.job_description,
                j.qualifications,
                j.work_schedule,
                j.min_salary,
                j.max_salary,
                j.num_vacancy,
                e.employer_name,
                e.city,
                e.company_logo_path
            FROM applications a
            LEFT JOIN jobs j ON a.job_id = j.job_id
            LEFT JOIN employers e ON j.employer_id = e.employer_id
            WHERE a.id = %s AND a.applicant_id = %s
            """,
            (application_id, applicant_id),
            fetch='one'
        )

        if not row:
            print('[v0] Application not found')
            return jsonify({'success': False, 'message': 'Application not found'}), 404

        # Format salary range
        min_salary = row.get('min_salary', 0)
        max_salary = row.get('max_salary', 0)
        salary_range = f"₱{min_salary:,.0f} - ₱{max_salary:,.0f}" if min_salary and max_salary else "Not specified"

        # Format applied_at date
        applied_at = row.get('applied_at')
        if hasattr(applied_at, 'isoformat'):
            applied_date_str = applied_at.isoformat()
        else:
            applied_date_str = str(applied_at) if applied_at else None

        application = {
            'id': row.get('id'),
            'job_position': row.get('job_position') or 'N/A',
            'employer_name': row.get('employer_name') or 'N/A',
            'location': row.get('city') or 'Not specified',
            'job_description': row.get('job_description') or 'No description available.',
            'qualifications': row.get('qualifications') or 'Not specified',
            'work_schedule': row.get('work_schedule', 'Not specified').replace('-', ' ').title(),
            'salary_range': salary_range,
            'num_vacancy': row.get('num_vacancy', 0),
            'applied_at': applied_date_str,
            'status': row.get('status') or 'Pending'
        }

        return jsonify({'success': True, 'application': application})

    except Exception as e:
        print(f'[v0] Error fetching application details: {e}')
        return jsonify({'success': False, 'message': f'Error loading details: {str(e)}'}), 500
    finally:
        conn.close()


@applicants_bp.route('/api/delete-application/<int:app_id>', methods=['DELETE'])
def delete_application(app_id):
    """
    DELETE endpoint for cancelling applications
    Updated to use correct database schema with applications_history table
    AND notify the employer.
    """
    if 'applicant_id' not in session:
        return jsonify({'success': False, 'message': 'Not logged in'}), 401

    applicant_id = session['applicant_id']
    conn = create_connection()
    if not conn:
        return jsonify({'success': False, 'message': 'DB connection failed'}), 500

    try:
        # 1. UPDATED QUERY: We join 'jobs' and 'applicants' to get details for the notification
        app = run_query(
            conn,
            '''
            SELECT 
                a.id, a.status, a.job_id, 
                j.employer_id, j.job_position,
                ap.first_name, ap.last_name
            FROM applications a
            JOIN jobs j ON a.job_id = j.job_id
            JOIN applicants ap ON a.applicant_id = ap.applicant_id
            WHERE a.id = %s AND a.applicant_id = %s
            ''',
            (app_id, applicant_id),
            fetch='one'
        )

        if not app:
            conn.close()
            return jsonify({'success': False, 'message': 'Application not found or unauthorized'}), 404

        job_id = app.get('job_id')
        old_status = app.get('status', 'Pending')
        employer_id = app.get('employer_id')  # Needed for notification

        # Update status
        run_query(
            conn,
            'UPDATE applications SET status = %s WHERE id = %s',
            ('Cancelled', app_id)
        )

        # Insert history
        run_query(
            conn,
            '''
            INSERT INTO applications_history (application_id, old_status, new_status, changed_by, changed_at, note)
            VALUES (%s, %s, %s, %s, NOW(), %s)
            ''',
            (app_id, old_status, 'Cancelled', applicant_id,
             'Applicant cancelled their application')
        )

        # Decrement count
        run_query(
            conn,
            'UPDATE jobs SET application_count = CASE WHEN application_count > 0 THEN application_count - 1 ELSE 0 END WHERE job_id = %s',
            (job_id,)
        )

        # 2. INSERT NOTIFICATION HERE
        try:
            # Create notification for the employer
            # We use 'job_application' type so it appears in their main filter
            applicant_name = f"{app['first_name']} {app['last_name']}"
            job_title = app['job_position']

            create_notification(
                notification_type='job_application',
                title=f"Application Cancelled - {job_title}",
                message=f"{applicant_name} has cancelled their application for {job_title}.",
                count=1,
                related_ids=[job_id],
                employer_id=employer_id
            )
            print(f"[v0] Notification created for employer {employer_id}")
        except Exception as notif_error:
            # Don't fail the cancellation if notification fails
            print(
                f"[v0] Error sending cancellation notification: {notif_error}")

        conn.commit()
        print(
            f"[v0] Application {app_id} cancelled successfully by applicant {applicant_id}")

        return jsonify({
            'success': True,
            'message': 'Application cancelled successfully',
            'applicationId': app_id
        })

    except Exception as e:
        conn.rollback()
        print(f"[v0] Error cancelling application {app_id}: {str(e)}")
        return jsonify({'success': False, 'message': 'Failed to cancel application', 'error': str(e)}), 500
    finally:
        conn.close()


@applicants_bp.route('/api/cancel-application/<int:app_id>', methods=['POST'])
def api_cancel_application(app_id):
    """Legacy POST endpoint - delegates to DELETE logic for backwards compatibility"""
    return delete_application(app_id)


@applicants_bp.route("/submit-reupload", methods=["POST"])
def submit_reupload():
    if "applicant_id" not in session:
        return jsonify({"success": False, "message": "Not authenticated"}), 401

    applicant_id = session["applicant_id"]
    file = request.files.get("recommendation_file")

    if not file:
        return jsonify({"success": False, "message": "No file provided"}), 400

    conn = create_connection()
    if not conn:
        return jsonify({"success": False, "message": "DB connection failed"}), 500

    try:
        # Fetch applicant data (for residency_type and old file cleanup)
        applicant_data = run_query(
            conn,
            "SELECT recommendation_letter_path, is_from_lipa FROM applicants WHERE applicant_id = %s",
            (applicant_id,),
            fetch="one"
        )

        # Delete old file if exists
        if applicant_data and applicant_data["recommendation_letter_path"]:
            old_path = os.path.join(
                "static", applicant_data["recommendation_letter_path"])
            if os.path.exists(old_path):
                os.remove(old_path)
                print(f"Old file removed: {old_path}")

        # Save new file
        new_path = save_file(file, "recommendations")

        # Calculate new expiry date (1 year from upload)
        upload_date = datetime.now()
        recommendation_expiry = upload_date + \
            relativedelta(months=DOCUMENT_VALIDITY_MONTHS)

        # Determine residency type
        residency_type = "Lipeno" if applicant_data and applicant_data.get(
            "is_from_lipa") else "Non-Lipeno"

        # Update applicant record
        run_query(
            conn,
            """
            UPDATE applicants
            SET recommendation_letter_path = %s, recommendation_letter_expiry = %s, recommendation_letter_uploaded_at = %s, recommendation_warning_sent = %s, status = 'Pending', is_active = 0
            WHERE applicant_id = %s
            """,
            (new_path, recommendation_expiry, upload_date, 0, applicant_id)
        )
        conn.commit()

        update_query = """
        UPDATE notifications
        SET title = %s, message = %s, is_read = 0, updated_at = NOW()
        WHERE applicant_id = %s AND notification_type = 'applicant_approval'
        """
        params = (
            "Applicant Document Reuploaded",
            "An applicant has reuploaded their required document and is ready for reassessment.",
            applicant_id
        )
        run_query(conn, update_query, params)
        conn.commit()
        conn.close()

        flash("Document reuploaded successfully! Please wait for admin review.", "success")
        return redirect(url_for("home"))

    except Exception as e:
        print(f"[submit_reupload] Error: {e}")
        conn.rollback()
        return jsonify({"success": False, "message": str(e)}), 500

    finally:
        conn.close()


@applicants_bp.route("/terms", methods=["GET", "POST"])
def applicants_terms():
    if request.method == "POST":
        if not request.form.get("accepted_terms"):
            flash("You must accept the Terms and Conditions to proceed.", "error")
            return redirect(url_for("applicants.applicants_terms"))

        session["accepted_terms"] = True
        session["accepted_terms_at"] = datetime.utcnow().isoformat()
        session["accepted_terms_for"] = "applicant"

        return redirect(url_for("applicants.register"))

    return render_template("Landing_Page/t_and_c_applicants.html")


@applicants_bp.route('/register', methods=['GET', 'POST'])
def register():
    """Render and process applicant registration form."""
    if request.method == 'POST':
        print(f"[v0] Applicant registration form submitted")

        result = register_applicant(request.form, request.files)
        if result is None:
            success, message = False, "Registration failed unexpectedly."
        else:
            success, message = result

        flash(message, "success" if success else "danger")

        if success:
            return redirect(url_for('home'))
        else:
            return redirect(url_for('applicants.register'))

    return render_template('Landing_Page/applicant_registration.html')


@applicants_bp.route("/reactivate", methods=["POST"])
def reactivate_applicant_account():
    data = request.get_json()
    email = data.get("email")

    conn = create_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute(
            "SELECT * FROM deactivated_users WHERE email = %s", (email,))
        user = cursor.fetchone()

        if not user:
            return jsonify({
                "success": False,
                "message": "No deactivated account found or account already permanently deleted."
            }), 404

        cursor.execute("""
            UPDATE applicants
            SET is_active = 1, deactivated_at = NULL
            WHERE applicant_id = %s
        """, (user["id"],))

        cursor.execute(
            "DELETE FROM deactivated_users WHERE id = %s", (user["id"],))

        conn.commit()

        return jsonify({"success": True, "message": "Your account has been successfully reactivated."})

    except Exception as e:
        conn.rollback()
        return jsonify({"success": False, "message": f"Database error: {str(e)}"}), 500

    finally:
        cursor.close()
        conn.close()


# ========= ACCOUNT & SECURITY (city-based residency) =========
@applicants_bp.route("/account-security", methods=["GET", "POST"], endpoint="account_security")
def account_security():
    if "applicant_id" not in session:
        flash("Please log in to access this page.", "warning")
        return redirect(url_for("home"))

    applicant_id = session["applicant_id"]

    conn = create_connection()
    if not conn:
        flash("Database connection failed.", "danger")
        return redirect(url_for("applicants.applicant_home"))

    applicant = run_query(
        conn,
        "SELECT * FROM applicants WHERE applicant_id=%s",
        (applicant_id,),
        fetch="one",
    )
    if not applicant:
        conn.close()
        flash("Applicant not found.", "error")
        return redirect(url_for("home"))

    if request.method == "POST":
        try:
            # --- basic fields
            first_name = request.form.get("first_name", "")
            middle_name = request.form.get("middle_name", "")
            last_name = request.form.get("last_name", "")
            age = int(request.form.get("age", 0)
                      ) if request.form.get("age") else None
            sex = request.form.get("sex", "")
            phone = request.form.get("phone", "")
            email = request.form.get("email", "")
            barangay = request.form.get("barangay", "")
            city_raw = (request.form.get("city") or "").strip()
            province = request.form.get("province", "")
            education = request.form.get("education", "")

            is_pwd = int(request.form.get("is_pwd", 0))
            pwd_type = request.form.get("disability_type") if is_pwd else None
            has_work = int(request.form.get("has_work_exp", 0))
            years_exp = request.form.get("work_duration") if has_work else None
            reg_reason = request.form.get("registration_reason", "")

            # --- files
            profile_file = request.files.get("profile_pic")
            resume_file = request.files.get("resume_file")

            reco_file = None
            for f in request.files.getlist("recommendation_file"):
                if f and getattr(f, "filename", ""):
                    reco_file = f
                    break

            profile_path = applicant["profile_pic_path"]
            resume_path = applicant["resume_path"]
            reco_path = applicant["recommendation_letter_path"]

            if profile_file and profile_file.filename:
                if profile_path:
                    old = os.path.join("static", profile_path)
                    if os.path.exists(old):
                        os.remove(old)
                profile_path = save_file(profile_file, "profile_pics")

            if resume_file and resume_file.filename:
                if resume_path:
                    old = os.path.join("static", resume_path)
                    if os.path.exists(old):
                        os.remove(old)
                resume_path = save_file(resume_file, "resumes")

            is_from_lipa_new = int(request.form.get("is_from_lipa", 0))
            was_lipa = 1 if applicant["is_from_lipa"] else 0

            # Helper to check if file was uploaded
            new_reco_uploaded = (reco_file and reco_file.filename)

            status = applicant["status"]
            is_active = applicant.get("is_active", 1)

            residency_changed = (was_lipa != is_from_lipa_new)

            if residency_changed and is_from_lipa_new == 0:
                if not new_reco_uploaded:
                    conn.close()
                    flash(
                        "You are changing your residency to Non-Lipeño. Please upload your recommendation letter before saving.", "warning")
                    return redirect(url_for("applicants.account_security") + "?tab=documents&focus=reco")

            if residency_changed:
                if is_from_lipa_new == 1:
                    # Switched to Lipeno: Approve
                    if reco_path:
                        old = os.path.join("static", reco_path)
                        if os.path.exists(old):
                            os.remove(old)
                    reco_path = None
                    status = "Approved"
                    is_active = 1

                    update_query = """
                    UPDATE notifications
                    SET title = %s, message = %s, residency_type = %s, is_read = 0, updated_at = NOW()
                    WHERE applicant_id = %s AND notification_type = 'applicant_approval'
                    """
                    params = (
                        "Applicant Residency Changed to Lipeño",
                        f"Applicant #{applicant_id} ({first_name} {last_name}) changed residency to Lipeño and was auto-approved.",
                        "Lipeno",
                        applicant_id
                    )
                    run_query(conn, update_query, params)
                    flash(
                        "Your residency has been updated to Lipeño. Your account is now approved and active.", "success")

                else:
                    # Switched to Non-Lipeno: Pending
                    status = "Pending"
                    is_active = 0

                    if reco_path:
                        old = os.path.join("static", reco_path)
                        if os.path.exists(old):
                            os.remove(old)
                    reco_path = save_file(reco_file, "recommendations")

                    update_query = """
                    UPDATE notifications
                    SET title = %s, message = %s, residency_type = %s, is_read = 0, updated_at = NOW()
                    WHERE applicant_id = %s AND notification_type = 'applicant_approval'
                    """
                    params = (
                        "Applicant Residency Changed - Needs Re-verification",
                        f"Applicant {first_name} {last_name} changed residency to Non-Lipeño. Recommendation letter uploaded and awaiting approval.",
                        "Non-Lipeno",
                        applicant_id
                    )
                    run_query(conn, update_query, params)
                    flash("Your residency has been changed to Non-Lipeño. Your recommendation letter has been uploaded. Please wait for admin approval. You will be logged out.", "info")

            # === SECURITY FIX: Handle Re-upload WITHOUT Residency Change ===
            elif is_from_lipa_new == 0 and new_reco_uploaded:
                if reco_path:
                    old = os.path.join("static", reco_path)
                    if os.path.exists(old):
                        os.remove(old)
                reco_path = save_file(reco_file, "recommendations")

                # FORCE PENDING STATUS
                status = "Pending"
                is_active = 0

                # Notify Admin (regardless of previous status)
                update_query = """
                UPDATE notifications
                SET title = %s, message = %s, is_read = 0, updated_at = NOW()
                WHERE applicant_id = %s AND notification_type = 'applicant_approval'
                """
                params = (
                    "Non-Lipeño Applicant Document Updated",
                    f"Applicant #{applicant_id} ({first_name} {last_name}) has updated their recommendation letter and requires re-verification.",
                    applicant_id
                )
                run_query(conn, update_query, params)

            # Determine recommendation expiry to store
            try:
                original_reco_path = applicant.get(
                    "recommendation_letter_path")
            except Exception:
                original_reco_path = None

            try:
                original_warning_sent = applicant.get(
                    "recommendation_warning_sent")
            except Exception:
                original_warning_sent = None

            original_uploaded_at = applicant.get(
                "recommendation_letter_uploaded_at")

            if reco_path:
                if reco_path != original_reco_path:  # new file uploaded
                    recommendation_uploaded_at = datetime.now()
                    recommendation_expiry = datetime.now() + relativedelta(months=DOCUMENT_VALIDITY_MONTHS)
                    recommendation_warning_sent = 0  # Reset flag on new upload
                else:  # file unchanged
                    recommendation_uploaded_at = original_uploaded_at
                    recommendation_expiry = applicant.get(
                        "recommendation_letter_expiry")
                    recommendation_warning_sent = original_warning_sent
            else:
                recommendation_uploaded_at = None
                recommendation_expiry = None
                recommendation_warning_sent = original_warning_sent

            run_query(
                conn,
                """
                UPDATE applicants SET
                    first_name=%s, middle_name=%s, last_name=%s,
                    age=%s, sex=%s,
                    phone=%s, email=%s,
                    barangay=%s, city=%s, province=%s,
                    education=%s,
                    is_pwd=%s, pwd_type=%s, has_work_exp=%s, years_experience=%s,
                    registration_reason=%s,
                    profile_pic_path=%s, resume_path=%s, recommendation_letter_path=%s, recommendation_letter_expiry=%s, recommendation_warning_sent=%s, recommendation_letter_uploaded_at=%s,
                    is_from_lipa=%s, status=%s, is_active=%s, updated_at=NOW()
                WHERE applicant_id=%s
                """,
                (
                    first_name, middle_name, last_name,
                    age, sex,
                    phone, email,
                    barangay, city_raw, province,
                    education,
                    is_pwd, pwd_type, has_work, years_exp,
                    reg_reason,
                    profile_path, resume_path, reco_path,
                    recommendation_expiry, recommendation_warning_sent, recommendation_uploaded_at,
                    is_from_lipa_new, status, is_active,
                    applicant_id,
                ),
            )
            conn.commit()

            session["applicant_status"] = status

            # Logout if status became Pending (via residency change OR file update)
            if status == "Pending":
                conn.close()
                return redirect(url_for("home"))

            conn.close()
            flash("Your account details have been updated successfully.", "success")
            return redirect(url_for("applicants.account_security"))

        except Exception as e:
            conn.rollback()
            conn.close()
            flash(f"Error updating information: {e}", "danger")
            return redirect(url_for("applicants.account_security"))

    # --- GET REQUEST ---
    applicant = run_query(
        conn,
        "SELECT * FROM applicants WHERE applicant_id=%s",
        (applicant_id,),
        fetch="one",
    )

    # Calculate expiry flag for Frontend
    is_reco_expiring = False
    if applicant and not applicant.get('is_from_lipa') and applicant.get('recommendation_letter_expiry'):
        expiry = applicant.get('recommendation_letter_expiry')
        # Reuse existing helpers: expired OR within 7 days
        is_reco_expiring = is_document_expired(
            expiry) or will_expire_in_7_days(expiry)

    conn.close()

    # Pass 'is_reco_expiring' to the template
    return render_template("Applicant/acc&secu.html", applicant=applicant, is_reco_expiring=is_reco_expiring)


@applicants_bp.route('/report_job/<int:job_id>', methods=['POST'])
def report_job(job_id):
    """
    Applicant reports a specific job post.
    Saves the report in job_reports and notifies the admin team.
    Expects JSON: { "reason": "..." }
    """

    data = request.get_json(silent=True) or {}
    reason = (data.get('reason') or "").strip()
    applicant_id = session.get('applicant_id')  # must be logged in

    if not applicant_id:
        return jsonify({'success': False, 'message': 'Not logged in'}), 403

    if not reason:
        return jsonify({'success': False, 'message': 'Reason required'}), 400

    conn = create_connection()
    if not conn:
        return jsonify({'success': False, 'message': 'DB connection failed'}), 500

    cursor = conn.cursor(dictionary=True)

    # Fetch job + employer details
    cursor.execute("""
        SELECT j.job_position, j.employer_id, e.employer_name
        FROM jobs j
        LEFT JOIN employers e ON j.employer_id = e.employer_id
        WHERE j.job_id = %s
    """, (job_id,))
    job = cursor.fetchone()
    if not job:
        cursor.close()
        conn.close()
        return jsonify({'success': False, 'message': 'Job not found'}), 404

    cursor.execute("""
        SELECT first_name, last_name
        FROM applicants
        WHERE applicant_id = %s
    """, (applicant_id,))
    reporter = cursor.fetchone() or {}
    reporter_name = f"{reporter.get('first_name', '').strip()} {reporter.get('last_name', '').strip()}".strip(
    )

    details = (data.get('details') or "").strip()

    try:
        ensure_job_report_details_column(cursor)
        cursor.execute("""
            INSERT INTO job_reports (job_id, applicant_id, reason, details, created_at, job_title, employer_name, status)
            VALUES (%s, %s, %s, %s, NOW(), %s, %s, %s)
        """, (
            job_id,
            applicant_id,
            reason,
            details if details else None,
            job.get('job_position'),
            job.get('employer_name'),
            'Pending'
        ))
        report_id = cursor.lastrowid
        conn.commit()

        # Notify admins so they can review immediately
        try:
            create_notification(
                notification_type="employer_reported",
                title="Job report submitted",
                message=f"{job.get('job_position', 'Job')} ({job.get('employer_name', 'Unknown employer')}) was reported"
                f"{f' by {reporter_name}' if reporter_name else ''}. Reason: {reason}",
                count=1,
                related_ids=[job_id],
                employer_id=job.get('employer_id')
            )
        except Exception as notif_error:
            # Don't fail the request if notification creation fails
            print(
                f"[v1] Failed to create notification for job report {report_id}: {notif_error}")

        cursor.close()
        conn.close()
        return jsonify({'success': True, 'message': 'Job report submitted successfully'})
    except Exception as e:
        conn.rollback()
        cursor.close()
        conn.close()
        print(f"[v1] Error reporting job: {e}")
        return jsonify({'success': False, 'message': 'Failed to submit report'}), 500


@applicants_bp.route('/api/applications/<int:application_id>/interview', methods=['GET'])
def get_interview_details(application_id):
    if 'applicant_id' not in session:
        return jsonify({'success': False}), 401

    conn = create_connection()
    try:
        interview = run_query(conn, """
            SELECT * FROM interview_schedules 
            WHERE application_id = %s 
            ORDER BY created_at DESC LIMIT 1
        """, (application_id,), fetch='one')

        if interview:
            # Convert date/time objects to string for JSON
            interview['interview_date'] = str(interview['interview_date'])
            interview['interview_time'] = str(interview['interview_time'])
            return jsonify({'success': True, 'interview': interview})
        return jsonify({'success': False, 'message': 'No interview found'})
    finally:
        conn.close()


@applicants_bp.route('/api/interview/<int:interview_id>/respond', methods=['POST'])
def respond_to_interview(interview_id):
    if 'applicant_id' not in session:
        return jsonify({'success': False}), 401

    data = request.get_json()
    action = data.get('action')  # Confirmed, Declined, Reschedule Requested
    notes = data.get('notes', '')

    conn = create_connection()
    try:
        run_query(conn, "UPDATE interview_schedules SET status = %s, applicant_notes = %s WHERE id = %s AND applicant_id = %s",
                  (action, notes, interview_id, session['applicant_id']))
        conn.commit()

        # Notify Employer
        # FIXED: Join with applications table to get the job_id
        interview = run_query(
            conn,
            """
            SELECT s.employer_id, s.application_id, a.job_id 
            FROM interview_schedules s
            JOIN applications a ON s.application_id = a.id
            WHERE s.id=%s
            """,
            (interview_id,),
            fetch='one'
        )

        if interview:
            from .notifications import create_notification
            create_notification(
                notification_type='job_application',
                title=f'Interview {action}',
                message=f"Applicant has {action.lower()} the interview.",
                # CHANGED: Use job_id for correct redirection
                related_ids=[interview['job_id']],
                employer_id=interview['employer_id']
            )

        return jsonify({'success': True})
    finally:
        conn.close()
