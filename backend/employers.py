from flask import Blueprint, render_template, request, redirect, url_for, session, flash, jsonify, current_app
from datetime import datetime, timedelta, date
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash
from db_connection import create_connection, run_query
from flask_mail import Message
from extensions import mail
from .notifications import create_notification
from .recaptcha import verify_recaptcha
from .recruitment_change_handler import handle_recruitment_type_change
from dateutil.relativedelta import relativedelta
from apscheduler.schedulers.background import BackgroundScheduler
import os
import json
import traceback
import magic

employers_bp = Blueprint("employers", __name__)

DOCUMENT_VALIDITY = {
    "business_permit": 12,
    "job_order": 6,
    "dole_recruit_authority": 36,
    "dmw_recruit_authority": 48,
    "dole_no_pending_case": 6,
    "dmw_no_pending_case": 6,
    "philjobnet": 60,
}

UPLOAD_TO_EXPIRY = {
    "business_permit_path": "business_permit_expiry",
    "philiobnet_registration_path": "philiobnet_registration_expiry",
    "job_orders_of_client_path": "job_orders_expiry",  # FIXED
    "dole_no_pending_case_path": "dole_no_pending_case_expiry",
    "dole_authority_to_recruit_path": "dole_authority_expiry",
    "dmw_no_pending_case_path": "dmw_no_pending_case_expiry",
    "license_to_recruit_path": "license_to_recruit_expiry",
}

EXPIRY_TO_UPLOADED_AT = {
    "business_permit_expiry": "business_permit_uploaded_at",
    "philiobnet_registration_expiry": "philiobnet_uploaded_at",
    "job_orders_expiry": "job_orders_uploaded_at",
    "dole_no_pending_case_expiry": "dole_no_pending_uploaded_at",
    "dole_authority_expiry": "dole_authority_uploaded_at",
    "dmw_no_pending_case_expiry": "dmw_no_pending_uploaded_at",
    "license_to_recruit_expiry": "license_to_recruit_uploaded_at"
}


doc_key_map = {
    "business_permit_path": "business_permit",
    "philiobnet_registration_path": "philjobnet",
    "job_orders_of_client_path": "job_order",
    "dole_no_pending_case_path": "dole_no_pending_case",
    "dole_authority_to_recruit_path": "dole_recruit_authority",
    "dmw_no_pending_case_path": "dmw_no_pending_case",
    "license_to_recruit_path": "dmw_recruit_authority",
}

DOCUMENT_NAMES = {
    "business_permit_expiry": "Business Permit",
    "philiobnet_registration_expiry": "PhilJobNet Registration",
    "job_orders_expiry": "Job Orders",
    "dole_no_pending_case_expiry": "DOLE No Pending Case",
    "dole_authority_expiry": "DOLE Authority",
    "dmw_no_pending_case_expiry": "DMW No Pending Case",
    "license_to_recruit_expiry": "License to Recruit"
}


def to_date(value):
    """Convert various date formats to a date object."""
    if not value:
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, str):
        try:
            return datetime.strptime(value, '%Y-%m-%d').date()
        except ValueError:
            return None
    return None


def get_expiry_date(months_valid):
    """Return expiry date based on number of months from now"""
    return datetime.now() + relativedelta(months=+months_valid)


def check_expired_employer_documents():
    """Check for expired employer documents and send warning emails (daily reminders)."""
    conn = create_connection()
    if not conn:
        print("[v0] ✗ DB connection failed in check_expired_employer_documents")
        return

    try:
        reset_updates = [
            "business_permit_warning_sent = 0 WHERE business_permit_expiry > NOW()",
            "philiobnet_registration_warning_sent = 0 WHERE philiobnet_registration_expiry > NOW()",
            "job_orders_warning_sent = 0 WHERE job_orders_expiry > NOW()",
            "dole_no_pending_case_warning_sent = 0 WHERE dole_no_pending_case_expiry > NOW()",
            "dole_authority_warning_sent = 0 WHERE dole_authority_expiry > NOW()",
            "dmw_no_pending_case_warning_sent = 0 WHERE dmw_no_pending_case_expiry > NOW()",
            "license_to_recruit_warning_sent = 0 WHERE license_to_recruit_expiry > NOW()"
        ]

        for update in reset_updates:
            run_query(conn, f"UPDATE employers SET {update}")
            conn.commit()

        employers = run_query(
            conn,
            """
            SELECT employer_id, employer_name, email, status, is_active,
                   business_permit_expiry, philiobnet_registration_expiry,
                   job_orders_expiry, dole_no_pending_case_expiry,
                   dole_authority_expiry, dmw_no_pending_case_expiry,
                   license_to_recruit_expiry,
                   business_permit_warning_sent, philiobnet_registration_warning_sent,
                   job_orders_warning_sent, dole_no_pending_case_warning_sent,
                   dole_authority_warning_sent, dmw_no_pending_case_warning_sent,
                   license_to_recruit_warning_sent,
                   business_permit_warning_date, philiobnet_registration_warning_date,
                   job_orders_warning_date, dole_no_pending_case_warning_date,
                   dole_authority_warning_date, dmw_no_pending_case_warning_date,
                   license_to_recruit_warning_date
            FROM employers
            WHERE is_active = 1
            """,
            fetch="all"
        )

        if not employers:
            print("[v0] No active employers to check")
            return

        print(
            f"[v0] Checking expired documents for {len(employers)} employers")

        today = datetime.now().date()

        for emp in employers:
            # Define document fields with expiry, warning flag, and warning date
            doc_fields = [
                ("business_permit_expiry", "business_permit_warning_sent",
                 "business_permit_warning_date"),
                ("philiobnet_registration_expiry", "philiobnet_registration_warning_sent",
                 "philiobnet_registration_warning_date"),
                ("job_orders_expiry", "job_orders_warning_sent",
                 "job_orders_warning_date"),
                ("dole_no_pending_case_expiry", "dole_no_pending_case_warning_sent",
                 "dole_no_pending_case_warning_date"),
                ("dole_authority_expiry", "dole_authority_warning_sent",
                 "dole_authority_warning_date"),
                ("dmw_no_pending_case_expiry", "dmw_no_pending_case_warning_sent",
                 "dmw_no_pending_case_warning_date"),
                ("license_to_recruit_expiry", "license_to_recruit_warning_sent",
                 "license_to_recruit_warning_date")
            ]

            for expiry_field, warning_field, warning_date_field in doc_fields:
                expiry_date = emp.get(expiry_field)
                warning_sent = emp.get(warning_field)
                last_warning_date = emp.get(warning_date_field)

                # Normalize warning_date to date object
                if last_warning_date:
                    last_warning_date = to_date(last_warning_date)

                if not expiry_date:
                    continue

                print(
                    f"[v0] Employer {emp['employer_id']}: Checking {expiry_field} (expires: {expiry_date}, warning_sent: {warning_sent}, last_warning_date: {last_warning_date})")

                doc_friendly_name = DOCUMENT_NAMES.get(
                    expiry_field, expiry_field)

                # --- 1. Pre-expiry warning (7 days before, once per day) ---
                if will_expire_in_7_days(expiry_date) and warning_sent != 1:
                    # Only send once per day (like applicants.py)
                    if last_warning_date != today:
                        subject = "PESO SmartHire - Document Expiry Warning"
                        body = f"""
                        <p>Hi {emp['employer_name']},</p>
                        <p>The following document will expire soon: <b>{doc_friendly_name}</b>.</p>
                        <p>Please update it to avoid any disruption in your account status.</p>
                        <p>Expiry Date: <b>{expiry_date.strftime('%Y-%m-%d')}</b></p>
                        <p>Best regards,<br/>PESO SmartHire Team</p>
                        """

                        try:
                            from extensions import mail
                            msg = Message(
                                subject=subject,
                                recipients=[emp["email"]],
                                html=body
                            )
                            mail.send(msg)

                            # Mark warning as sent and record today's date
                            run_query(
                                conn,
                                f"UPDATE employers SET {warning_field} = 1, {warning_date_field} = %s WHERE employer_id=%s",
                                (today, emp["employer_id"],)
                            )
                            conn.commit()
                            print(
                                f"[v0] ✓ Pre-expiry warning sent to {emp['email']} for {expiry_field}")
                        except Exception as e:
                            print(
                                f"[v0] ✗ Failed to send pre-expiry warning to {emp['email']}: {e}")
                            import traceback
                            traceback.print_exc()

                # --- 2. Expired documents (send on expiry date) ---
                if is_document_expired(expiry_date):
                    if emp.get("status") != "Reupload":
                        run_query(
                            conn,
                            "UPDATE employers SET status=%s, is_active=%s WHERE employer_id=%s",
                            ("Reupload", 0, emp["employer_id"])
                        )
                        conn.commit()

                        doc_friendly_name = DOCUMENT_NAMES.get(
                            expiry_field, expiry_field)

                        subject = "PESO SmartHire - Document Expired"
                        body = f"""
                        <p>Hi {emp['employer_name']},</p>
                        <p>Your document <b>{doc_friendly_name}</b> has expired. Please re-upload it immediately to maintain your account's active status.</p>
                        <p>You can still enter your account to re-upload the necessary documents.</p>
                        <p>Best regards,<br/>PESO SmartHire Team</p>
                        """

                        try:
                            from extensions import mail
                            msg = Message(
                                subject=subject,
                                recipients=[emp["email"]],
                                html=body
                            )
                            mail.send(msg)
                            print(
                                f"[v0] ✓ Expired email sent to {emp['email']} for {expiry_field}")
                        except Exception as e:
                            print(
                                f"[v0] ✗ Failed to send expired email to {emp['email']}: {e}")
                            import traceback
                            traceback.print_exc()

    except Exception as e:
        print(f"[v0] ✗ Error checking expired employer documents: {e}")
        import traceback
        traceback.print_exc()
    finally:
        conn.close()


def is_document_expired(expiry_date):
    if not expiry_date:
        return False
    if isinstance(expiry_date, str):
        expiry_date = datetime.strptime(expiry_date, '%Y-%m-%d').date()
    elif isinstance(expiry_date, datetime):
        expiry_date = expiry_date.date()

    return datetime.now().date() > expiry_date


def will_expire_in_7_days(expiry_date):
    if not expiry_date:
        return False
    if isinstance(expiry_date, str):
        expiry_date = datetime.strptime(expiry_date, '%Y-%m-%d').date()
    elif isinstance(expiry_date, datetime):
        expiry_date = expiry_date.date()

    today = datetime.now().date()
    days_until_expiry = (expiry_date - today).days
    print(
        f"[v0] Date check: today={today}, expiry={expiry_date}, days_until={days_until_expiry}")
    return 0 < days_until_expiry <= 7


UPLOAD_FOLDER = "static/uploads"
# Ensure the base upload folder exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def save_file(file, subfolder):
    """Save uploaded employer files into a dedicated subfolder with unique names."""
    header = file.read(2048)
    file.seek(0)  # Reset cursor
    mime = magic.from_buffer(header, mime=True)

    # UPDATE: Added image types to the allowed list
    allowed_mimes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']

    if mime not in allowed_mimes:
        raise ValueError(
            "Invalid file type. Only PDFs, PNGs, and JPGs are allowed.")

    if not file or file.filename.strip() == "":
        return None

    folder_path = os.path.join(UPLOAD_FOLDER, subfolder)
    os.makedirs(folder_path, exist_ok=True)

    filename = secure_filename(file.filename)
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S%f")
    name, ext = os.path.splitext(filename)
    unique_filename = f"{name}_{timestamp}{ext}"

    file_path = os.path.join(folder_path, unique_filename)
    file.save(file_path)

    return os.path.join("uploads", subfolder, unique_filename).replace("\\", "/")


