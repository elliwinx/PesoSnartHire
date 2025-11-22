from flask import Blueprint, render_template, request, redirect, url_for, session, flash, jsonify, current_app
from datetime import datetime
import os
import json
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash
from db_connection import create_connection, run_query
from flask_mail import Message
from extensions import mail
from .notifications import create_notification
from .recaptcha import verify_recaptcha
from .recruitment_change_handler import handle_recruitment_type_change

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

    # Successful login - set session variables
    session["employer_id"] = employer["employer_id"]
    session["employer_name"] = employer["employer_name"]
    session["contact_person"] = employer["contact_person"]
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
        flash(f"Error fetching employer data: {e}", "danger")
        return redirect(url_for("employers.employer_home"))

    if not employer:
        flash("Employer not found.", "danger")
        return redirect(url_for("employers.employer_home"))

    if request.method == "POST":
        try:
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

            # ✅ STEP 1: Handle file uploads FIRST (before recruitment type validation)
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

            documents_to_reupload_list = request.form.getlist(
                "documents_to_reupload")
            documents_to_reupload_json = json.dumps(
                documents_to_reupload_list) if documents_to_reupload_list else None

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
                    documents_to_reupload=%s,
                    status=%s,
                    is_active=%s
                WHERE employer_id=%s
            """

            data = (
                employer_name, industry, recruitment_type, contact_person, phone, email,
                street, barangay, city, province,
                company_logo_path, business_permit_path, philiobnet_registration_path,
                job_orders_path, dole_no_pending_path, dole_authority_path,
                dmw_no_pending_path, license_to_recruit_path,
                documents_to_reupload_json,
                employer["status"], employer["is_active"],
                employer_id
            )

            run_query(conn, update_query, data)
            conn.commit()

            # ✅ STEP 2: Now handle recruitment type change (after files are saved to DB)
            recruitment_type_changed = request.form.get(
                "recruitment_type_changed")

            if recruitment_type_changed == "true":
                old_type = request.form.get("old_recruitment_type")
                new_type = request.form.get("new_recruitment_type")

                result = handle_recruitment_type_change(
                    employer_id, conn, old_type, new_type)

                if result["success"]:
                    conn.commit()
                    conn.close()
                    session.clear()
                    flash(
                        "Recruitment type changed — Your documents will be set for verification. You cannot access your account in the mean time.", "info")
                    return redirect(url_for("home"))
                else:
                    error_msg = result.get('message', 'Unknown error')
                    if 'error' in result:
                        error_msg = result['error']
                    flash(
                        f"Error updating recruitment type: {error_msg}", "danger")
                    conn.close()
                    return redirect(url_for("employers.account_security"))

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
        else:
            documents_to_reupload = []

    finally:
        conn.close()

    # Pass parsed docs list to template
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
        return redirect(url_for("home"))

    except Exception as e:
        conn.rollback()
        print(f"[submit_reupload] Error: {e}")
        flash(f"Error during reupload: {e}", "danger")
        return redirect(url_for("home"))

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
    if "employer_id" not in session:
        flash("Please log in to create a job post.", "warning")
        return redirect(url_for("home"))

    employer_id = session["employer_id"]

    job_position = request.form.get("job_position", "").strip()
    work_schedule = request.form.get("work_schedule", "").strip()
    num_vacancy = request.form.get("num_vacancy", "").strip()
    min_salary = request.form.get("min_salary", "").strip()
    max_salary = request.form.get("max_salary", "").strip()
    job_description = request.form.get("job_description", "").strip()
    qualifications = request.form.get("qualifications", "").strip()

    if not all([job_position, work_schedule, num_vacancy, min_salary, max_salary, job_description, qualifications]):
        flash("All fields are required.", "danger")
        return redirect(url_for("employers.employer_home"))

    try:
        num_vacancy = int(num_vacancy)
        min_salary = float(min_salary)
        max_salary = float(max_salary)

        if num_vacancy <= 0:
            flash("Number of vacancies must be greater than 0.", "danger")
            return redirect(url_for("employers.employer_home"))

        if min_salary <= 0 or max_salary <= 0:
            flash("Salary values must be greater than 0.", "danger")
            return redirect(url_for("employers.employer_home"))

        if max_salary < min_salary:
            flash("Maximum salary cannot be less than minimum salary.", "danger")
            return redirect(url_for("employers.employer_home"))

    except ValueError:
        flash("Invalid number format for vacancies or salary.", "danger")
        return redirect(url_for("employers.employer_home"))

    conn = create_connection()
    if not conn:
        flash("Database connection failed.", "danger")
        return redirect(url_for("employers.employer_home"))

    try:
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


@employers_bp.route("/job/<int:job_id>/json")
def get_job_json(job_id):
    conn = create_connection()
    if not conn:
        return jsonify({"success": False, "message": "DB connection failed."}), 500

    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT job_id,
                   job_position,
                   job_description,
                   status,
                   work_schedule,
                   num_vacancy AS vacancy,  -- alias to match your JS
                   min_salary,
                   max_salary,
                   qualifications
            FROM jobs
            WHERE job_id = %s
        """, (job_id,))
        job = cursor.fetchone()
        cursor.close()

        if not job:
            return jsonify({"success": False, "message": "Job not found."}), 404

        return jsonify({"success": True, "job": job})

    except Exception as e:
        current_app.logger.exception(
            f"Failed to fetch job JSON for job_id={job_id}: {e}")
        return jsonify({"success": False, "message": f"Failed to load job: {str(e)}"}), 500
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
        run_query(
            conn, "UPDATE jobs SET status='archived' WHERE job_id=%s", (job_id,))
        conn.commit()
        return jsonify({"success": True, "message": "Job post archived successfully."})
    except Exception as e:
        conn.rollback()
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
        run_query(conn, "DELETE FROM jobs WHERE job_id=%s", (job_id,))
        conn.commit()
        return jsonify({"success": True, "message": "Job post deleted successfully."})
    except Exception as e:
        conn.rollback()
        return jsonify({"success": False, "message": f"Error: {e}"})
    finally:
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
        query = """SELECT notification_id, notification_type, title, message, is_read, created_at, related_ids
                   FROM notifications 
                   WHERE employer_id = %s 
                   AND notification_type = 'job_application'"""
        params = [employer_id]

        if filter_type == 'unread':
            query += " AND is_read = 0"

        query += " ORDER BY created_at DESC LIMIT 50"

        notifications = run_query(conn, query, tuple(params), fetch="all")

        unread_count = run_query(
            conn,
            """SELECT COUNT(*) as count 
               FROM notifications 
               WHERE employer_id = %s 
               AND notification_type = 'job_application'
               AND is_read = 0""",
            (employer_id,),
            fetch="one"
        )

        normalized = []
        for notif in notifications or []:
            # parse related_ids if present
            related = []
            if notif.get('related_ids'):
                try:
                    related = json.loads(notif.get('related_ids'))
                except Exception:
                    related = []

            # determine redirect url: prefer job-specific applicants list when related_ids contains a job id
            redirect_url = "/employers/application_management"
            if related and len(related) > 0:
                try:
                    possible_job_id = int(related[0])
                    redirect_url = f"/employers/job/{possible_job_id}/applicants"
                except Exception:
                    # fall back to default
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


