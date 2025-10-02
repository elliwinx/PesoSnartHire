# backend/applicants.py
import secrets
from werkzeug.security import generate_password_hash
from flask import Blueprint, render_template, request, redirect, url_for, session, flash
from datetime import datetime
import os
from werkzeug.utils import secure_filename
from db_connection import create_connection, run_query
from extensions import mail
from flask_mail import Message

applicants_bp = Blueprint("applicants", __name__)

UPLOAD_FOLDER = "static/uploads"


def save_file(file, subfolder):
    if not file:
        return None
    folder_path = os.path.join(UPLOAD_FOLDER, subfolder)
    os.makedirs(folder_path, exist_ok=True)
    filename = secure_filename(file.filename)
    file_path = os.path.join(folder_path, filename)
    file.save(file_path)
    return file_path


# backend/applicants.py

applicants_bp = Blueprint("applicants", __name__)

UPLOAD_FOLDER = "static/uploads"


def save_file(file, subfolder):
    if not file:
        return None
    folder_path = os.path.join(UPLOAD_FOLDER, subfolder)
    os.makedirs(folder_path, exist_ok=True)
    filename = secure_filename(file.filename)
    file_path = os.path.join(folder_path, filename)
    file.save(file_path)
    return file_path


def register_applicant(form, files):
    conn = create_connection()
    if not conn:
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
            return False, "You are already registered. Please log in or contact admin."

        # ==== Determine applicant type ====
        is_from_lipa = int(form.get("fromLipa") == "on")
        is_pwd = int(form.get("pwd") == "on")
        has_work_exp = int(form.get("workExperience") == "on")
        accepted_terms = int(session.get("accepted_terms", 0))
        accepted_terms_at = session.get("accepted_terms_at", None)

        # ==== Save uploaded files ====
        profile_path = save_file(
            files.get("applicantProfilePic"), "profile_pics")
        resume_path = save_file(files.get("applicantResume"), "resumes")
        recommendation_path = None
        if not is_from_lipa:
            recommendation_path = save_file(
                files.get("applicantRecommendationLetter"), "recommendations")

        city = form.get("applicantCity") or form.get("applicantCityText")
        barangay = form.get("applicantBarangay") or form.get(
            "applicantBarangayText")
        pwd_type = form.get("applicantIsPWD") if is_pwd else None
        years_exp = form.get("applicantHasWorkExp") if has_work_exp else None

        # ==== Set status ====
        status = "Approved" if is_from_lipa else "Pending"

        # ==== Generate temporary password ====
        temp_password_plain = secrets.token_urlsafe(8)
        password_hash = generate_password_hash(temp_password_plain)

        # ==== Insert applicant into DB ====
        query = """
        INSERT INTO applicants (
            last_name, first_name, middle_name, age, sex,
            phone, email, is_from_lipa, province, city, barangay, education,
            is_pwd, pwd_type, has_work_exp, years_experience, registration_reason,
            profile_pic_path, resume_path, recommendation_letter_path,
            accepted_terms, accepted_terms_at, status,
            password_hash, temp_password
        ) VALUES (
            %(last_name)s, %(first_name)s, %(middle_name)s, %(age)s, %(sex)s,
            %(phone)s, %(email)s, %(is_from_lipa)s, %(province)s, %(city)s, %(barangay)s, %(education)s,
            %(is_pwd)s, %(pwd_type)s, %(has_work_exp)s, %(years_experience)s, %(registration_reason)s,
            %(profile_pic_path)s, %(resume_path)s, %(recommendation_letter_path)s,
            %(accepted_terms)s, %(accepted_terms_at)s, %(status)s,
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
            "password_hash": password_hash,
            "temp_password": password_hash  # store hashed temp password
        }

        run_query(conn, query, data)

       # 2️⃣ Fetch the generated applicant_code
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
        except Exception as e:
            print(f"❌ Failed to send email: {e}")

        success_message = (
            "Registration successful! Login credentials have been sent to your email."
            if is_from_lipa else
            "Registration submitted! Please wait for admin approval."
        )
        return True, success_message

    finally:
        conn.close()


# ===== Routes =====
@applicants_bp.route("/applicants/terms", methods=["GET", "POST"])
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


# ===== Applicant Navigation Pages =====
@applicants_bp.route("/home")
def applicant_home():
    return render_template("Applicant/applicant_home.html")


@applicants_bp.route("/notifications")
def notifications():
    return render_template("Applicant/notif.html")


@applicants_bp.route("/applications")
def applications():
    return render_template("Applicant/application.html")


@applicants_bp.route("/account-security")
def account_security():
    return render_template("Applicant/acc&secu.html")
