import secrets
from werkzeug.security import generate_password_hash, check_password_hash
from flask import Blueprint, render_template, request, redirect, url_for, session, flash, jsonify
from datetime import datetime
import os
from werkzeug.utils import secure_filename
from db_connection import create_connection, run_query
from extensions import mail
from flask_mail import Message
from .notifications import create_notification
from .recaptcha import verify_recaptcha
from flask import request
from dateutil.relativedelta import relativedelta
from apscheduler.schedulers.background import BackgroundScheduler


applicants_bp = Blueprint("applicants", __name__)

DOCUMENT_VALIDITY_MONTHS = 12  # 1 year


def is_document_expired(expiry_date):
    if not expiry_date:
        return False
    return datetime.now() > expiry_date


def will_expire_in_7_days(expiry_date):
    if not expiry_date:
        return False
    today = datetime.now()
    return 0 < (expiry_date - today).days <= 7


def check_expired_recommendations():
    conn = create_connection()
    if not conn:
        print("[v0] DB connection failed")
        return

    try:
        # Fetch applicants whose recommendation_letter_expiry is in the past and not already flagged
        applicants = run_query(
            conn,
            """
            SELECT applicant_id, first_name, last_name, email, recommendation_letter_expiry, status, recommendation_warning_sent
            FROM applicants
            WHERE recommendation_letter_expiry IS NOT NULL
            """,
            fetch="all"
        )

        for applicant in applicants:
            expiry_date = applicant["recommendation_letter_expiry"]

            # --- 1. Send pre-expiry warning (7 days before) ---
            # Send a pre-expiry warning if it hasn't been sent yet (treat anything != 1 as not sent)
            if will_expire_in_7_days(expiry_date) and applicant.get("recommendation_warning_sent") != 1:
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
                        "UPDATE applicants SET recommendation_warning_sent = 1 WHERE applicant_id=%s",
                        (applicant["applicant_id"],)
                    )
                    conn.commit()

                    print(f"Warning email sent to {applicant['email']}")
                except Exception as e:
                    print(
                        f"Failed to send warning email to {applicant['email']}: {e}")

            # --- 2. Send expired email ---
            if is_document_expired(expiry_date):
                # Standardize on "Reupload" (no hyphen) and mark as inactive
                if applicant.get("status") != "Reupload":
                    # Update status to Reupload and deactivate account until reupload
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
                        msg = Message(subject=subject, recipients=[
                            applicant["email"]], html=body)
                        mail.send(msg)
                        print(f"Expired email sent to {applicant['email']}")
                    except Exception as e:
                        print(
                            f"Failed to send expired email to {applicant['email']}: {e}")

    except Exception as e:
        print(f"[v0] Error checking expired recommendations: {e}")
    finally:
        conn.close()


scheduler = BackgroundScheduler()
scheduler.add_job(func=check_expired_recommendations,
                  trigger="interval", hours=24)
scheduler.start()

