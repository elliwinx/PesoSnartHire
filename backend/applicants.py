def ensure_job_report_details_column(cursor):
    """Ensure job_reports.details column exists before inserts."""
    cursor.execute("SHOW COLUMNS FROM job_reports LIKE 'details'")
    if not cursor.fetchone():
        cursor.execute("ALTER TABLE job_reports ADD COLUMN details TEXT NULL AFTER reason")

import secrets
from werkzeug.security import generate_password_hash, check_password_hash
from flask import Blueprint, render_template, request, redirect, url_for, session, flash, jsonify
from datetime import datetime, date, timedelta

def ensure_applicant_suspension_column(conn):
    cursor = conn.cursor()
    cursor.execute("SHOW COLUMNS FROM applicants LIKE 'suspension_end_at'")
    exists = cursor.fetchone()
    if not exists:
        cursor.execute("ALTER TABLE applicants ADD COLUMN suspension_end_at DATETIME NULL AFTER updated_at")
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
                html=f"<p>Hi {row.get('first_name','Applicant')},</p><p>Your suspension period has ended. You may now continue using PESO SmartHire.</p>"
            )
            mail.send(msg)
        except Exception as exc:
            print(f"[v1] Failed to send suspension end email: {exc}")
    conn.commit()
    cursor.close()

import os
from werkzeug.utils import secure_filename
from db_connection import create_connection, run_query
from extensions import mail
from flask_mail import Message
from .notifications import create_notification, get_notifications, mark_notification_read
from .recaptcha import verify_recaptcha
from flask import request
from dateutil.relativedelta import relativedelta
from apscheduler.schedulers.background import BackgroundScheduler

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
        existing = run_query(
            conn,
            "SELECT applicant_id FROM applicants WHERE email=%s OR phone=%s",
            (email, phone),
            fetch="all"
        )
        if existing:
            print(f"[v0] Applicant already exists: {email}")
            return False, "You are already registered. Please log in or contact admin."

        # ==== Determine applicant type ====
        is_from_lipa = int(form.get("fromLipa") == "on")
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

        if is_from_lipa:
            city = form.get("applicantCity")
            barangay = form.get("applicantBarangay")
        else:
            city = form.get("applicantCityText")
            barangay = form.get("applicantBarangayText")

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
            "province": form.get("applicantProvince"),
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


