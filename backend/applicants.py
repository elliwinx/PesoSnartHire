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

applicants_bp = Blueprint("applicants", __name__)

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
        if not is_from_lipa:
            recommendation_path = save_file(
                files.get("applicantRecommendationLetter"), "recommendations")

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
            profile_pic_path, resume_path, recommendation_letter_path,
            accepted_terms, accepted_terms_at, status, is_active,
            password_hash, temp_password
        ) VALUES (
            %(last_name)s, %(first_name)s, %(middle_name)s, %(age)s, %(sex)s,
            %(phone)s, %(email)s, %(is_from_lipa)s, %(province)s, %(city)s, %(barangay)s, %(education)s,
            %(is_pwd)s, %(pwd_type)s, %(has_work_exp)s, %(years_experience)s, %(registration_reason)s,
            %(profile_pic_path)s, %(resume_path)s, %(recommendation_letter_path)s,
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

    return render_template("Applicant/application.html")


@applicants_bp.route("/account-security")
def account_security():
    if "applicant_id" not in session:
        flash("Please log in to access this page.", "warning")
        return redirect(url_for("home"))
    return render_template("Applicant/acc&secu.html")


@applicants_bp.route("/submit-reupload", methods=["POST"])
def submit_reupload():
    if "applicant_id" not in session:
        return jsonify({"success": False, "message": "Not authenticated"}), 401

    applicant_id = session["applicant_id"]
    file = request.files.get("document")

    if not file:
        return jsonify({"success": False, "message": "No file provided"}), 400

    try:
        # Save the reuploaded file
        recommendation_path = save_file(file, "recommendations")

        conn = create_connection()
        if not conn:
            return jsonify({"success": False, "message": "DB connection failed"}), 500

        # Update applicant document
        query = "UPDATE applicants SET recommendation_letter_path = %s WHERE applicant_id = %s"
        run_query(conn, query, (recommendation_path, applicant_id))
        conn.commit()

        create_notification(
            notification_type="applicant_reupload",
            title="Applicant Document Reuploaded",
            message="An applicant has reuploaded their required document",
            count=1,
            related_ids=[applicant_id],
            applicant_id=applicant_id
        )

        conn.close()

        return jsonify({"success": True, "message": "Document reuploaded successfully"}), 200

    except Exception as e:
        print(f"[v0] Error submitting reupload: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


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