print("Background scheduler started: expired recommendations will be checked daily")

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
                files.get("applicantRecommendationLetter"), "recommendations")

            # Set expiry date to 1 year from upload
            upload_date = datetime.now()
            recommendation_expiry = upload_date + \
                relativedelta(months=DOCUMENT_VALIDITY_MONTHS)

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
            profile_pic_path, resume_path, recommendation_letter_path, recommendation_letter_expiry, recommendation_warning_sent,
            accepted_terms, accepted_terms_at, status, is_active,
            password_hash, temp_password
        ) VALUES (
            %(last_name)s, %(first_name)s, %(middle_name)s, %(age)s, %(sex)s,
            %(phone)s, %(email)s, %(is_from_lipa)s, %(province)s, %(city)s, %(barangay)s, %(education)s,
            %(is_pwd)s, %(pwd_type)s, %(has_work_exp)s, %(years_experience)s, %(registration_reason)s,
            %(profile_pic_path)s, %(resume_path)s, %(recommendation_letter_path)s, %(recommendation_letter_expiry)s, %(recommendation_warning_sent)s,
            %(accepted_terms)s, %(accepted_terms_at)s, %(status)s, %(is_active)s,
            %(password_hash)s, %(temp_password)s
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
            "recommendation_letter_expiry": recommendation_expiry,
            "recommendation_warning_sent": 0,
            "accepted_terms": accepted_terms,
            "accepted_terms_at": accepted_terms_at,
            "status": status,
            "is_active": 1 if is_from_lipa else 0,
            "password_hash": password_hash,
            "temp_password": temp_password_plain
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
        print(f"Applicant ID: {applicant_id}")

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
            print(
                "Creating notification for Non-Lipeno applicant (pending approval)...")
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

        # Fetch the generated applicant_code
        applicant_code_row = run_query(
            conn,
            "SELECT applicant_code FROM applicants WHERE email=%s",
            (email,),
            fetch="one"
        )
        applicant_code = applicant_code_row["applicant_code"] if applicant_code_row else "N/A"

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

    # Successful login
    session["applicant_id"] = applicant["applicant_id"]
    session["applicant_name"] = applicant["first_name"]
    session["applicant_email"] = applicant["email"]
    session["applicant_status"] = applicant["status"]

    conn.close()
    flash(f"Welcome back, {applicant['first_name']}!", "success")
    return redirect(url_for("applicants.applicant_home"))


@applicants_bp.route("/logout")
def logout():
    session.clear()
    flash("You have been logged out successfully.", "success")
    return redirect(url_for("home"))

    recaptcha_token = form.get(
        "g-recaptcha-response") or request.form.get("g-recaptcha-response")
    recaptcha_result = verify_recaptcha(recaptcha_token, request.remote_addr)
    if not recaptcha_result.get("success"):
        print("[v0] reCAPTCHA failed:", recaptcha_result)
        return False, "reCAPTCHA verification failed. Please confirm you're not a robot."


# ===== Applicant Navigation Pages =====
@applicants_bp.route("/home")
def applicant_home():
    if "applicant_id" not in session:
        flash("Please log in to access this page.", "warning")
        return redirect(url_for("home"))

    if session.get("applicant_status") == "Reupload":
        flash("Please complete your document reupload first.", "info")
        return redirect(url_for("applicants.account_security"))

    return render_template("Applicant/applicant_home.html")


@applicants_bp.route("/notifications")
def notifications():
    if "applicant_id" not in session:
        flash("Please log in to access this page.", "warning")
        return redirect(url_for("home"))

    if session.get("applicant_status") == "Reupload":
        flash("Please complete your document reupload first.", "info")
        return redirect(url_for("applicants.account_security"))

    return render_template("Applicant/notif.html")


@applicants_bp.route("/applications")
def applications():
    if "applicant_id" not in session:
        flash("Please log in to access this page.", "warning")
        return redirect(url_for("home"))

    if session.get("applicant_status") == "Reupload":
        flash("Please complete your document reupload first.", "info")
        return redirect(url_for("applicants.account_security"))

    # --- FETCH APPLICANT FIRST ---
    applicant_id = session.get("applicant_id")
    conn = create_connection()
    if not conn:
        flash("Database connection failed.", "danger")
        return redirect(url_for("applicants.applicant_home"))

    try:
        applicant = run_query(
            conn,
            "SELECT * FROM applicants WHERE applicant_id = %s",
            (applicant_id,),
            fetch="one"
        )
    except Exception as e:
        flash(f"Error fetching applicant data: {e}", "danger")
        conn.close()
        return redirect(url_for("applicants.applicant_home"))

    if not applicant:
        flash("Applicant not found.", "danger")
        conn.close()
        return redirect(url_for("applicants.applicant_home"))

    if request.method == "POST":
        try:
            # Your form data
            is_pwd = int(request.form.get("is_pwd", 0))
            pwd_type = request.form.get("disability_type") if is_pwd else None
            has_work_exp = int(request.form.get("has_work_exp", 0))
            years_exp = request.form.get(
                "work_duration") if has_work_exp else None

            # Files
            profile_file = request.files.get("profile_pic")
            resume_file = request.files.get("resume_file")
            recommendation_file = request.files.get("recommendation_file")

            # Handle uploaded files
            if profile_file and profile_file.filename:
                if applicant["profile_pic_path"]:
                    old_path = os.path.join(
                        "static", applicant["profile_pic_path"])
                    if os.path.exists(old_path):
                        os.remove(old_path)
                profile_path = save_file(profile_file, "profile_pics")
            else:
                profile_path = applicant["profile_pic_path"]

            if resume_file and resume_file.filename:
                if applicant["resume_path"]:
                    old_path = os.path.join("static", applicant["resume_path"])
                    if os.path.exists(old_path):
                        os.remove(old_path)
                resume_path = save_file(resume_file, "resumes")
            else:
                resume_path = applicant["resume_path"]

            recommendation_path = applicant["recommendation_letter_path"]
            recommendation_expiry = applicant.get(
                "recommendation_letter_expiry")
            recommendation_warning_sent = applicant.get(
                "recommendation_warning_sent", 0)
            status = applicant["status"]
            is_active = applicant.get("is_active", 1)

            if recommendation_file and recommendation_file.filename:
                if applicant["recommendation_letter_path"]:
                    old_path = os.path.join(
                        "static", applicant["recommendation_letter_path"])
                    if os.path.exists(old_path):
                        os.remove(old_path)
                recommendation_path = save_file(
                    recommendation_file, "recommendations")
                # Update expiry date because a new recommendation was uploaded
                recommendation_expiry = datetime.now() + relativedelta(months=DOCUMENT_VALIDITY_MONTHS)
                # Reset warning flag for new upload
                recommendation_warning_sent = 0
                status = "Pending"
                is_active = 0

            # Update DB
            update_query = """
                UPDATE applicants SET
                    first_name=%s,
                    middle_name=%s,
                    last_name=%s,
                    age=%s,
                    sex=%s,
                    phone=%s,
                    email=%s,
                    barangay=%s,
                    city=%s,
                    province=%s,
                    education=%s,
                    is_pwd=%s,
                    pwd_type=%s,
                    has_work_exp=%s,
                    years_experience=%s,
                    registration_reason=%s,
                    profile_pic_path=%s,
                    resume_path=%s,
                    recommendation_letter_path=%s,
                    recommendation_letter_expiry=%s,
                    recommendation_warning_sent=%s,
                    status=%s,
                    is_active=%s
                WHERE applicant_id=%s
            """
            data = (
                request.form.get("first_name", ""),
                request.form.get("middle_name", ""),
                request.form.get("last_name", ""),
                int(request.form.get("age", 0)) if request.form.get(
                    "age") else None,
                request.form.get("sex", ""),
                request.form.get("phone", ""),
                request.form.get("email", ""),
                request.form.get("barangay", ""),
                request.form.get("city", ""),
                request.form.get("province", ""),
                request.form.get("education", ""),
                is_pwd,
                pwd_type,
                has_work_exp,
                years_exp,
                request.form.get("registration_reason", ""),
                profile_path,
                resume_path,
                recommendation_path,
                recommendation_expiry,
                recommendation_warning_sent,
                status,
                is_active,
                applicant_id
            )

            run_query(conn, update_query, data)
            conn.commit()

            if recommendation_file and recommendation_file.filename:
                applicant_name = f"{request.form.get('first_name', '')} {request.form.get('last_name', '')}"
                residency_type = "Lipeno" if applicant.get(
                    "is_from_lipa") else "Non-Lipeno"

                update_notification_query = """
                UPDATE notifications
                SET title = %s, message = %s, is_read = 0, updated_at = NOW()
                WHERE applicant_id = %s AND notification_type = 'applicant_approval'
                """
                notification_params = (
                    "Applicant Document Reuploaded - Verification Required",
                    f"Applicant {applicant_name} has reuploaded their recommendation letter and is pending verification.",
                    applicant_id
                )
                run_query(conn, update_notification_query, notification_params)
                conn.commit()

                flash(
                    "Your recommendation letter has been reuploaded successfully. Your account is now suspended pending admin verification. You will be notified once your document has been reviewed.", "info")
                session["applicant_status"] = "Pending"
            else:
                flash(
                    "Your account details and files have been updated successfully.", "success")

        except Exception as e:
            conn.rollback()
            flash(f"Error updating information: {e}", "danger")

    # Re-fetch applicant after POST
    try:
        applicant = run_query(
            conn,
            "SELECT * FROM applicants WHERE applicant_id = %s",
            (applicant_id,),
            fetch="one"
        )
    finally:
        conn.close()

    return render_template("Applicant/application.html", applicant=applicant)


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
            SET recommendation_letter_path = %s, recommendation_letter_expiry = %s, recommendation_warning_sent = %s, status = 'Pending', is_active = 0
            WHERE applicant_id = %s
            """,
            (new_path, recommendation_expiry, 0, applicant_id)
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


@applicants_bp.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        success, message = register_applicant(request.form, request.files)
        flash(message, "success" if success else "danger")
        return redirect(url_for("applicants.register"))

    return render_template("Landing_Page/applicant_registration.html")


@applicants_bp.route("/deactivate", methods=["POST"])
def deactivate_applicant_account():
    if "applicant_id" not in session:
        return jsonify({"success": False, "message": "Not logged in"}), 401

    applicant_id = session["applicant_id"]
    conn = create_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        # Get applicant details
        cursor.execute("""
            SELECT applicant_id AS id,
                   CONCAT(first_name, ' ',
                          IFNULL(middle_name, ''), ' ',
                          last_name) AS name,
                   email,
                   password_hash AS password,
                   phone
            FROM applicants
            WHERE applicant_id = %s
        """, (applicant_id,))
        applicant = cursor.fetchone()

        if not applicant:
            return jsonify({"success": False, "message": "Applicant not found"}), 404

        # Remove old record if exists, then insert into deactivated_users
        cursor.execute(
            "DELETE FROM deactivated_users WHERE id = %s", (applicant["id"],))
        cursor.execute("""
            INSERT INTO deactivated_users (id, name, email, password, phone, deactivated_at)
            VALUES (%s, %s, %s, %s, %s, NOW())
        """, (applicant["id"], applicant["name"], applicant["email"], applicant["password"], applicant["phone"]))

        # Set inactive + timestamp
        cursor.execute("""
            UPDATE applicants
            SET is_active = 0, deactivated_at = NOW()
            WHERE applicant_id = %s
        """, (applicant_id,))

        conn.commit()
        session.clear()

        return jsonify({"success": True, "message": "Your account has been deactivated and will be permanently deleted after 30 days."})

    except Exception as e:
        conn.rollback()
        return jsonify({"success": False, "message": f"Database error: {str(e)}"}), 500

    finally:
        cursor.close()
        conn.close()


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

                    flash("Your residency has been changed to Non-Lipeño. Your recommendation letter has been uploaded. Please wait for admin approval. You will be logged out.", "warning")

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

            if reco_path:
                if reco_path != original_reco_path:
                    recommendation_expiry = datetime.now() + relativedelta(months=DOCUMENT_VALIDITY_MONTHS)
                    # New file uploaded -> reset warning flag
                    recommendation_warning_sent = 0
                else:
                    recommendation_expiry = applicant.get(
                        "recommendation_letter_expiry")
                    recommendation_warning_sent = original_warning_sent
            else:
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
                    profile_pic_path=%s, resume_path=%s, recommendation_letter_path=%s, recommendation_letter_expiry=%s, recommendation_warning_sent=%s,
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
                    recommendation_expiry, recommendation_warning_sent,
                    is_from_lipa_new, status, is_active,
                    applicant_id,
                ),
            )
            conn.commit()

            session["applicant_status"] = status

            if residency_changed and is_from_lipa_new == 0:
                conn.close()
                session.clear()
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