def delete_file(file_path):
    """Delete a file if it exists."""
    if not file_path:
        return True

    try:
        full_path = os.path.join("static", file_path)
        if os.path.exists(full_path):
            os.remove(full_path)
            return True
    except Exception as e:
        print(f"[employers_account] Error deleting file {file_path}: {e}")

    return False


def get_employer_data(employer_id):
    """Fetch employer data from database."""
    conn = create_connection()
    if not conn:
        return None

    query = "SELECT * FROM employers WHERE employer_id = %s"
    result = run_query(conn, query, (employer_id,), fetch="one")
    conn.close()

    return result


def register_employer(form_data, files):
    """Helper function to process employer registration"""
    print("[v0] Starting employer registration process")
    print(f"[v0] Form data received for: {form_data.get('employerName')}")
    print(f"[v0] Recruitment type: {form_data.get('employerRecruitment')}")

    employer_data = {
        "employer_name": form_data.get("employerName"),
        "industry": form_data.get("employerIndustry"),
        "recruitment_type": form_data.get("employerRecruitment"),
        "contact_person": form_data.get("employerContactPerson"),
        "phone": form_data.get("employerPhoneNumber"),
        "email": form_data.get("employerEmail"),
        "street": form_data.get("employerStreet"),
        "barangay": form_data.get("employerBarangay"),
        "city": form_data.get("employerCity"),
        "province": form_data.get("employerProvince"),
        "password": form_data.get("employerPassword"),
    }

    print(f"[v0] Files received: {list(files.keys())}")

    # Save base required files
    company_logo_path = save_file(
        files.get("employerCompanyLogo"), "employer_logo")
    business_permit_path = save_file(
        files.get("employerBusinessPermit"), "employer_permit")
    business_permit_uploaded_at = datetime.now() if business_permit_path else None
    philiobnet_path = save_file(
        files.get("employerPhiliobnetRegistration"), "employer_philiobnet")
    philiobnet_uploaded_at = datetime.now() if philiobnet_path else None
    job_orders_path = save_file(
        files.get("employerJobOrdersOfClient"), "employer_joborders")
    job_orders_uploaded_at = datetime.now() if job_orders_path else None

    print(
        f"[v0] Base files saved - Logo: {bool(company_logo_path)}, Permit: {bool(business_permit_path)}")

    dole_no_pending_path = None
    dole_no_pending_uploaded_at = None
    dole_authority_path = None
    dole_authority_uploaded_at = None
    dmw_no_pending_path = None
    dmw_no_pending_uploaded_at = None
    license_to_recruit_path = None
    license_to_recruit_uploaded_at = None

    # Handle recruitment type specific files
    if employer_data["recruitment_type"] == "Local":
        print("[v0] Processing Local recruitment files (DOLE)")
        dole_no_pending_path = save_file(
            files.get("employerDOLENoPendingCase"), "employer_dole")
        dole_no_pending_uploaded_at = datetime.now() if dole_no_pending_path else None
        dole_authority_path = save_file(
            files.get("employerDOLEAuthorityToRecruit"), "employer_dole")
        dole_authority_uploaded_at = datetime.now() if dole_authority_path else None

        print(
            f"[v0] DOLE files - No Pending: {bool(dole_no_pending_path)}, Authority: {bool(dole_authority_path)}")

        if not dole_no_pending_path or not dole_authority_path:
            return False, "Please upload all required DOLE documents for Local recruitment."

    elif employer_data["recruitment_type"] == "International":
        print("[v0] Processing International recruitment files (DMW)")
        dmw_no_pending_path = save_file(
            files.get("employerDMWNoPendingCase"), "employer_dmw")
        dmw_no_pending_uploaded_at = datetime.now() if dmw_no_pending_path else None
        license_to_recruit_path = save_file(
            files.get("employerLicenseToRecruit"), "employer_dmw")
        license_to_recruit_uploaded_at = datetime.now() if license_to_recruit_path else None

        print(
            f"[v0] DMW files - No Pending: {bool(dmw_no_pending_path)}, License: {bool(license_to_recruit_path)}")

        if not dmw_no_pending_path or not license_to_recruit_path:
            return False, "Please upload all required DMW documents for International recruitment."

    # --- Now calculate expiry dates ---
    business_permit_expiry = get_expiry_date(
        DOCUMENT_VALIDITY["business_permit"]) if business_permit_path else None
    philiobnet_expiry = get_expiry_date(
        DOCUMENT_VALIDITY["philjobnet"]) if philiobnet_path else None
    job_orders_expiry = get_expiry_date(
        DOCUMENT_VALIDITY["job_order"]) if job_orders_path else None

    dole_no_pending_expiry = get_expiry_date(
        DOCUMENT_VALIDITY["dole_no_pending_case"]) if dole_no_pending_path else None
    dole_authority_expiry = get_expiry_date(
        DOCUMENT_VALIDITY["dole_recruit_authority"]) if dole_authority_path else None
    dmw_no_pending_expiry = get_expiry_date(
        DOCUMENT_VALIDITY["dmw_no_pending_case"]) if dmw_no_pending_path else None
    license_to_recruit_expiry = get_expiry_date(
        DOCUMENT_VALIDITY["dmw_recruit_authority"]) if license_to_recruit_path else None
    print("[v0] Document expiry dates calculated")

    # Validate base files
    if not all([company_logo_path, business_permit_path, philiobnet_path, job_orders_path]):
        return False, "Please upload all required base documents."

    # Hash password if provided, otherwise keep None
    password_hash = generate_password_hash(
        employer_data["password"]) if employer_data["password"] else None
    print("[v0] Password hashed successfully" if password_hash else "[v0] No password provided yet")

    # Insert into database
    conn = create_connection()
    if not conn:
        return False, "Database connection failed."

    query = """
        INSERT INTO employers (
            employer_name, industry, recruitment_type, contact_person, phone, email,
            street, barangay, city, province,
            company_logo_path, business_permit_path, business_permit_uploaded_at, business_permit_expiry, philiobnet_registration_path, philiobnet_uploaded_at, philiobnet_registration_expiry, job_orders_of_client_path, job_orders_uploaded_at, job_orders_expiry,
            dole_no_pending_case_path, dole_no_pending_uploaded_at, dole_no_pending_case_expiry, dole_authority_to_recruit_path, dole_authority_uploaded_at, dole_authority_expiry,
            dmw_no_pending_case_path, dmw_no_pending_uploaded_at, dmw_no_pending_case_expiry, license_to_recruit_path, license_to_recruit_uploaded_at, license_to_recruit_expiry,
            password_hash, temp_password, status, is_active,
            accepted_terms, accepted_terms_at, must_change_password
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 1, NOW(), %s
        )
    """

    params = (
        employer_data["employer_name"], employer_data["industry"], employer_data["recruitment_type"],
        employer_data["contact_person"], employer_data["phone"], employer_data["email"],
        employer_data["street"], employer_data["barangay"], employer_data["city"], employer_data["province"],
        company_logo_path, business_permit_path, business_permit_uploaded_at, business_permit_expiry, philiobnet_path, philiobnet_uploaded_at, philiobnet_expiry, job_orders_path, job_orders_uploaded_at, job_orders_expiry,
        dole_no_pending_path, dole_no_pending_uploaded_at, dole_no_pending_expiry, dole_authority_path, dole_authority_uploaded_at, dole_authority_expiry,
        dmw_no_pending_path, dmw_no_pending_uploaded_at, dmw_no_pending_expiry, license_to_recruit_path, license_to_recruit_uploaded_at, license_to_recruit_expiry,
        password_hash, None, 'Pending', 0, 1
    )

    result = run_query(conn, query, params)

    if result:
        print("[v0] Employer registered successfully in database")

        employer_id_row = run_query(
            conn,
            "SELECT LAST_INSERT_ID() as id",
            fetch="one"
        )
        employer_id = employer_id_row["id"] if employer_id_row else None

        # === Send confirmation email ===
        try:
            msg = Message(
                subject="PESO SmartHire - Employer Registration Received",
                sender="your_email@example.com",
                recipients=[employer_data["email"]],
            )
            msg.body = f"""
            Hello {employer_data["employer_name"]},

            Thank you for registering with PESO SmartHire.
            Your account is currently pending admin approval.

            We will notify you once it has been reviewed.

            Regards,  
            PESO SmartHire Team
            """
            mail.send(msg)
            print("[v0] Confirmation email sent successfully")
        except Exception as e:
            print(f"[v0] Failed to send confirmation email: {e}")

        # === Notification for admin ===
        recruitment_label = "Local" if employer_data["recruitment_type"] == "Local" else "International"
        notification_title = f"Employer Account Pending Approval"
        notification_message = f"1 {recruitment_label} employer registration needs approval"

        create_notification(
            notification_type='employer_approval',
            title=notification_title,
            message=notification_message,
            count=1,
            related_ids=[employer_id] if employer_id else None,
            recruitment_type=employer_data["recruitment_type"],
            employer_id=employer_id
        )

        conn.close()
        return True, "Registration successful! Your account is pending admin approval."


