from flask import Blueprint, render_template, request, redirect, url_for, session, flash, jsonify
from datetime import datetime
import os
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash
from db_connection import create_connection, run_query
from flask_mail import Message
from extensions import mail
from .notifications import create_notification

employers_bp = Blueprint("employers", __name__)

UPLOAD_FOLDER = "static/uploads"
# Ensure the base upload folder exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def save_file(file, subfolder):
    """Save uploaded employer files into a dedicated subfolder with unique names."""
    if not file or file.filename.strip() == "":
        return None

    folder_path = os.path.join(UPLOAD_FOLDER, subfolder)
    os.makedirs(folder_path, exist_ok=True)

    filename = secure_filename(file.filename)

    # Add timestamp for uniqueness
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S%f")
    name, ext = os.path.splitext(filename)
    unique_filename = f"{name}_{timestamp}{ext}"

    file_path = os.path.join(folder_path, unique_filename)
    file.save(file_path)

    # ✅ return the unique filename so template matches the saved file
    return os.path.join("uploads", subfolder, unique_filename).replace("\\", "/")


def register_employer(form_data, files):
    """Helper function to process employer registration"""
    print("[v0] Starting employer registration process")
    print(f"[v0] Form data received for: {form_data.get('employerName')}")
    print(f"[v0] Recruitment type: {form_data.get('employerRecruitment')}")

    # Get form data
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
    philiobnet_path = save_file(
        files.get("employerPhiliobnetRegistration"), "employer_philiobnet")
    job_orders_path = save_file(
        files.get("employerJobOrdersOfClient"), "employer_joborders")

    print(
        f"[v0] Base files saved - Logo: {bool(company_logo_path)}, Permit: {bool(business_permit_path)}")

    # Initialize recruitment-specific paths
    dole_no_pending_path = None
    dole_authority_path = None
    dmw_no_pending_path = None
    license_to_recruit_path = None

    # Handle recruitment type specific files
    if employer_data["recruitment_type"] == "Local":
        print("[v0] Processing Local recruitment files (DOLE)")
        dole_no_pending_path = save_file(
            files.get("employerDOLENoPendingCase"), "employer_dole")
        dole_authority_path = save_file(
            files.get("employerDOLEAuthorityToRecruit"), "employer_dole")

        print(
            f"[v0] DOLE files - No Pending: {bool(dole_no_pending_path)}, Authority: {bool(dole_authority_path)}")

        if not dole_no_pending_path or not dole_authority_path:
            return False, "Please upload all required DOLE documents for Local recruitment."

    elif employer_data["recruitment_type"] == "International":
        print("[v0] Processing International recruitment files (DMW)")
        dmw_no_pending_path = save_file(
            files.get("employerDMWNoPendingCase"), "employer_dmw")
        license_to_recruit_path = save_file(
            files.get("employerLicenseToRecruit"), "employer_dmw")

        print(
            f"[v0] DMW files - No Pending: {bool(dmw_no_pending_path)}, License: {bool(license_to_recruit_path)}")

        if not dmw_no_pending_path or not license_to_recruit_path:
            return False, "Please upload all required DMW documents for International recruitment."

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
            company_logo_path, business_permit_path, philiobnet_registration_path, job_orders_of_client_path,
            dole_no_pending_case_path, dole_authority_to_recruit_path,
            dmw_no_pending_case_path, license_to_recruit_path,
            password_hash, temp_password, status, is_active,
            accepted_terms, accepted_terms_at
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,%s, %s, %s, %s, 1, NOW()
        )
    """

    params = (
        employer_data["employer_name"], employer_data["industry"], employer_data["recruitment_type"],
        employer_data["contact_person"], employer_data["phone"], employer_data["email"],
        employer_data["street"], employer_data["barangay"], employer_data["city"], employer_data["province"],
        company_logo_path, business_permit_path, philiobnet_path, job_orders_path,
        dole_no_pending_path, dole_authority_path,
        dmw_no_pending_path, license_to_recruit_path,
        password_hash, None, 'Pending', 0
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

    # Successful login
    session["employer_id"] = employer["employer_id"]
    session["employer_name"] = employer["employer_name"]
    session["employer_email"] = employer["email"]
    session["employer_status"] = employer["status"]

    conn.close()
    flash(f"Welcome back, {employer['employer_name']}!", "success")
    return redirect(url_for("employers.employer_home"))


# ===== Routes =====
@employers_bp.route("/logout")
def logout():
    session.clear()
    flash("You have been logged out successfully.", "success")
    return redirect(url_for("home"))


# ===== Employer Navigation Pages =====
@employers_bp.route("/home")
def employer_home():
    if "employer_id" not in session:
        flash("Please log in to access this page.", "warning")
        return redirect(url_for("home"))
    return render_template("Employer/employer_home.html")


@employers_bp.route("/notifications")
def notifications():
    if "employer_id" not in session:
        flash("Please log in to access this page.", "warning")
        return redirect(url_for("home"))
    return render_template("Employer/notif.html")


@employers_bp.route("/account-security")
def account_security():
    if "employer_id" not in session:
        flash("Please log in to access this page.", "warning")
        return redirect(url_for("home"))
    return render_template("Employer/acc&secu.html")


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


@employers_bp.route("/submit-reupload", methods=["POST"])
def submit_reupload():
    if "employer_id" not in session:
        return jsonify({"success": False, "message": "Not authenticated"}), 401

    employer_id = session["employer_id"]

    # Accept a single file upload; field name can vary depending on reupload request
    file = None
    for key in request.files:
        file = request.files.get(key)
        if file:
            field_name = key
            break

    if not file:
        return jsonify({"success": False, "message": "No file provided"}), 400

    try:
        # Determine target subfolder/column based on uploaded field name
        mapping = {
            'employerBusinessPermit': ('employer_permit', 'business_permit_path'),
            'employerCompanyLogo': ('employer_logo', 'company_logo_path'),
            'employerPhiliobnetRegistration': ('employer_philiobnet', 'philiobnet_registration_path'),
            'employerJobOrdersOfClient': ('employer_joborders', 'job_orders_of_client_path'),
            'employerDOLENoPendingCase': ('employer_dole', 'dole_no_pending_case_path'),
            'employerDOLEAuthorityToRecruit': ('employer_dole', 'dole_authority_to_recruit_path'),
            'employerDMWNoPendingCase': ('employer_dmw', 'dmw_no_pending_case_path'),
            'employerLicenseToRecruit': ('employer_dmw', 'license_to_recruit_path'),
        }

        subfolder = 'employer_misc'
        column = None
        if field_name in mapping:
            subfolder, column = mapping[field_name]

        saved_path = save_file(file, subfolder)
        if not saved_path:
            return jsonify({"success": False, "message": "Failed to save file"}), 500

        conn = create_connection()
        if not conn:
            return jsonify({"success": False, "message": "DB connection failed"}), 500

        # Update the appropriate column if detected, otherwise write to a generic notes column
        if column:
            query = f"UPDATE employers SET {column} = %s, status = %s WHERE employer_id = %s"
            run_query(conn, query, (saved_path, 'Reupload', employer_id))
        else:
            # fallback: update job_orders_of_client_path
            query = "UPDATE employers SET job_orders_of_client_path = %s, status = %s WHERE employer_id = %s"
            run_query(conn, query, (saved_path, 'Reupload', employer_id))

        conn.commit()

        # Create admin notification so admins see that employer reuploaded documents
        create_notification(
            notification_type="employer_reupload",
            title="Employer Document Reuploaded",
            message=f"Employer ID {employer_id} has reuploaded a required document.",
            count=1,
            related_ids=[employer_id],
            employer_id=employer_id
        )

        conn.close()
        return jsonify({"success": True, "message": "Document reuploaded successfully"}), 200

    except Exception as e:
        print(f"[v0] Error submitting employer reupload: {e}")
        return jsonify({"success": False, "message": str(e)}), 500