@applicants_bp.route("/logout")
def logout():
    session.clear()
    flash("You have been logged out successfully.", "success")
    return redirect(url_for("home"))


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
                (SELECT COUNT(*) FROM applications
                 WHERE applications.job_id = jobs.job_id
                 AND applications.applicant_id = %s) as has_applied
            FROM jobs
            LEFT JOIN employers ON jobs.employer_id = employers.employer_id
            WHERE jobs.status = 'active'
            ORDER BY jobs.created_at DESC
            """,
            (applicant_id,),
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

        existing = run_query(
            conn,
            "SELECT 1 FROM applications WHERE job_id=%s AND applicant_id=%s",
            (job_id, applicant_id),
            fetch="one"
        )
        if existing:
            return jsonify({"success": False, "message": "You have already applied to this job."}), 400

        job_details = run_query(
            conn,
            """SELECT j.job_position, j.employer_id, e.employer_name
               FROM jobs j
               JOIN employers e ON j.employer_id = e.employer_id
               WHERE j.job_id = %s""",
            (job_id,),
            fetch="one"
        )

        applicant_details = run_query(
            conn,
            "SELECT first_name, last_name FROM applicants WHERE applicant_id = %s",
            (applicant_id,),
            fetch="one"
        )

        # Insert application
        run_query(
            conn,
            "INSERT INTO applications (job_id, applicant_id, applied_at) VALUES (%s, %s, NOW())",
            (job_id, applicant_id)
        )

        if job_details and applicant_details:
            employer_id = job_details["employer_id"]
            job_position = job_details["job_position"]
            applicant_name = f"{applicant_details['first_name']} {applicant_details['last_name']}"

            # Use existing notification system
            try:
                create_notification(
                    # Use job_application notification type instead of employer_approval
                    notification_type='job_application',
                    title=f"New Application for {job_position}",
                    message=f"{applicant_name} has applied to your job posting",
                    count=1,
                    related_ids=[job_id],
                    employer_id=employer_id
                )
            except Exception as notif_error:
                print(f"[v0] Error creating notification: {notif_error}")
                # Continue even if notification fails

            # Try to increment employer applicant count if column exists
            try:
                run_query(
                    conn,
                    "UPDATE employers SET application_count = application_count + 1 WHERE employer_id = %s",
                    (employer_id,)
                )
            except Exception as e:
                # Fallback to old column name if DB still uses applicant_count
                try:
                    run_query(
                        conn,
                        "UPDATE employers SET applicant_count = application_count + 1 WHERE employer_id = %s",
                        (employer_id,)
                    )
                except Exception:
                    print(
                        "[v0] Skipping employers application count update (columns may be missing):", e)

            # Also increment the job's application_count so frontend shows correct count
            try:
                run_query(
                    conn,
                    "UPDATE jobs SET application_count = application_count + 1 WHERE job_id = %s",
                    (job_id,)
                )
            except Exception:
                try:
                    run_query(
                        conn,
                        "UPDATE jobs SET applicant_count = applicant_count + 1 WHERE job_id = %s",
                        (job_id,)
                    )
                except Exception:
                    # ignore if column missing
                    pass

        conn.commit()

        # Fetch updated job applicant count
        new_count_row = run_query(
            conn,
            "SELECT application_count FROM jobs WHERE job_id = %s",
            (job_id,),
            fetch="one"
        )
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
        # return plain text with 401 so fetch.ok will be false
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

        # Return only modal fragment HTML
        return render_template("Applicant/job_modal_content.html", job=job)

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
    except Exception as e:
        print('[v0] Failed to load notifications:', e)
        notifications = []

    return render_template("Applicant/notif.html", notifications=notifications)


@applicants_bp.route('/api/notifications/<int:notif_id>/read', methods=['POST'])
def mark_applicant_notification_read(notif_id):
    if 'applicant_id' not in session:
        return jsonify({'success': False, 'message': 'Not logged in'}), 401

    applicant_id = session['applicant_id']
    conn = create_connection()
    if not conn:
        return jsonify({'success': False, 'message': 'DB connection failed'}), 500

    try:
        row = run_query(
            conn, 'SELECT applicant_id FROM notifications WHERE notification_id = %s', (notif_id,), fetch='one')
        conn.close()
        if not row or row.get('applicant_id') != applicant_id:
            return jsonify({'success': False, 'message': 'Notification not found'}), 404

        ok = mark_notification_read(notif_id)
        if ok:
            return jsonify({'success': True})
        else:
            return jsonify({'success': False, 'message': 'Failed to mark read'}), 500
    except Exception as e:
        try:
            conn.close()
        except Exception:
            pass
        print('[v0] Error marking notification read:', e)
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
def api_delete_application(app_id):
    if 'applicant_id' not in session:
        return jsonify({'success': False, 'message': 'Not logged in'}), 401

    applicant_id = session['applicant_id']
    conn = create_connection()
    if not conn:
        return jsonify({'success': False, 'message': 'DB connection failed'}), 500

    try:
        # Verify ownership and get job_id
        row = run_query(conn, 'SELECT * FROM applications WHERE id = %s AND applicant_id = %s',
                        (app_id, applicant_id), fetch='one')
        if not row:
            return jsonify({'success': False, 'message': 'Application not found'}), 404

        job_id = row.get('job_id')

        # Delete the application
        run_query(conn, 'DELETE FROM applications WHERE id = %s', (app_id,))

        # Decrement job.application_count if present
        try:
            run_query(
                conn, 'UPDATE jobs SET application_count = application_count - 1 WHERE job_id = %s AND application_count > 0', (job_id,))
        except Exception:
            # try legacy column name
            try:
                run_query(
                    conn, 'UPDATE jobs SET applicant_count = applicant_count - 1 WHERE job_id = %s AND applicant_count > 0', (job_id,))
            except Exception:
                pass

        # If we can get employer id, decrement employer counts too
        try:
            jid = run_query(
                conn, 'SELECT employer_id FROM jobs WHERE job_id = %s', (job_id,), fetch='one')
            if jid and jid.get('employer_id'):
                emp_id = jid.get('employer_id')
                try:
                    run_query(
                        conn, 'UPDATE employers SET application_count = application_count - 1 WHERE employer_id = %s AND application_count > 0', (emp_id,))
                except Exception:
                    try:
                        run_query(
                            conn, 'UPDATE employers SET applicant_count = applicant_count - 1 WHERE employer_id = %s AND application_count > 0', (emp_id,))
                    except Exception:
                        pass
        except Exception:
            pass

        conn.commit()
        return jsonify({'success': True})
    except Exception as e:
        conn.rollback()
        print('[v0] Error deleting application:', e)
        return jsonify({'success': False, 'message': 'Failed to delete application'}), 500
    finally:
        conn.close()


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
            status = applicant["status"]
            is_active = applicant.get("is_active", 1)

            # This flag should NEVER be reset during updates - it was set during registration
            # Only admin approval of NEW applicants should set it to 1
            must_change_password = applicant.get("must_change_password", 0)

            residency_changed = (was_lipa != is_from_lipa_new)

            if residency_changed and is_from_lipa_new == 0:
                if not (reco_file and reco_file.filename):
                    conn.close()
                    flash(
                        "You are changing your residency to Non-Lipeño. Please upload your recommendation letter before saving.", "warning")
                    return redirect(url_for("applicants.account_security") + "?tab=documents&focus=reco")

            if residency_changed:
                if is_from_lipa_new == 1:
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
                    # Lipeño -> Non-Lipeño: require approval and save recommendation letter
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

            elif is_from_lipa_new == 0 and reco_file and reco_file.filename:
                if reco_path:
                    old = os.path.join("static", reco_path)
                    if os.path.exists(old):
                        os.remove(old)
                reco_path = save_file(reco_file, "recommendations")

                if status == "Pending":
                    update_query = """
                    UPDATE notifications
                    SET title = %s, message = %s, is_read = 0, updated_at = NOW()
                    WHERE applicant_id = %s AND notification_type = 'applicant_approval'
                    """
                    params = (
                        "Non-Lipeño Applicant Document Uploaded",
                        f"Applicant #{applicant_id} ({first_name} {last_name}) has uploaded their recommendation letter and is ready for review.",
                        applicant_id
                    )
                    run_query(conn, update_query, params)

            # Determine recommendation expiry to store:
            # - If there's a recommendation file now and it's newly uploaded, set expiry 1 year from now
            # - If the path was unchanged, keep existing expiry from the fetched applicant
            # - If no recommendation, set expiry to None
            try:
                original_reco_path = applicant.get(
                    "recommendation_letter_path")
            except Exception:
                original_reco_path = None

            # preserve previous warning flag if present
            try:
                original_warning_sent = applicant.get(
                    "recommendation_warning_sent")
            except Exception:
                original_warning_sent = None

            original_reco_path = applicant.get("recommendation_letter_path")
            original_uploaded_at = applicant.get(
                "recommendation_letter_uploaded_at")
            original_warning_sent = applicant.get(
                "recommendation_warning_sent")

            if reco_path:
                if reco_path != original_reco_path:  # new file uploaded
                    recommendation_uploaded_at = datetime.now()
                    recommendation_expiry = datetime.now() + relativedelta(months=DOCUMENT_VALIDITY_MONTHS)
                    recommendation_warning_sent = 0  # <-- Reset flag on new upload
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

            if residency_changed and is_from_lipa_new == 0:
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

    applicant = run_query(
        conn,
        "SELECT * FROM applicants WHERE applicant_id=%s",
        (applicant_id,),
        fetch="one",
    )
    conn.close()
    return render_template("Applicant/acc&secu.html", applicant=applicant)


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
    reporter_name = f"{reporter.get('first_name', '').strip()} {reporter.get('last_name', '').strip()}".strip()

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
            print(f"[v1] Failed to create notification for job report {report_id}: {notif_error}")

        cursor.close()
        conn.close()
        return jsonify({'success': True, 'message': 'Job report submitted successfully'})
    except Exception as e:
        conn.rollback()
        cursor.close()
        conn.close()
        print(f"[v1] Error reporting job: {e}")
        return jsonify({'success': False, 'message': 'Failed to submit report'}), 500