@employers_bp.route("/login", methods=["POST"])
def login():
    email = request.form.get("employerEmail")
    employer_id = request.form.get("employerID")
    phone = request.form.get("employerPhoneNumber")
    password = request.form.get("employerPassword")

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
    SELECT * FROM employers
    WHERE email=%s AND employer_code=%s AND phone=%s
    """
    result = run_query(conn, query, (email, employer_id, phone), fetch="one")

    if not result:
        flash("Invalid login credentials. Please check your Employer ID, email, and phone number.", "danger")
        session['login_error'] = True
        conn.close()
        return redirect(url_for("home"))

    employer = result

    if employer["status"] not in ["Approved", "Reupload"]:
        flash("Your account is pending approval. Please wait for admin confirmation.", "warning")
        session['login_error'] = True
        conn.close()
        return redirect(url_for("home"))

    if not check_password_hash(employer["password_hash"], password):
        flash("Incorrect password. Please try again.", "danger")
        session['login_error'] = True
        conn.close()
        return redirect(url_for("home"))

    # Successful login - user already changed password once
    session["employer_id"] = employer["employer_id"]
    session["employer_name"] = employer["employer_name"]
    session["employer_email"] = employer["email"]
    session["employer_status"] = employer["status"]

    # Force password change only for "Approved" status with must_change_password = 1
    if employer["status"] == "Approved" and employer.get("must_change_password") == 1:
        session["must_change_password"] = True
        flash("You must change your password before accessing your account.", "warning")
        conn.close()
        return redirect(url_for("employers.forced_password_change"))

    session["must_change_password"] = False
    conn.close()
    flash(f"Welcome back, {employer['employer_name']}!", "success")
    return redirect(url_for("employers.employer_home"))


@employers_bp.route("/change-password-required", methods=["GET", "POST"], endpoint="forced_password_change")
def forced_password_change():
    """Force user to change password on first login after approval"""
    if "employer_id" not in session:
        flash("Please log in first.", "warning")
        return redirect(url_for("home"))

    if request.method == "GET":
        # Prevent visiting the page directly
        return redirect(url_for("employers.employer_home"))

    # POST logic starts here
    employer_id = session["employer_id"]
    new_password = request.form.get("newPassword")
    confirm_password = request.form.get("confirmPassword")

    if not new_password or not confirm_password:
        flash("Please fill in all password fields.", "danger")
        # Corrected redirect
        return redirect(url_for("employers.employer_home"))

    if new_password != confirm_password:
        flash("Passwords do not match.", "danger")
        # Corrected redirect
        return redirect(url_for("employers.employer_home"))

    if len(new_password) < 8:
        flash("Password must be at least 8 characters long.", "danger")
        # Corrected redirect
        return redirect(url_for("employers.employer_home"))

    conn = create_connection()
    if not conn:
        flash("Database connection failed.", "danger")
        # Corrected redirect
        return redirect(url_for("employers.employer_home"))

    try:
        hashed_password = generate_password_hash(new_password)
        run_query(
            conn,
            """UPDATE employers
               SET password_hash = %s, must_change_password = 0
               WHERE employer_id = %s""",
            (hashed_password, employer_id)
        )
        conn.commit()
        conn.close()

        session["must_change_password"] = False

        flash("Password changed successfully! You can now access your account.", "success")
        return redirect(url_for("employers.employer_home"))

    except Exception as e:
        conn.rollback()
        conn.close()
        flash(f"Error updating password: {e}", "danger")
        # Corrected redirect
        return redirect(url_for("employers.employer_home"))


# ===== Helper Functions =====
def check_reupload_restriction():
    """Redirect Reupload status employers to account-security page only."""
    if session.get("employer_status") == "Reupload":
        return True
    return False


# ===== Employer Navigation Pages =====
@employers_bp.route("/home")
def employer_home():
    if "employer_id" not in session:
        flash("Please log in to access this page.", "warning")
        return redirect(url_for("home"))

    # Restrict Reupload status employers
    if check_reupload_restriction():
        flash("Please complete your document reupload first.", "warning")
        return redirect(url_for("employers.account_security"))

    return render_template("Employer/employer_home.html")


@employers_bp.route("/notifications")
def notifications():
    if "employer_id" not in session:
        flash("Please log in to access this page.", "warning")
        return redirect(url_for("home"))

    # Restrict Reupload status employers
    if check_reupload_restriction():
        flash("Please complete your document reupload first.", "warning")
        return redirect(url_for("employers.account_security"))

    return render_template("Employer/notifications.html")


@employers_bp.route("/account-security", methods=["GET", "POST"])
def account_security():
    """Display employer account and security page."""
    if "employer_id" not in session:
        flash("Please log in to access this page.", "warning")
        return redirect(url_for("home"))

    employer_id = session["employer_id"]
    conn = create_connection()
    if not conn:
        flash("Database connection failed.", "danger")
        return redirect(url_for("employers.employer_home"))

    # --- FETCH EMPLOYER FIRST ---
    try:
        employer = run_query(
            conn,
            "SELECT * FROM employers WHERE employer_id = %s",
            (employer_id,),
            fetch="one"
        )
    except Exception as e:
        print(f"[account_security] Error fetching employer data: {e}")
        import traceback
        traceback.print_exc()
        flash(f"Error fetching employer data: {e}", "danger")
        conn.close()
        return redirect(url_for("employers.employer_home"))

    if not employer:
        flash("Employer not found.", "danger")
        conn.close()
        return redirect(url_for("employers.employer_home"))

    if request.method == "POST":
        try:
            # Store the CURRENT recruitment type to compare
            current_recruitment_type = employer.get("recruitment_type")

            # --- Fetch form data
            employer_name = request.form.get("employer_name", "")
            industry = request.form.get("industry", "")
            recruitment_type = request.form.get("recruitment_type", "")
            contact_person = request.form.get("contact_person", "")
            phone = request.form.get("phone", "")
            email = request.form.get("email", "")
            street = request.form.get("street", "")
            barangay = request.form.get("barangay", "")
            city = request.form.get("city", "")
            province = request.form.get("province", "")

            print(
                f"[account_security] POST received - employer_id: {employer_id}, recruitment_type: {recruitment_type}"
            )

            new_recruitment_type = request.form.get("recruitment_type", "")
            recruitment_type_changed = (
                new_recruitment_type != employer.get("recruitment_type"))
            if recruitment_type_changed:
                old_type = employer["recruitment_type"]
                new_type = recruitment_type
                print(
                    f"[account_security] Recruitment type change detected: {old_type} -> {new_type}"
                )

            # STEP 1: Handle file uploads FIRST (before recruitment type validation)
            company_logo_file = request.files.get("company_logo")
            business_permit_file = request.files.get("business_permit")
            philiobnet_registration_file = request.files.get(
                "philiobnet_registration")
            job_orders_file = request.files.get("job_orders")
            dole_no_pending_file = request.files.get("dole_no_pending")
            dole_authority_file = request.files.get("dole_authority")
            dmw_no_pending_file = request.files.get("dmw_no_pending")
            license_to_recruit_file = request.files.get("license_to_recruit")

            # --- File upload helper
            def handle_upload(file, current_path, folder):
                if file and file.filename:
                    # Normalize stored path to avoid issues with leading slashes
                    if current_path:
                        try:
                            normalized = current_path.lstrip('/\\')
                            old_path = os.path.normpath(
                                os.path.join("static", normalized))
                            if os.path.exists(old_path):
                                os.remove(old_path)
                                print(
                                    f"[account_security] Deleted old file: {old_path}")
                            else:
                                print(
                                    f"[account_security] Old file not found for deletion: {old_path}")
                        except Exception as e:
                            print(
                                f"[account_security] Error deleting old file {current_path}: {e}")
                            import traceback
                            traceback.print_exc()
                    return save_file(file, folder)
                return current_path

            company_logo_path = handle_upload(
                company_logo_file, employer["company_logo_path"], "employer_logo")
            business_permit_path = handle_upload(
                business_permit_file, employer["business_permit_path"], "business_permits")
            philiobnet_registration_path = handle_upload(
                philiobnet_registration_file, employer["philiobnet_registration_path"], "philiobnet_registrations")
            job_orders_path = handle_upload(
                job_orders_file, employer["job_orders_of_client_path"], "job_orders")
            dole_no_pending_path = handle_upload(
                dole_no_pending_file, employer["dole_no_pending_case_path"], "dole_documents")
            dole_authority_path = handle_upload(
                dole_authority_file, employer["dole_authority_to_recruit_path"], "dole_documents")
            dmw_no_pending_path = handle_upload(
                dmw_no_pending_file, employer["dmw_no_pending_case_path"], "dmw_documents")
            license_to_recruit_path = handle_upload(
                license_to_recruit_file, employer["license_to_recruit_path"], "dmw_documents")

            print(f"[account_security] Files processed")

            # If recruitment type changed, validate required docs using temp paths
            if recruitment_type_changed:
                temp_data = {
                    "dole_no_pending_case_path": dole_no_pending_path or employer.get("dole_no_pending_case_path"),
                    "dole_authority_to_recruit_path": dole_authority_path or employer.get("dole_authority_to_recruit_path"),
                    "dmw_no_pending_case_path": dmw_no_pending_path or employer.get("dmw_no_pending_case_path"),
                    "license_to_recruit_path": license_to_recruit_path or employer.get("license_to_recruit_path"),
                }

                print(f"[account_security] Document paths before validation:")
                print(
                    f"[account_security]   DOLE No Pending: {temp_data['dole_no_pending_case_path']}")
                print(
                    f"[account_security]   DOLE Authority: {temp_data['dole_authority_to_recruit_path']}")
                print(
                    f"[account_security]   DMW No Pending: {temp_data['dmw_no_pending_case_path']}")
                print(
                    f"[account_security]   License to Recruit: {temp_data['license_to_recruit_path']}")

                from .recruitment_change_handler import validate_recruitment_type_change
                is_valid, missing_docs, error_msg = validate_recruitment_type_change(
                    employer_id, conn, new_type, temp_data
                )

                if not is_valid:
                    print(
                        f"[account_security] ✗ Validation failed: {error_msg}")
                    flash(error_msg, "danger")
                    conn.close()
                    return redirect(url_for("employers.account_security"))

                print(
                    f"[account_security] ✓ Validation passed for recruitment type change")

            # Track which files are ACTUALLY new vs. just being cleared
            expiry_updates = {}
            warning_reset_updates = {}
            uploaded_at_updates = {}

            if recruitment_type_changed:
                recruitment_uploaded_at_updates = {}

                if dole_no_pending_path:
                    recruitment_uploaded_at_updates["dole_no_pending_uploaded_at"] = datetime.now(
                    )
                if dole_authority_path:
                    recruitment_uploaded_at_updates["dole_authority_uploaded_at"] = datetime.now(
                    )
                if dmw_no_pending_path:
                    recruitment_uploaded_at_updates["dmw_no_pending_uploaded_at"] = datetime.now(
                    )
                if license_to_recruit_path:
                    recruitment_uploaded_at_updates["license_to_recruit_uploaded_at"] = datetime.now(
                    )

                # Add to the main uploaded_at_updates
                uploaded_at_updates.update(recruitment_uploaded_at_updates)

            # These will be managed by the recruitment handler's backup system
            recruitment_docs_update = {}

            # UPDATE: Process recruitment docs REGARDLESS of whether type is changing
            # When changing types, new files should go to regular columns, not old_*
            RECRUITMENT_DOCUMENTS = {
                "dole_no_pending_case_path": "dole_no_pending_case_expiry",
                "dole_authority_to_recruit_path": "dole_authority_expiry",
                "dmw_no_pending_case_path": "dmw_no_pending_case_expiry",
                "license_to_recruit_path": "license_to_recruit_expiry"
            }

            for file_field, expiry_field in RECRUITMENT_DOCUMENTS.items():
                file_path = locals().get(file_field)
                old_expiry = employer.get(expiry_field)
                old_file_path = employer.get(file_field)

                # A file is "new" only if: (1) path changed AND (2) new path is not None
                file_was_reuploaded = (file_path != old_file_path) and (
                    file_path is not None)

                uploaded_at_field = EXPIRY_TO_UPLOADED_AT.get(expiry_field)
                if not uploaded_at_field:
                    print(
                        f"[account_security] Warning: No uploaded_at field for {expiry_field}")
                    continue

                if file_was_reuploaded:
                    # NEW FILE uploaded - set new expiry and update timestamp
                    months_valid = DOCUMENT_VALIDITY[doc_key_map[file_field]]
                    expiry_updates[expiry_field] = get_expiry_date(
                        months_valid)

                    # Reset warning flag
                    warning_field = expiry_field.replace(
                        "_expiry", "_warning_sent")
                    warning_reset_updates[warning_field] = 0

                    uploaded_at_updates[uploaded_at_field] = datetime.now()
                    print(
                        f"[account_security] Recruitment file uploaded: {file_field}, updating expiry & timestamp")

                    recruitment_docs_update[file_field] = file_path
                else:
                    # File NOT changed - preserve old values
                    warning_field = expiry_field.replace(
                        "_expiry", "_warning_sent")
                    if old_file_path:
                        expiry_updates[expiry_field] = old_expiry
                        warning_reset_updates[warning_field] = employer.get(
                            warning_field)
                        uploaded_at_updates[uploaded_at_field] = employer.get(
                            uploaded_at_field)
                        recruitment_docs_update[file_field] = old_file_path

            # Do NOT touch recruitment-type-specific documents (DOLE/DMW) - the handler will manage them
            # This prevents unintended updates to fields that shouldn't change
            BASE_DOCUMENTS = {
                "business_permit_path": "business_permit_expiry",
                "philiobnet_registration_path": "philiobnet_registration_expiry",
                "job_orders_of_client_path": "job_orders_expiry"
            }

            for file_field, expiry_field in BASE_DOCUMENTS.items():
                file_path = locals().get(file_field)
                old_expiry = employer.get(expiry_field)
                old_file_path = employer.get(file_field)

                # A file is "new" only if: (1) path changed AND (2) new path is not None
                file_was_reuploaded = (file_path != old_file_path) and (
                    file_path is not None)

                uploaded_at_field = EXPIRY_TO_UPLOADED_AT.get(expiry_field)
                if not uploaded_at_field:
                    print(
                        f"[account_security] Warning: No uploaded_at field for {expiry_field}")
                    continue

                if file_was_reuploaded:
                    # NEW FILE uploaded - set new expiry and update timestamp
                    months_valid = DOCUMENT_VALIDITY[doc_key_map[file_field]]
                    expiry_updates[expiry_field] = get_expiry_date(
                        months_valid)

                    # Reset warning flag
                    warning_field = expiry_field.replace(
                        "_expiry", "_warning_sent")
                    warning_reset_updates[warning_field] = 0

                    uploaded_at_updates[uploaded_at_field] = datetime.now()
                    print(
                        f"[account_security] Base file re-uploaded: {file_field}, updating expiry & timestamp")
                # This prevents touching updated_at when files haven't changed
                else:
                    # File NOT changed - DON'T add to update dicts (leave them out entirely)
                    # This prevents the database from touching the row's updated_at timestamp
                    warning_field = expiry_field.replace(
                        "_expiry", "_warning_sent")
                    # Only track warning/expiry if the document exists
                    if old_file_path:
                        expiry_updates[expiry_field] = old_expiry
                        warning_reset_updates[warning_field] = employer.get(
                            warning_field)
                        uploaded_at_updates[uploaded_at_field] = employer.get(
                            uploaded_at_field)

            # These will be managed by the recruitment handler's backup system
            recruitment_docs_update = {}
            if not recruitment_type_changed:
                # Only update recruitment docs if NOT changing type (handler will manage these during change)
                RECRUITMENT_DOCUMENTS = {
                    "dole_no_pending_case_path": "dole_no_pending_case_expiry",
                    "dole_authority_to_recruit_path": "dole_authority_expiry",
                    "dmw_no_pending_case_path": "dmw_no_pending_case_expiry",
                    "license_to_recruit_path": "license_to_recruit_expiry"
                }

                for file_field, expiry_field in RECRUITMENT_DOCUMENTS.items():
                    file_path = locals().get(file_field)
                    old_expiry = employer.get(expiry_field)
                    old_file_path = employer.get(file_field)

                    file_was_reuploaded = (file_path != old_file_path) and (
                        file_path is not None)

                    uploaded_at_field = EXPIRY_TO_UPLOADED_AT.get(expiry_field)
                    if not uploaded_at_field:
                        continue

                    if file_was_reuploaded:
                        months_valid = DOCUMENT_VALIDITY[doc_key_map[file_field]]
                        recruitment_docs_update[expiry_field] = get_expiry_date(
                            months_valid)

                        warning_field = expiry_field.replace(
                            "_expiry", "_warning_sent")
                        warning_reset_updates[warning_field] = 0

                        recruitment_docs_update[uploaded_at_field] = datetime.now(
                        )

                # Merge recruitment docs updates
                expiry_updates.update(recruitment_docs_update)

            documents_to_reupload_list = request.form.getlist(
                "documents_to_reupload")
            documents_to_reupload_json = json.dumps(
                documents_to_reupload_list) if documents_to_reupload_list else None

            # -------------------------------------------
            # STEP A: UPDATE employer NON-recruitment fields only
            # (do NOT touch recruitment_type/old_recruitment_type/status/is_active here)
            # -------------------------------------------

            if recruitment_type_changed:
                # Skip recruitment document expiries/warnings/uploaded_at when changing type
                # The handler will manage these via backup system
                update_query = """
                    UPDATE employers SET
                        employer_name=%s,
                        industry=%s,
                        contact_person=%s,
                        phone=%s,
                        email=%s,
                        street=%s,
                        barangay=%s,
                        city=%s,
                        province=%s,
                        company_logo_path=%s,
                        business_permit_path=%s,
                        philiobnet_registration_path=%s,
                        job_orders_of_client_path=%s,
                        dole_no_pending_case_path=%s,
                        dole_authority_to_recruit_path=%s,
                        dmw_no_pending_case_path=%s,
                        license_to_recruit_path=%s,
                        business_permit_expiry=%s,
                        philiobnet_registration_expiry=%s,
                        job_orders_expiry=%s,
                        business_permit_warning_sent=%s,
                        philiobnet_registration_warning_sent=%s,
                        job_orders_warning_sent=%s,
                        business_permit_uploaded_at=%s,
                        philiobnet_uploaded_at=%s,
                        job_orders_uploaded_at=%s,
                        documents_to_reupload=%s
                    WHERE employer_id=%s
                """

                data = (
                    employer_name, industry,
                    contact_person, phone, email,
                    street, barangay, city, province,
                    company_logo_path, business_permit_path, philiobnet_registration_path,
                    job_orders_path, dole_no_pending_path, dole_authority_path,
                    dmw_no_pending_path, license_to_recruit_path,
                    expiry_updates.get("business_permit_expiry"),
                    expiry_updates.get("philiobnet_registration_expiry"),
                    expiry_updates.get("job_orders_expiry"),
                    warning_reset_updates.get("business_permit_warning_sent"),
                    warning_reset_updates.get(
                        "philiobnet_registration_warning_sent"),
                    warning_reset_updates.get("job_orders_warning_sent"),
                    uploaded_at_updates.get("business_permit_uploaded_at"),
                    uploaded_at_updates.get("philiobnet_uploaded_at"),
                    uploaded_at_updates.get("job_orders_uploaded_at"),
                    documents_to_reupload_json,
                    employer_id
                )
            else:
                should_reset_status = True if uploaded_at_updates else False
                # Normal update: include all fields (no recruitment type change)
                update_query = """
                    UPDATE employers SET
                        employer_name=%s,
                        industry=%s,
                        contact_person=%s,
                        phone=%s,
                        email=%s,
                        street=%s,
                        barangay=%s,
                        city=%s,
                        province=%s,
                        company_logo_path=%s,
                        business_permit_path=%s,
                        philiobnet_registration_path=%s,
                        job_orders_of_client_path=%s,
                        dole_no_pending_case_path=%s,
                        dole_authority_to_recruit_path=%s,
                        dmw_no_pending_case_path=%s,
                        license_to_recruit_path=%s,
                        business_permit_expiry=%s,
                        philiobnet_registration_expiry=%s,
                        job_orders_expiry=%s,
                        dole_no_pending_case_expiry=%s,
                        dole_authority_expiry=%s,
                        dmw_no_pending_case_expiry=%s,
                        license_to_recruit_expiry=%s,
                        business_permit_warning_sent=%s,
                        philiobnet_registration_warning_sent=%s,
                        job_orders_warning_sent=%s,
                        dole_no_pending_case_warning_sent=%s,
                        dole_authority_warning_sent=%s,
                        dmw_no_pending_case_warning_sent=%s,
                        license_to_recruit_warning_sent=%s,
                        business_permit_uploaded_at=%s,
                        philiobnet_uploaded_at=%s,
                        job_orders_uploaded_at=%s,
                        dole_no_pending_uploaded_at=%s,
                        dole_authority_uploaded_at=%s,
                        dmw_no_pending_uploaded_at=%s,
                        license_to_recruit_uploaded_at=%s,
                        documents_to_reupload=%s,
                        
                        -- NEW: FORCE STATUS RESET IF FILE UPLOADED
                        status = CASE WHEN %s = 1 THEN 'Pending' ELSE status END,
                        is_active = CASE WHEN %s = 1 THEN 0 ELSE is_active END
                        
                    WHERE employer_id=%s
                """

                data = (
                    employer_name, industry,
                    contact_person, phone, email,
                    street, barangay, city, province,
                    company_logo_path, business_permit_path, philiobnet_registration_path,
                    job_orders_path, dole_no_pending_path, dole_authority_path,
                    dmw_no_pending_path, license_to_recruit_path,
                    expiry_updates.get("business_permit_expiry"),
                    expiry_updates.get("philiobnet_registration_expiry"),
                    expiry_updates.get("job_orders_expiry"),
                    expiry_updates.get("dole_no_pending_case_expiry"),
                    expiry_updates.get("dole_authority_expiry"),
                    expiry_updates.get("dmw_no_pending_case_expiry"),
                    expiry_updates.get("license_to_recruit_expiry"),
                    warning_reset_updates.get("business_permit_warning_sent"),
                    warning_reset_updates.get(
                        "philiobnet_registration_warning_sent"),
                    warning_reset_updates.get("job_orders_warning_sent"),
                    warning_reset_updates.get(
                        "dole_no_pending_case_warning_sent"),
                    warning_reset_updates.get("dole_authority_warning_sent"),
                    warning_reset_updates.get(
                        "dmw_no_pending_case_warning_sent"),
                    warning_reset_updates.get(
                        "license_to_recruit_warning_sent"),
                    uploaded_at_updates.get("business_permit_uploaded_at"),
                    uploaded_at_updates.get("philiobnet_uploaded_at"),
                    uploaded_at_updates.get("job_orders_uploaded_at"),
                    uploaded_at_updates.get("dole_no_pending_uploaded_at"),
                    uploaded_at_updates.get("dole_authority_uploaded_at"),
                    uploaded_at_updates.get("dmw_no_pending_uploaded_at"),
                    uploaded_at_updates.get("license_to_recruit_uploaded_at"),
                    documents_to_reupload_json,

                    # Pass the flag twice (once for status, once for is_active)
                    1 if should_reset_status else 0,
                    1 if should_reset_status else 0,

                    employer_id
                )

            print(f"[account_security] Executing non-recruitment UPDATE query")
            cursor = conn.cursor()
            cursor.execute(update_query, data)
            conn.commit()
            print(
                f"[account_security] ✓ Non-recruitment UPDATE committed (files saved)")

            # -----------
            # STEP B: If recruitment type changed, validate then call single handler that will
            #          set old_recruitment_type, recruitment_type, status, is_active, and commit.
            # -----------
            if recruitment_type_changed:
                print(
                    f"[account_security] Processing recruitment type change: {old_type} -> {new_type}"
                )

                uploaded_paths = {
                    'dole_no_pending_case_path': dole_no_pending_path,
                    'dole_authority_to_recruit_path': dole_authority_path,
                    'dmw_no_pending_case_path': dmw_no_pending_path,
                    'license_to_recruit_path': license_to_recruit_path,
                }

                # This handler GUARANTEES old_recruitment_type is set to the current value before change
                result = handle_recruitment_type_change(
                    employer_id, conn, new_type, uploaded_paths)

                if result["success"]:
                    # handler already committed (it calls conn.commit()). We still have to close session and redirect
                    print(
                        f"[account_security] ✓ Recruitment type change handled successfully")
                    conn.close()
                    session.clear()
                    flash(
                        "Recruitment type changed — Your documents will be set for verification. You cannot access your account in the mean time.", "info")
                    return redirect(url_for("home"))
                else:
                    # handler failed: only the recruitment handler needs rollback, files are already saved
                    error_msg = result.get('message', 'Unknown error')
                    if 'error' in result:
                        error_msg += f" - {result['error']}"
                    print(
                        f"[account_security] ✗ Recruitment type change failed: {error_msg}")
                    conn.close()
                    flash(error_msg, "danger")
                    return redirect(url_for("employers.account_security"))
            else:
                # No recruitment change: commit only the non-recruitment update
                # (already committed above)
                print(
                    f"[account_security] ✓ Database non-recruitment UPDATE committed successfully")
                flash(
                    "Your account details and files have been updated successfully.", "success")
                conn.close()
                return redirect(url_for("employers.account_security"))

        except Exception as e:
            print(f"[account_security] ✗ Exception in POST handler: {e}")
            import traceback
            traceback.print_exc()
            try:
                conn.rollback()
            except Exception:
                pass
            flash(f"Error updating information: {e}", "danger")
            conn.close()
            return redirect(url_for("employers.account_security"))

    # --- RE-FETCH EMPLOYER FOR GET REQUEST ---
    try:
        employer = run_query(
            conn,
            "SELECT * FROM employers WHERE employer_id = %s",
            (employer_id,),
            fetch="one"
        )

        expiring_docs = {}
        if employer:
            # List of expiry columns in DB
            expiry_columns = {
                "business_permit": "business_permit_expiry",
                "philjobnet": "philiobnet_registration_expiry",
                "job_order": "job_orders_expiry",
                "dole_no_pending_case": "dole_no_pending_case_expiry",
                "dole_recruit_authority": "dole_authority_expiry",
                "dmw_no_pending_case": "dmw_no_pending_case_expiry",
                "dmw_recruit_authority": "license_to_recruit_expiry",
            }

            for key, db_col in expiry_columns.items():
                expiry_val = employer.get(db_col)
                # It is editable if it is ALREADY expired OR if it WILL expire in 7 days
                is_editable = is_document_expired(
                    expiry_val) or will_expire_in_7_days(expiry_val)
                expiring_docs[key] = is_editable

        # Load reupload document list (if applicable)
        documents_to_reupload = []
        if employer and employer.get("documents_to_reupload"):
            try:
                documents_to_reupload = json.loads(
                    employer["documents_to_reupload"])
            except Exception as e:
                print(
                    f"[account_security] Invalid JSON in documents_to_reupload: {e}")
                documents_to_reupload = []

    except Exception as e:
        print(f"[account_security] Error re-fetching employer: {e}")
        import traceback
        traceback.print_exc()
        flash(f"Error loading employer data: {e}", "danger")

    finally:
        conn.close()

    # Pass parsed docs list to template
    return render_template(
        "Employer/acc&secu.html",
        employer=employer,
        employer_status=employer.get("status") if employer else None,
        documents_to_reupload=documents_to_reupload,
        expiring_docs=expiring_docs  # <--- PASS THIS
    )


@employers_bp.route("/submit-reupload", methods=["POST"])
def submit_reupload():
    """Handle employer document reupload workflow."""
    if "employer_id" not in session:
        return jsonify({"success": False, "message": "Not authenticated"}), 401

    employer_id = session["employer_id"]

    # Collect uploaded files
    files_to_upload = {k: v for k,
                       v in request.files.items() if v and v.filename}

    print(
        f"[submit_reupload] Files received from form: {list(files_to_upload.keys())}")

    if not files_to_upload:
        flash("No files selected for reupload.", "warning")
        return redirect(url_for("employers.account_security"))

    conn = create_connection()
    if not conn:
        flash("Database connection failed.", "danger")
        return redirect(url_for("employers.account_security"))

    try:
        # Fetch current employer data
        employer_data = run_query(
            conn,
            "SELECT * FROM employers WHERE employer_id = %s",
            (employer_id,),
            fetch="one"
        )
        if not employer_data:
            flash("Employer not found.", "danger")
            return redirect(url_for("employers.account_security"))

        file_mapping = {
            "company_logo": ("company_logo_path", "employer_logo"),
            "business_permit": ("business_permit_path", "business_permits"),
            "philiobnet_registration": ("philiobnet_registration_path", "philiobnet_registrations"),
            "job_orders_of_client": ("job_orders_of_client_path", "job_orders"),
            "dole_no_pending_case": ("dole_no_pending_case_path", "dole_documents"),
            "dole_authority_to_recruit": ("dole_authority_to_recruit_path", "dole_documents"),
            "dmw_no_pending_case": ("dmw_no_pending_case_path", "dmw_documents"),
            "license_to_recruit": ("license_to_recruit_path", "dmw_documents"),
        }

        new_files = {}  # store new file paths
        files_to_delete = {}  # store old files to delete after successful upload

        for key, file in files_to_upload.items():
            if key not in file_mapping:
                print(
                    f"[submit_reupload] Warning: Unknown file key '{key}', skipping")
                continue

            db_field, folder = file_mapping[key]

            if file and file.filename:
                # Save new file FIRST
                new_path = save_file(file, folder)
                if new_path:
                    new_files[db_field] = new_path
                    # Track old file for deletion only after new save succeeds
                    old_path = employer_data.get(db_field)
                    if old_path:
                        files_to_delete[db_field] = old_path
                    print(f"[submit_reupload] New file saved: {new_path}")
                else:
                    flash(
                        f"Failed to upload {key}. Please try again.", "danger")
                    return redirect(url_for("employers.account_security"))

        # Prepare UPDATE data, keeping old files if no new upload
        required_fields = [
            "company_logo_path",
            "business_permit_path",
            "philiobnet_registration_path",
            "job_orders_of_client_path",
            "dole_no_pending_case_path",
            "dole_authority_to_recruit_path",
            "dmw_no_pending_case_path",
            "license_to_recruit_path"
        ]

        update_data = {}
        for field in required_fields:
            update_data[field] = new_files.get(
                field) or employer_data.get(field)

        # Calculate expiry and reset warnings (AFTER update_data exists)
        expiry_updates = {}
        warning_reset_updates = {}
        uploaded_at_updates = {}

        for file_field, expiry_field in UPLOAD_TO_EXPIRY.items():
            if file_field not in update_data:
                print(
                    f"[submit_reupload] Skipping {file_field}, not in update_data")
                continue

            file_path = update_data[file_field]
            old_path = employer_data.get(file_field)
            old_expiry = employer_data.get(expiry_field)

            uploaded_at_field = EXPIRY_TO_UPLOADED_AT.get(expiry_field)
            if not uploaded_at_field:
                print(
                    f"[submit_reupload] Warning: No uploaded_at mapping for {expiry_field}")
                continue

            # Check if a new file was actually uploaded for this field
            file_was_reuploaded = (file_path != old_path) and (
                file_path is not None)

            if file_was_reuploaded:  # New file uploaded
                months_valid = DOCUMENT_VALIDITY[doc_key_map[file_field]]
                expiry_updates[expiry_field] = get_expiry_date(months_valid)

                warning_field = expiry_field.replace(
                    "_expiry", "_warning_sent")
                warning_reset_updates[warning_field] = 0

                uploaded_at_updates[uploaded_at_field] = datetime.now()
            else:  # File not changed (either unchanged or cleared)
                expiry_updates[expiry_field] = old_expiry

                warning_field = expiry_field.replace(
                    "_expiry", "_warning_sent")
                warning_reset_updates[warning_field] = employer_data.get(
                    warning_field)

                # Keep old timestamp if not re-uploaded
                uploaded_at_updates[uploaded_at_field] = employer_data.get(
                    uploaded_at_field)

        # Merge into update_data
        update_data.update(expiry_updates)
        update_data.update(warning_reset_updates)
        update_data.update(uploaded_at_updates)

        # Reset status to Pending for re-review
        update_data["status"] = "Pending"
        update_data["is_active"] = 0

        set_clause = ", ".join([f"{k}=%s" for k in update_data.keys()])
        values = list(update_data.values()) + [employer_id]

        result = run_query(
            conn,
            f"UPDATE employers SET {set_clause} WHERE employer_id=%s",
            values
        )

        if not result or result == 0:
            print(
                f"[submit_reupload] Database update failed - no rows affected for employer {employer_id}")
            flash("Failed to update employer record. No changes were saved.", "danger")
            conn.rollback()
            return redirect(url_for("employers.account_security"))

        conn.commit()
        print(
            f"[submit_reupload] Database committed successfully for employer {employer_id}")

        # NOW delete old files only after successful commit
        for db_field, old_path in files_to_delete.items():
            try:
                normalized = old_path.lstrip('/\\')
                full_old_path = os.path.normpath(
                    os.path.join("static", normalized))
                if os.path.exists(full_old_path):
                    os.remove(full_old_path)
                    print(
                        f"[submit_reupload] Deleted old file after DB commit: {full_old_path}")
            except Exception as e:
                print(
                    f"[submit_reupload] Error deleting old file {old_path}: {e}")

        # Update notifications for admin
        run_query(
            conn,
            """
            UPDATE notifications
            SET title=%s, message=%s, is_read=0, updated_at=NOW()
            WHERE employer_id=%s AND notification_type='employer_approval'
            """,
            (
                "Employer Documents Reuploaded",
                "An employer has reuploaded their required documents and is ready for reassessment.",
                employer_id
            )
        )
        conn.commit()

        flash("Documents reuploaded successfully! Please wait for admin review.", "success")
        return redirect(url_for("home"))

    except Exception as e:
        conn.rollback()
        print(f"[submit_reupload] Exception occurred: {e}")
        import traceback
        traceback.print_exc()
        flash(f"Error during reupload: {e}", "danger")
        return redirect(url_for("employers.account_security"))

    finally:
        conn.close()


@employers_bp.route("/employers/terms", methods=["GET", "POST"])
def employers_terms():
    if request.method == "POST":
        if not request.form.get("accepted_terms"):
            flash("You must accept the Terms and Conditions to proceed.", "error")
            return redirect(url_for("employers.employers_terms"))

        session["accepted_terms"] = True
        session["accepted_terms_at"] = datetime.utcnow().isoformat()
        session["accepted_terms_for"] = "employer"

        return redirect(url_for("employers.register"))

    return render_template("Landing_Page/t_and_c_employers.html")


@employers_bp.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        print(f"[v0] Employer registration form submitted")

        result = register_employer(request.form, request.files)
        if result is None:
            success, message = False, "Registration failed unexpectedly."
        else:
            success, message = result

        flash(message, "success" if success else "danger")

        if success:
            print(f"[v0] Redirecting to home page")
            return redirect(url_for("home"))
        else:
            print(f"[v0] Registration failed, staying on registration page")
            return redirect(url_for("employers.register"))

    return render_template("Landing_Page/employer_registration.html")


@employers_bp.route("/deactivate", methods=["POST"])
def deactivate_employer_account():
    if "employer_id" not in session:
        return jsonify({"success": False, "message": "Not logged in"}), 401

    employer_id = session["employer_id"]

    conn = create_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute("""
            SELECT employer_id AS id, employer_name AS name, email, password_hash AS password, phone
            FROM employers
            WHERE employer_id = %s
        """, (employer_id,))
        employer = cursor.fetchone()

        if not employer:
            return jsonify({"success": False, "message": "Employer not found"}), 404

        cursor.execute(
            "DELETE FROM deactivated_users WHERE id = %s", (employer["id"],))
        cursor.execute("""
            INSERT INTO deactivated_users (id, name, email, password, phone, deactivated_at)
            VALUES (%s, %s, %s, %s, %s, NOW())
        """, (
            employer["id"],
            employer["name"],
            employer["email"],
            employer["password"],
            employer["phone"]
        ))

        cursor.execute("""
            UPDATE employers
            SET is_active = 0, deactivated_at = NOW()
            WHERE employer_id = %s
        """, (employer_id,))

        conn.commit()
        session.clear()

        return jsonify({
            "success": True,
            "message": "Your account has been deactivated and will be permanently deleted after 30 days."
        })

    except Exception as e:
        conn.rollback()
        return jsonify({"success": False, "message": f"Database error: {str(e)}"}), 500

    finally:
        cursor.close()
        conn.close()


@employers_bp.route("/reactivate", methods=["POST"])
def reactivate_employer_account():
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
            UPDATE employers
            SET is_active = 1, deactivated_at = NULL
            WHERE employer_id = %s
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


# ===== Job Posting Route =====
@employers_bp.route("/create_job", methods=["POST"])
def create_job():
    # 1. Check Login
    if "employer_id" not in session:
        flash("Please log in to create a job post.", "warning")
        return redirect(url_for("home"))

    # 2. Define employer_id immediately
    employer_id = session["employer_id"]

    # 3. Open Connection NOW (before using it)
    conn = create_connection()
    if not conn:
        flash("Database connection failed.", "danger")
        return redirect(url_for("employers.employer_home"))

    try:
        # 4. Check Employer Status
        employer_status = run_query(
            conn,
            "SELECT status, is_active FROM employers WHERE employer_id = %s",
            (employer_id,),
            fetch="one"
        )

        if not employer_status or employer_status['is_active'] != 1 or employer_status['status'] != 'Approved':
            # Connection is open, so we must close it before returning
            conn.close()
            session.clear()
            flash("Your account is suspended or inactive. Action denied.", "danger")
            return redirect(url_for("home"))

        # 5. Get Form Data
        job_position = request.form.get("job_position", "").strip()
        work_schedule = request.form.get("work_schedule", "").strip()
        num_vacancy = request.form.get("num_vacancy", "").strip()
        min_salary = request.form.get("min_salary", "").strip()
        max_salary = request.form.get("max_salary", "").strip()
        job_description = request.form.get("job_description", "").strip()
        qualifications = request.form.get("qualifications", "").strip()

        # 6. Basic Validation
        if not all([job_position, work_schedule, num_vacancy, min_salary, max_salary, job_description, qualifications]):
            conn.close()  # distinct close because we are returning early
            flash("All fields are required.", "danger")
            return redirect(url_for("employers.employer_home"))

        # 7. Numeric Validation
        try:
            num_vacancy = int(num_vacancy)
            min_salary = float(min_salary)
            max_salary = float(max_salary)

            if num_vacancy <= 0:
                raise ValueError("Number of vacancies must be greater than 0.")
            if min_salary <= 0 or max_salary <= 0:
                raise ValueError("Salary values must be greater than 0.")
            if max_salary < min_salary:
                raise ValueError(
                    "Maximum salary cannot be less than minimum salary.")

        except ValueError as ve:
            conn.close()  # distinct close because we are returning early
            # Catch custom ValueErrors or conversion errors
            msg = str(ve) if str(
                ve) else "Invalid number format for vacancies or salary."
            flash(msg, "danger")
            return redirect(url_for("employers.employer_home"))

        # 8. Insert Job
        query = """
            INSERT INTO jobs
            (employer_id, job_position, work_schedule, num_vacancy, 
             min_salary, max_salary, job_description, qualifications, status, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'active', NOW())
        """

        run_query(conn, query, (
            employer_id, job_position, work_schedule, num_vacancy,
            min_salary, max_salary, job_description, qualifications
        ))

        conn.commit()
        flash("Job posted successfully!", "success")

    except Exception as e:
        conn.rollback()
        flash(f"Error creating job: {str(e)}", "danger")

    finally:
        # 9. Ensure connection always closes
        if conn:
            conn.close()

    return redirect(url_for("employers.employer_home"))


@employers_bp.route("/application_management")
def application_management():
    if "employer_id" not in session:
        return redirect(url_for("login"))

    employer_id = session["employer_id"]
    conn = create_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("""
        SELECT j.*,
            (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.job_id) AS applicant_count
        FROM jobs j
        WHERE j.employer_id = %s AND j.status != 'deleted'
    """, (employer_id,))
    jobs = cursor.fetchall()
    conn.close()

    return render_template("Employer/application_management.html", jobs=jobs)


@employers_bp.route("/update_job_status/<int:job_id>/<new_status>", methods=["POST"])
def update_job_status_route(job_id, new_status):
    valid_statuses = ["active", "inactive", "archived", "deleted"]
    if new_status not in valid_statuses:
        return jsonify({"success": False, "message": "Invalid status."})
    return update_job_status(job_id, new_status)


def update_job_status(job_id, new_status):
    conn = create_connection()
    if not conn:
        return jsonify({"success": False, "message": "Database connection failed."})

    try:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE jobs SET status = %s WHERE job_id = %s", (new_status, job_id))
        conn.commit()
        return jsonify({"success": True, "message": f"Job status updated to {new_status}."})
    except Exception as e:
        print("Error updating job status:", e)
        conn.rollback()
        return jsonify({"success": False, "message": "Failed to update job status."})
    finally:
        conn.close()


@employers_bp.route("/auto_deactivate_jobs")
def auto_deactivate_jobs():
    conn = create_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE jobs
        SET status = 'inactive'
        WHERE job_expiration_date < NOW() AND status = 'active'
    """)
    conn.commit()
    conn.close()
    return "Auto deactivation complete."