# New endpoint to mark single notification as read (matches front-end usage)
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
        run_query(conn, "UPDATE notifications SET is_read = 1 WHERE notification_id = %s AND employer_id = %s", (notification_id, employer_id))
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
        return redirect(url_for('home'))

    employer_id = session['employer_id']
    conn = create_connection()
    if not conn:
        flash('Database connection failed.', 'danger')
        return redirect(url_for('employers.application_management'))

    try:
        # ensure job belongs to this employer
        job = run_query(conn, "SELECT * FROM jobs WHERE job_id = %s AND employer_id = %s", (job_id, employer_id), fetch='one')
        if not job:
            flash('Job not found or you do not have permission to view it.', 'danger')
            return redirect(url_for('employers.application_management'))

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
              ap.city
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
        applicant = run_query(conn, "SELECT * FROM applicants WHERE applicant_id = %s", (applicant_id,), fetch='one')
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
            ORDER BY a.applied_at DESC
            """,
            (applicant_id,),
            fetch='all'
        )

        return render_template('Employer/applicant_profile.html', applicant=applicant, applications=applications)
    except Exception as e:
        print(f"[v0] Error loading applicant profile: {e}")
        flash('Failed to load applicant profile.', 'danger')
        return redirect(url_for('employers.application_management'))
    finally:
        conn.close()


@employers_bp.route('/api/applications/<int:application_id>/status', methods=['POST'])
def update_application_status(application_id):
    """Allow employer to update an application's status (with permission check).
    Records change in applications_history table.
    Expected JSON: { "status": "Hired" }
    """
    if 'employer_id' not in session:
        return jsonify({'success': False, 'message': 'Not logged in'}), 401

    employer_id = session['employer_id']
    data = request.get_json() or {}
    new_status = data.get('status')
    allowed_statuses = ['Pending', 'Hired', 'Shortlisted', 'Rejected', 'For Interview']

    if not new_status or new_status not in allowed_statuses:
        return jsonify({'success': False, 'message': 'Invalid status'}), 400

    conn = create_connection()
    if not conn:
        return jsonify({'success': False, 'message': 'DB connection failed'}), 500

    try:
        # Fetch application and verify ownership via job -> employer
        # include applicant_id and job_position so we can notify the applicant
        app_row = run_query(conn, "SELECT a.id, a.job_id, a.applicant_id, a.status, j.employer_id, j.job_position FROM applications a JOIN jobs j ON a.job_id = j.job_id WHERE a.id = %s", (application_id,), fetch='one')
        if not app_row:
            return jsonify({'success': False, 'message': 'Application not found'}), 404

        if app_row.get('employer_id') != employer_id:
            return jsonify({'success': False, 'message': 'Permission denied'}), 403

        old_status = app_row.get('status') or 'Pending'

        # Update applications table
        run_query(conn, "UPDATE applications SET status = %s WHERE id = %s", (new_status, application_id))

        # Ensure applications_history table exists (best-effort)
        try:
            run_query(conn, """
                CREATE TABLE IF NOT EXISTS applications_history (
                    history_id INT AUTO_INCREMENT PRIMARY KEY,
                    application_id INT NOT NULL,
                    old_status VARCHAR(50),
                    new_status VARCHAR(50),
                    changed_by INT,
                    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    note TEXT,
                    INDEX(application_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)
        except Exception as e:
            # non-fatal: continue
            print('[v0] applications_history create check failed:', e)

        # Insert history record
        run_query(conn, "INSERT INTO applications_history (application_id, old_status, new_status, changed_by) VALUES (%s, %s, %s, %s)", (application_id, old_status, new_status, employer_id))

        conn.commit()

        # Notify the applicant about the status change
        try:
            applicant_to_notify = app_row.get('applicant_id')
            job_id = app_row.get('job_id')
            job_position = app_row.get('job_position') or 'your application'
            if applicant_to_notify:
                create_notification(
                    notification_type='job_application',
                    title='Application Status Updated',
                    message=f"Your application for {job_position} is now: {new_status}",
                    count=1,
                    related_ids=[job_id] if job_id else None,
                    applicant_id=applicant_to_notify
                )
        except Exception as notifErr:
            print('[v0] Failed to create applicant notification:', notifErr)

        return jsonify({'success': True, 'message': 'Status updated', 'new_status': new_status})

    except Exception as e:
        print('[v0] Error updating application status:', e)
        conn.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

    finally:
        conn.close()


@employers_bp.route('/api/job_counts', methods=['GET'])
def get_job_counts():
    """Return a mapping of job_id -> application_count for the logged-in employer."""
    if 'employer_id' not in session:
        return jsonify({'success': False, 'message': 'Not logged in'}), 401

    employer_id = session['employer_id']
    conn = create_connection()
    if not conn:
        return jsonify({'success': False, 'message': 'DB connection failed'}), 500

    try:
        rows = run_query(conn, "SELECT job_id, application_count FROM jobs WHERE employer_id = %s AND status != 'deleted'", (employer_id,), fetch='all')
        conn.close()
        counts = {}
        for r in rows or []:
            counts[str(r['job_id'])] = int(r.get('application_count') or 0)

        return jsonify({'success': True, 'counts': counts})
    except Exception as e:
        print(f"[v0] Error fetching job counts: {e}")
        try:
            conn.close()
        except Exception:
            pass
        return jsonify({'success': False, 'message': 'Failed to fetch counts'}), 500
