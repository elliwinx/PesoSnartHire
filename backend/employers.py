from flask import Blueprint, render_template, request, redirect, url_for, session, flash, jsonify
from datetime import datetime
import os
import json
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

    # Successful login - set session variables
    session["employer_id"] = employer["employer_id"]
    session["employer_name"] = employer["employer_name"]
    session["contact_person"] = employer["contact_person"]
    session["employer_email"] = employer["email"]
    session["employer_status"] = employer["status"]

    conn.close()
    flash(f"Welcome back, {employer['contact_person']}!", "success")
    return redirect(url_for("employers.employer_home"))


# ===== Routes =====
@employers_bp.route("/logout")
def logout():
    session.clear()
    flash("You have been logged out successfully.", "success")
    return redirect(url_for("home"))

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

    # <CHANGE> Restrict Reupload status employers
    if check_reupload_restriction():
        flash("Please complete your document reupload first.", "warning")
        return redirect(url_for("employers.account_security"))

    return render_template("Employer/employer_home.html")


@employers_bp.route("/notifications")
def notifications():
    if "employer_id" not in session:
        flash("Please log in to access this page.", "warning")
        return redirect(url_for("home"))

    # <CHANGE> Restrict Reupload status employers
    if check_reupload_restriction():
        flash("Please complete your document reupload first.", "warning")
        return redirect(url_for("employers.account_security"))

    return render_template("Employer/notif.html")


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
        flash(f"Error fetching employer data: {e}", "danger")
        return redirect(url_for("employers.employer_home"))

    if not employer:
        flash("Employer not found.", "danger")
        return redirect(url_for("employers.employer_home"))

    # --- HANDLE POST (form submission) ---
    if request.method == "POST":
        try:
            # 🔹 Get form data
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

            # 🔹 Uploaded files
            company_logo_file = request.files.get("company_logo")
            business_permit_file = request.files.get("business_permit")
            philiobnet_registration_file = request.files.get(
                "philiobnet_registration")
            job_orders_file = request.files.get("job_orders")
            dole_no_pending_file = request.files.get("dole_no_pending")
            dole_authority_file = request.files.get("dole_authority")
            dmw_no_pending_file = request.files.get("dmw_no_pending")
            license_to_recruit_file = request.files.get("license_to_recruit")

            # 🔹 Handle file uploads (overwrite if new)
            def handle_upload(file, current_path, folder):
                if file and file.filename:
                    if current_path:
                        old_path = os.path.join("static", current_path)
                        if os.path.exists(old_path):
                            os.remove(old_path)
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

            # 🔹 Update employer record
            update_query = """
                UPDATE employers SET
                    employer_name=%s,
                    industry=%s,
                    recruitment_type=%s,
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
                    documents_to_reupload=%s
                WHERE employer_id=%s
            """

            documents_to_reupload_list = request.form.getlist(
                "documents_to_reupload")  # example
            documents_to_reupload_json = json.dumps(
                documents_to_reupload_list) if documents_to_reupload_list else None

            data = (
                employer_name, industry, recruitment_type, contact_person, phone, email,
                street, barangay, city, province,
                company_logo_path, business_permit_path, philiobnet_registration_path,
                job_orders_path, dole_no_pending_path, dole_authority_path,
                dmw_no_pending_path, license_to_recruit_path,
                documents_to_reupload_json,  # <-- JSON column
                employer_id
            )
            run_query(conn, update_query, data)
            conn.commit()
            flash(
                "Your account details and files have been updated successfully.", "success")

        except Exception as e:
            conn.rollback()
            flash(f"Error updating information: {e}", "danger")

    # --- RE-FETCH EMPLOYER AFTER UPDATE ---
    try:
        employer = run_query(
            conn,
            "SELECT * FROM employers WHERE employer_id = %s",
            (employer_id,),
            fetch="one"
        )

        # ✅ Load reupload document list (if applicable)
        documents_to_reupload = []
        if employer and employer.get("documents_to_reupload"):
            try:
                documents_to_reupload = json.loads(
                    employer["documents_to_reupload"])
            except Exception as e:
                print(
                    f"[account_security] Invalid JSON in documents_to_reupload: {e}")
                documents_to_reupload = []
        else:
            documents_to_reupload = []

    finally:
        conn.close()

    # ✅ Pass parsed docs list to template
    return render_template(
        "Employer/acc&secu.html",
        employer=employer,
        employer_status=employer.get("status"),
        documents_to_reupload=documents_to_reupload
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

        # Map form keys to DB columns and folders
        file_mapping = {
            "company_logo": ("company_logo_path", "employer_logo"),
            "business_permit": ("business_permit_path", "business_permits"),
            "philiobnet_registration": ("philiobnet_registration_path", "philiobnet_registrations"),
            "job_orders": ("job_orders_of_client_path", "job_orders"),
            "job_orders_of_client": ("job_orders_of_client_path", "job_orders"),
            "dole_no_pending": ("dole_no_pending_case_path", "dole_documents"),
            "dole_authority": ("dole_authority_to_recruit_path", "dole_documents"),
            "dmw_no_pending": ("dmw_no_pending_case_path", "dmw_documents"),
            "license_to_recruit": ("license_to_recruit_path", "dmw_documents"),
        }

        new_files = {}  # store new file paths

        for key, file in request.files.items():
            if key not in file_mapping:
                continue

            db_field, folder = file_mapping[key]

            # ✅ Only delete if the *same* file type is being reuploaded
            if file and file.filename:
                old_path = employer_data.get(db_field)
                if old_path:
                    full_old_path = os.path.join("static", old_path)
                    if os.path.exists(full_old_path):
                        os.remove(full_old_path)

                # Save new file
                new_path = save_file(file, folder)
                new_files[db_field] = new_path

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

        # Reset status
        update_data["status"] = "Pending"
        update_data["is_active"] = 0

        # Build and execute UPDATE
        set_clause = ", ".join([f"{k}=%s" for k in update_data.keys()])
        values = list(update_data.values()) + [employer_id]

        run_query(
            conn,
            f"UPDATE employers SET {set_clause} WHERE employer_id=%s",
            values
        )
        conn.commit()

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
        return redirect(url_for("employers.employer_home"))

    except Exception as e:
        conn.rollback()
        print(f"[submit_reupload] Error: {e}")
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