# -------------------------
# Return job JSON for modal
# -------------------------
@employers_bp.route("/job/<int:job_id>/json", methods=['GET'])
def get_job_json(job_id):
    """Fetch job details as JSON for edit modal (AJAX endpoint)."""
    if 'employer_id' not in session:
        return jsonify({'success': False, 'message': 'Not logged in'}), 401

    employer_id = session['employer_id']
    conn = create_connection()
    if not conn:
        return jsonify({'success': False, 'message': 'Database connection failed'}), 500

    try:
        query = """SELECT job_id, job_position, num_vacancy, min_salary, max_salary, 
                          job_description, qualifications, work_schedule, status 
                   FROM jobs WHERE job_id = %s"""
        job = run_query(conn, query, (job_id,), fetch='one')

        if not job:
            return jsonify({'success': False, 'message': 'Job not found'}), 404

        # Convert database row to dictionary
        if hasattr(job, 'keys'):
            job_dict = dict(job)
        elif isinstance(job, dict):
            job_dict = job
        else:
            job_dict = {}

        return jsonify({
            'success': True,
            'job': {
                'job_id': job_dict.get('job_id'),
                'job_position': job_dict.get('job_position'),
                'num_vacancy': job_dict.get('num_vacancy'),
                'min_salary': float(job_dict.get('min_salary', 0)),
                'max_salary': float(job_dict.get('max_salary', 0)),
                'job_description': job_dict.get('job_description'),
                'qualifications': job_dict.get('qualifications'),
                'work_schedule': job_dict.get('work_schedule'),
                'status': job_dict.get('status')
            }
        })
    except Exception as e:
        error_trace = traceback.format_exc()
        print(f"[v0] Error fetching job JSON: {str(e)}")
        print(f"[v0] Traceback: {error_trace}")
        return jsonify({'success': False, 'message': f"Error: {str(e)}"}), 500
    finally:
        if conn:
            conn.close()


@employers_bp.route('/api/job/<int:job_id>/applicants')
def get_job_applicants_api(job_id):
    """API endpoint to fetch fresh applicant list data as JSON."""
    if 'employer_id' not in session:
        return {'error': 'Unauthorized'}, 401

    employer_id = session['employer_id']
    conn = create_connection()
    if not conn:
        return {'error': 'Database connection failed'}, 500

    try:
        # Verify job belongs to this employer
        job = run_query(conn, "SELECT * FROM jobs WHERE job_id = %s AND employer_id = %s",
                        (job_id, employer_id), fetch='one')
        if not job:
            return {'error': 'Job not found'}, 404

        # Get fresh applicants data from database
        # UPDATED QUERY: Added interview_status subquery
        applicants = run_query(
            conn,
            """
            SELECT
              a.id AS id,
              a.applicant_id,
              a.status,
              ap.first_name,
              ap.last_name,
              ap.profile_pic_path,
              ap.email,
              ap.phone,
              ap.city,
              (SELECT status FROM interview_schedules WHERE application_id = a.id ORDER BY created_at DESC LIMIT 1) as interview_status
            FROM applications a
            JOIN applicants ap ON a.applicant_id = ap.applicant_id
            WHERE a.job_id = %s
            ORDER BY a.applied_at DESC
            """,
            (job_id,),
            fetch='all'
        )

        # Convert to list of dicts for JSON response
        applicants_list = []
        for app in applicants:
            applicants_list.append({
                'id': app['id'],
                'applicant_id': app['applicant_id'],
                'status': app['status'],
                'first_name': app['first_name'],
                'last_name': app['last_name'],
                'profile_pic_path': app['profile_pic_path'],
                'email': app['email'],
                'phone': app['phone'],
                'city': app['city'],
                'interview_status': app['interview_status']
            })

        return {'applicants': applicants_list}, 200
    except Exception as e:
        print(f"Error fetching applicants: {str(e)}")
        return {'error': str(e)}, 500
    finally:
        if conn:
            conn.close()


# -------------------------
# Update job via modal POST
# -------------------------


@employers_bp.route("/job/<int:job_id>/update", methods=["POST"])
def update_job(job_id):
    if "employer_id" not in session:
        return jsonify({"success": False, "message": "Not logged in"}), 401

    conn = create_connection()
    if not conn:
        return jsonify({"success": False, "message": "DB connection failed."}), 500

    try:
        form = request.form
        job_position = (form.get("ej_job_position") or "").strip()
        job_description = (form.get("ej_job_description") or "").strip()
        status = (form.get("ej_status") or "").strip()
        work_schedule = (form.get("ej_work_schedule") or "").strip()
        num_vacancy = int(form.get("ej_vacancy") or 1)
        min_salary = float(form.get("ej_min_salary") or 0)
        max_salary = float(form.get("ej_max_salary") or 0)
        qualifications = (form.get("ej_qualifications") or "").strip()

        if not job_position:
            return jsonify({"success": False, "message": "Job position is required."}), 400

        cursor = conn.cursor()
        cursor.execute("""
            UPDATE jobs
            SET job_position=%s,
                job_description=%s,
                status=%s,
                work_schedule=%s,
                num_vacancy=%s,
                min_salary=%s,
                max_salary=%s,
                qualifications=%s
            WHERE job_id=%s
        """, (
            job_position,
            job_description,
            status,
            work_schedule,
            num_vacancy,
            min_salary,
            max_salary,
            qualifications,
            job_id
        ))
        conn.commit()
        cursor.close()

        return jsonify({"success": True, "message": "Job updated successfully."})

    except Exception as e:
        current_app.logger.exception(f"Failed to update job_id={job_id}: {e}")
        return jsonify({"success": False, "message": f"Update failed: {str(e)}"}), 500
    finally:
        if conn:
            conn.close()


@employers_bp.route("/job/archive/<int:job_id>", methods=["POST"])
def archive_job(job_id):
    if "employer_id" not in session:
        return jsonify({"success": False, "message": "Not logged in"}), 401

    conn = create_connection()
    if not conn:
        return jsonify({"success": False, "message": "DB connection failed"}), 500

    try:
        cursor = conn.cursor()
        cursor.execute("SELECT status FROM jobs WHERE job_id=%s", (job_id,))
        result = cursor.fetchone()
        current_status = result[0] if result else None

        # Toggle between archived and active
        new_status = 'active' if current_status == 'archived' else 'archived'

        run_query(
            conn, "UPDATE jobs SET status=%s WHERE job_id=%s", (new_status, job_id))
        conn.commit()

        action = "unarchived" if new_status == 'active' else "archived"
        flash(f"Job post successfully {action}!", "success")

        return jsonify({"success": True, "message": f"Job post {action} successfully."})
    except Exception as e:
        conn.rollback()
        flash(f"Error: {str(e)}", "danger")
        return jsonify({"success": False, "message": f"Error: {e}"})
    finally:
        conn.close()


@employers_bp.route("/job/delete/<int:job_id>", methods=["POST"])
def delete_job(job_id):
    if "employer_id" not in session:
        return jsonify({"success": False, "message": "Not logged in"}), 401

    conn = create_connection()
    if not conn:
        return jsonify({"success": False, "message": "DB connection failed"}), 500

    try:
        cursor = conn.cursor(dictionary=True)

        # FIRST: Check if job exists and get its status
        cursor.execute("""
            SELECT status, employer_id 
            FROM jobs 
            WHERE job_id = %s
        """, (job_id,))

        job = cursor.fetchone()

        if not job:
            return jsonify({"success": False, "message": "Job not found"}), 404

        # SECOND: Verify the employer owns this job
        if job['employer_id'] != session['employer_id']:
            return jsonify({"success": False, "message": "Unauthorized to delete this job"}), 403

        # THIRD: Check if job is suspended - PREVENT DELETION
        if job['status'] == 'suspended':
            return jsonify({
                "success": False,
                "message": "Cannot delete suspended job. This job has been reported and suspended. Please contact PESO SmartHire admin."
            }), 403

        # FOURTH: Only if not suspended, proceed with deletion
        cursor.execute("DELETE FROM jobs WHERE job_id = %s", (job_id,))
        conn.commit()

        return jsonify({"success": True, "message": "Job post deleted successfully."})

    except Exception as e:
        conn.rollback()
        return jsonify({"success": False, "message": f"Error: {str(e)}"}), 500
    finally:
        if conn:
            conn.close()


@employers_bp.route("/api/notifications", methods=["GET"])
def get_notifications():
    """Fetch notifications for the current employer"""
    if "employer_id" not in session:
        return jsonify({"success": False, "notifications": []}), 401

    employer_id = session["employer_id"]
    filter_type = request.args.get('filter', 'all')

    conn = create_connection()
    if not conn:
        return jsonify({"success": False, "notifications": []})

    try:
        # [FIX] Reverted to only show job_application and report_verdict
        # report_verdict covers both:
        # 1. When the employer reported someone (Confirmation/Rejection)
        # 2. When the employer was reported and action was taken (Notice of being reported)
        query = """SELECT notification_id, notification_type, title, message, is_read, created_at, related_ids
                   FROM notifications 
                   WHERE employer_id = %s 
                   AND notification_type IN ('job_application', 'report_verdict')"""

        params = [employer_id]

        # Optional: Filter specific tabs if you want to separate them in UI later
        if filter_type == 'job_application':
            query += " AND notification_type = 'job_application'"
        elif filter_type == 'reports':
            query += " AND notification_type IN ('employer_reported', 'applicant_reported')"

        if filter_type == 'unread':
            query += " AND is_read = 0"

        query += " ORDER BY is_read ASC, created_at DESC LIMIT 50"

        notifications = run_query(conn, query, tuple(params), fetch="all")

        unread_count = run_query(
            conn,
            """SELECT COUNT(*) as count 
               FROM notifications 
               WHERE employer_id = %s 
               AND is_read = 0""",
            (employer_id,),
            fetch="one"
        )

        normalized = []
        for notif in notifications or []:
            # ... (keep existing related_ids parsing logic) ...
            related = []
            if notif.get('related_ids'):
                try:
                    related = json.loads(notif.get('related_ids'))
                except Exception:
                    related = []

            # Logic to determine where clicking the notification goes
            redirect_url = "/employers/application_management"

            # If it is a report verdict, maybe go to a specific page or stay on notifications
            if notif['notification_type'] in ['employer_reported', 'applicant_reported']:
                # Currently no specific "Report Detail" page for employers, so we keep them on notifications page
                # or you can route them to the specific job if applicable
                redirect_url = "#"
            elif related and len(related) > 0:
                try:
                    possible_job_id = int(related[0])
                    redirect_url = f"/employers/job/{possible_job_id}/applicants"
                except Exception:
                    redirect_url = "/employers/application_management"

            normalized.append({
                "notification_id": notif.get("notification_id"),
                "notification_type": notif.get("notification_type"),
                "title": notif.get("title"),
                "message": notif.get("message"),
                "is_read": notif.get("is_read"),
                "created_at": notif.get("created_at").isoformat() if notif.get("created_at") else None,
                "redirect_url": redirect_url
            })

        return jsonify({
            "success": True,
            "notifications": normalized,
            "unread_count": unread_count["count"] if unread_count else 0
        })

    except Exception as e:
        print(f"Error fetching notifications: {e}")
        return jsonify({"success": False, "notifications": []})
    finally:
        conn.close()


@employers_bp.route('/api/notifications/unread-count')
def get_unread_notif_count():
    if 'employer_id' not in session:
        return jsonify({'success': False, 'count': 0})

    employer_id = session['employer_id']
    conn = create_connection()
    if not conn:
        return jsonify({'success': False, 'count': 0})

    try:
        # [FIX] Reverted to only count relevant types
        query = """
        SELECT COUNT(*) as count 
        FROM notifications 
        WHERE employer_id = %s 
          AND is_read = 0 
          AND notification_type IN ('job_application', 'report_verdict')
        """
        result = run_query(conn, query, (employer_id,), fetch="one")
        count = result['count'] if result else 0

        return jsonify({'success': True, 'count': count})
    except Exception as e:
        print(f"[v0] Error fetching employer unread count: {e}")
        return jsonify({'success': False, 'count': 0})
    finally:
        conn.close()


@employers_bp.route("/api/notifications/<int:notification_id>/read", methods=["POST"])
def mark_notification_read_by_id(notification_id):
    """Mark a single employer notification as read (matches frontend call)."""
    if 'employer_id' not in session:
        return jsonify({"success": False}), 401

    employer_id = session['employer_id']
    conn = create_connection()
    if not conn:
        return jsonify({"success": False}), 500

    try:
        run_query(conn, "UPDATE notifications SET is_read = 1 WHERE notification_id = %s AND employer_id = %s",
                  (notification_id, employer_id))
        conn.commit()
        return jsonify({"success": True})
    except Exception as e:
        print(f"[v0] Error marking notification read: {e}")
        return jsonify({"success": False}), 500
    finally:
        conn.close()


# Route to show applicants for a specific job (employer-facing)
@employers_bp.route("/job/<int:job_id>/applicants")
def job_applicants(job_id):
    """Show list of applicants who applied to a given job (employer only)."""
    if 'employer_id' not in session:
        flash('Please log in to access this page.', 'warning')
        # Fixed redirect to home instead of login loop
        return redirect(url_for('home'))

    employer_id = session['employer_id']
    conn = create_connection()
    if not conn:
        flash('Database connection failed.', 'danger')
        return redirect(url_for('employers.application_management'))

    try:
        # ensure job belongs to this employer
        job = run_query(conn, "SELECT * FROM jobs WHERE job_id = %s AND employer_id = %s",
                        (job_id, employer_id), fetch='one')
        if not job:
            flash('Job not found or you do not have permission to view it.', 'danger')
            return redirect(url_for('employers.application_management'))

        # UPDATED QUERY: Include interview_status subquery
        applicants = run_query(
            conn,
            """
            SELECT
              a.id AS id,
              a.applied_at,
              a.status AS application_status,
              ap.applicant_id,
              ap.first_name,
              ap.last_name,
              ap.profile_pic_path,
              ap.email,
              ap.phone,
              ap.city,
              (SELECT status FROM interview_schedules WHERE application_id = a.id ORDER BY created_at DESC LIMIT 1) as interview_status
            FROM applications a
            JOIN applicants ap ON a.applicant_id = ap.applicant_id
            WHERE a.job_id = %s
            ORDER BY a.applied_at DESC
            """,
            (job_id,),
            fetch='all'
        )

        return render_template('Employer/job_applicants.html', job=job, applicants=applicants)
    except Exception as e:
        print(f"[v0] Error fetching job applicants: {e}")
        flash('Failed to load applicants for this job.', 'danger')
        return redirect(url_for('employers.application_management'))
    finally:
        conn.close()


# Route to view individual applicant profile (employer-facing)
@employers_bp.route("/applicant/<int:applicant_id>")
def view_applicant(applicant_id):
    """Employer-facing applicant profile and their applications."""
    if 'employer_id' not in session:
        flash('Please log in to access this page.', 'warning')
        return redirect(url_for('home'))

    conn = create_connection()
    if not conn:
        flash('Database connection failed.', 'danger')
        return redirect(url_for('employers.application_management'))

    try:
        applicant = run_query(
            conn, "SELECT * FROM applicants WHERE applicant_id = %s", (applicant_id,), fetch='one')
        if not applicant:
            flash('Applicant not found.', 'danger')
            return redirect(url_for('employers.application_management'))

        applications = run_query(
            conn,
            """
            SELECT a.id AS id, a.job_id, a.status AS status, a.applied_at, j.job_position
            FROM applications a
            JOIN jobs j ON a.job_id = j.job_id
            WHERE a.applicant_id = %s
            AND j.employer_id = %s
            ORDER BY a.applied_at DESC
            """,
            (applicant_id, session['employer_id']),
            fetch='all'
        )

        return render_template('Employer/applicant_profile.html', applicant=applicant, applications=applications)
    except Exception as e:
        print(f"[v0] Error loading applicant profile: {e}")
        flash('Failed to load applicant profile.', 'danger')
        return redirect(url_for('employers.application_management'))
    finally:
        conn.close()


@employers_bp.route("/report_applicant/<int:applicant_id>", methods=["POST"])
def report_applicant(applicant_id):
    """Allow employers to report applicants with a reason and optional job context."""
    if 'employer_id' not in session:
        return jsonify({'success': False, 'message': 'Please log in to continue.'}), 401

    employer_id = session['employer_id']
    payload = request.get_json(silent=True) or {}
    reason = (payload.get("reason") or "").strip()
    details = (payload.get("details") or "").strip()
    job_id = payload.get("job_id") or payload.get(
        "context") or payload.get("context_id")

    if len(reason) < 10:
        return jsonify({'success': False, 'message': 'Please provide at least 10 characters for the reason.'}), 400

    try:
        job_id = int(job_id) if job_id else None
    except (TypeError, ValueError):
        job_id = None

    conn = create_connection()
    if not conn:
        return jsonify({'success': False, 'message': 'Database connection failed.'}), 500

    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS applicant_reports (
                id INT AUTO_INCREMENT PRIMARY KEY,
                applicant_id INT NOT NULL,
                employer_id INT NOT NULL,
                job_id INT NULL,
                reason VARCHAR(255) NOT NULL,
                details TEXT NULL,
                status VARCHAR(50) DEFAULT 'Pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX (applicant_id),
                INDEX (employer_id),
                INDEX (job_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """)

        cursor.execute(
            "SELECT employer_name FROM employers WHERE employer_id = %s", (employer_id,))
        reporter = cursor.fetchone() or {}

        cursor.execute("""
            SELECT applicant_id, first_name, last_name
            FROM applicants
            WHERE applicant_id = %s
        """, (applicant_id,))
        applicant = cursor.fetchone()
        if not applicant:
            return jsonify({'success': False, 'message': 'Applicant not found.'}), 404

        if job_id:
            cursor.execute(
                "SELECT job_id FROM jobs WHERE job_id = %s AND employer_id = %s",
                (job_id, employer_id)
            )
            if not cursor.fetchone():
                job_id = None

        cursor.execute("""
            INSERT INTO applicant_reports (applicant_id, employer_id, job_id, reason, details)
            VALUES (%s, %s, %s, %s, %s)
        """, (
            applicant_id,
            employer_id,
            job_id,
            reason,
            details or None
        ))
        conn.commit()

        applicant_name = f"{applicant.get('first_name', '').strip()} {applicant.get('last_name', '').strip()}".strip(
        ) or "Applicant"
        reporter_name = reporter.get("employer_name", "An employer")
        try:
            create_notification(
                notification_type="applicant_reported",
                title="Applicant reported",
                message=f"{applicant_name} was reported by {reporter_name}. Reason: {reason}",
                related_ids=[applicant_id],
                applicant_id=applicant_id
            )
        except Exception as notif_err:
            print(
                f"[v1] Failed to log applicant report notification: {notif_err}")

        return jsonify({'success': True, 'message': 'Report submitted. Our admins were notified.'})
    except Exception as exc:
        conn.rollback()
        print(f"[v1] Error reporting applicant: {exc}")
        return jsonify({'success': False, 'message': 'Unable to submit the report right now.'}), 500
    finally:
        cursor.close()
        conn.close()


@employers_bp.route('/api/applications/<int:application_id>/status', methods=['POST'])
def update_application_status(application_id):
    if 'employer_id' not in session:
        return jsonify({'success': False, 'message': 'Not logged in'}), 401

    employer_id = session['employer_id']
    data = request.get_json() or {}
    new_status = data.get('status')
    interview_data = data.get('interview_details')  # Expect this from frontend

    allowed_statuses = ['Pending', 'Hired',
                        'Shortlisted', 'Rejected', 'For Interview']
    if not new_status or new_status not in allowed_statuses:
        return jsonify({'success': False, 'message': 'Invalid status'}), 400

    conn = create_connection()
    try:
        # Verify ownership and get details
        app_row = run_query(
            conn,
            "SELECT a.id, a.status, a.job_id, a.applicant_id, j.employer_id, j.job_position FROM applications a JOIN jobs j ON a.job_id = j.job_id WHERE a.id = %s",
            (application_id,),
            fetch='one'
        )

        if not app_row or app_row.get('employer_id') != employer_id:
            return jsonify({'success': False, 'message': 'Permission denied'}), 403

        if app_row.get('status') == 'Blacklisted':
            return jsonify({'success': False, 'message': 'Cannot update status: Applicant is restricted.'}), 403

        # 1. Handle Interview Schedule (Upsert Logic)
        if new_status == "For Interview" and interview_data:
            if not all(k in interview_data for k in ('date', 'time', 'type', 'location')):
                return jsonify({'success': False, 'message': 'Missing interview details'}), 400

            try:
                interview_dt = datetime.strptime(
                    f"{interview_data['date']} {interview_data['time']}", "%Y-%m-%d %H:%M")
                if interview_dt < datetime.now():
                    return jsonify({'success': False, 'message': 'Interview date cannot be in the past.'}), 400
            except ValueError:
                return jsonify({'success': False, 'message': 'Invalid date/time format.'}), 400

            # Check if an interview schedule already exists for this application
            existing_interview = run_query(
                conn, "SELECT id FROM interview_schedules WHERE application_id = %s", (application_id,), fetch="one")

            if existing_interview:
                # UPDATE existing schedule
                run_query(conn, """
                    UPDATE interview_schedules 
                    SET interview_date=%s, interview_time=%s, interview_type=%s, location_link=%s, notes=%s, status='Pending', updated_at=NOW()
                    WHERE application_id=%s
                """, (
                    interview_data['date'],
                    interview_data['time'],
                    interview_data['type'],
                    interview_data['location'],
                    interview_data.get('notes', ''),
                    application_id
                ))
                notif_title = "Interview Updated"
                notif_msg = f"The employer has updated the interview details for {app_row.get('job_position')}."
            else:
                # INSERT new schedule
                run_query(conn, """
                    INSERT INTO interview_schedules 
                    (application_id, employer_id, applicant_id, interview_date, interview_time, interview_type, location_link, notes)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    application_id,
                    employer_id,
                    app_row['applicant_id'],
                    interview_data['date'],
                    interview_data['time'],
                    interview_data['type'],
                    interview_data['location'],
                    interview_data.get('notes', '')
                ))
                notif_title = "Interview Invitation"
                notif_msg = f"You have been invited for an interview for {app_row.get('job_position')}."

            # Create Notification
            from .notifications import create_notification
            create_notification(
                notification_type='job_application',
                title=notif_title,
                message=notif_msg,
                related_ids=[app_row.get('job_id')],
                applicant_id=app_row.get('applicant_id')
            )

        # 2. Update Application Status
        run_query(conn, "UPDATE applications SET status = %s WHERE id = %s",
                  (new_status, application_id))

        # 3. Log History
        run_query(conn, "INSERT INTO applications_history (application_id, old_status, new_status, changed_by) VALUES (%s, 'Unknown', %s, %s)",
                  (application_id, new_status, employer_id))

        if new_status != "For Interview":
            notif_title = f"Application Update: {new_status}"
            notif_msg = f"Your application status for {app_row.get('job_position')} has been updated to {new_status}."

            if new_status == "Hired":
                notif_title = "Congratulations! You're Hired"
                notif_msg = f"Good news! You have been hired for the position of {app_row.get('job_position')}."
            elif new_status == "Rejected":
                notif_title = "Application Status Update"
                notif_msg = f"Your application for {app_row.get('job_position')} was not successful at this time."
            elif new_status == "Shortlisted":
                notif_title = "You've Been Shortlisted"
                notif_msg = f"Great news! You have been shortlisted for {app_row.get('job_position')}."

            from .notifications import create_notification
            create_notification(
                notification_type='job_application',
                title=notif_title,
                message=notif_msg,
                related_ids=[app_row.get('job_id')],
                applicant_id=app_row.get('applicant_id')
            )

        conn.commit()
        return jsonify({'success': True, 'message': 'Status updated successfully', 'new_status': new_status})

    except Exception as e:
        conn.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        conn.close()


@employers_bp.route('/api/job_counts', methods=['GET'])
def get_job_counts():
    """Return a mapping of job_id -> application_count for the logged-in employer.
    FIXED: Now counts ACTUAL applications from the applications table
    instead of returning the stale 'application_count' column.
    """
    if 'employer_id' not in session:
        return jsonify({'success': False, 'message': 'Not logged in'}), 401

    employer_id = session['employer_id']
    conn = create_connection()
    if not conn:
        return jsonify({'success': False, 'message': 'DB connection failed'}), 500

    try:
        rows = run_query(
            conn,
            """SELECT j.job_id, COUNT(a.id) AS applicant_count
               FROM jobs j
               LEFT JOIN applications a ON j.job_id = a.job_id
               WHERE j.employer_id = %s AND j.status != 'deleted'
               GROUP BY j.job_id""",
            (employer_id,),
            fetch='all'
        )
        conn.close()
        counts = {}
        for r in rows or []:
            counts[str(r['job_id'])] = int(r.get('applicant_count') or 0)

        return jsonify({'success': True, 'counts': counts})
    except Exception as e:
        print(f"[v0] Error fetching job counts: {e}")
        try:
            conn.close()
        except Exception:
            pass
        return jsonify({'success': False, 'message': 'Failed to fetch counts'}), 500


@employers_bp.route('/api/applications/<int:application_id>/cancel_interview', methods=['POST'])
def cancel_interview_schedule(application_id):
    if 'employer_id' not in session:
        return jsonify({'success': False, 'message': 'Not logged in'}), 401

    employer_id = session['employer_id']
    conn = create_connection()
    try:
        # 1. Verify ownership and get details
        app_row = run_query(
            conn,
            """
            SELECT a.id, a.job_id, a.applicant_id, a.status, j.employer_id, j.job_position 
            FROM applications a 
            JOIN jobs j ON a.job_id = j.job_id 
            WHERE a.id = %s
            """,
            (application_id,),
            fetch='one'
        )

        if not app_row or app_row.get('employer_id') != employer_id:
            return jsonify({'success': False, 'message': 'Permission denied'}), 403

        # 2. Cancel the Interview Schedule
        # We update the latest active schedule to 'Cancelled'
        run_query(conn, """
            UPDATE interview_schedules 
            SET status = 'Cancelled', notes = CONCAT(notes, ' [Cancelled by Employer]') 
            WHERE application_id = %s AND status != 'Cancelled'
        """, (application_id,))

        # 3. Reset Application Status to 'Pending'
        run_query(
            conn, "UPDATE applications SET status = 'Pending' WHERE id = %s", (application_id,))

        # 4. Log History
        run_query(conn, """
            INSERT INTO applications_history 
            (application_id, old_status, new_status, changed_by, note) 
            VALUES (%s, 'For Interview', 'Pending', %s, 'Interview Cancelled by Employer')
        """, (application_id, employer_id))

        conn.commit()

        # 5. Notify Applicant
        from .notifications import create_notification
        create_notification(
            notification_type='job_application',
            title='Interview Cancelled',
            message=f"The employer has cancelled the interview for {app_row.get('job_position')}. The application status has been reverted to Pending.",
            related_ids=[app_row.get('job_id')],
            applicant_id=app_row.get('applicant_id')
        )

        return jsonify({'success': True, 'message': 'Interview cancelled successfully', 'new_status': 'Pending'})

    except Exception as e:
        conn.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        conn.close()
