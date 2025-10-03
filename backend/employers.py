from flask import Blueprint, render_template, request, redirect, url_for, session, flash
from datetime import datetime
import os
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash
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

    # Ensure filename is safe
    filename = secure_filename(file.filename)

    # Add timestamp for uniqueness (avoid overwriting)
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S%f")
    name, ext = os.path.splitext(filename)
    unique_filename = f"{name}_{timestamp}{ext}"

    file_path = os.path.join(folder_path, unique_filename)
    file.save(file_path)

    return file_path


def register_employer(form_data, files):
    """Helper function to process employer registration"""
    print("[v0] Starting employer registration process")
    print(f"[v0] Form data received for: {form_data.get('employerName')}")
    print(f"[v0] Recruitment type: {form_data.get('employerRecruitmentType')}")

    # Get form data
    employer_data = {
        "employer_name": form_data.get("employerName"),
        "industry": form_data.get("employerIndustry"),
        "recruitment_type": form_data.get("employerRecruitmentType"),
        "contact_person": form_data.get("employerContactPerson"),
        "phone": form_data.get("employerPhone"),
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
        files.get("employerPhilJobNetRegistration"), "employer_philjobnet")
    job_orders_path = save_file(
        files.get("employerJobOrders"), "employer_joborders")

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

    # Hash password
    password_hash = generate_password_hash(employer_data["password"])
    print("[v0] Password hashed successfully")

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
            password_hash, accepted_terms, accepted_terms_at
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 1, NOW()
        )
    """

    params = (
        employer_data["employer_name"], employer_data["industry"], employer_data["recruitment_type"],
        employer_data["contact_person"], employer_data["phone"], employer_data["email"],
        employer_data["street"], employer_data["barangay"], employer_data["city"], employer_data["province"],
        company_logo_path, business_permit_path, philiobnet_path, job_orders_path,
        dole_no_pending_path, dole_authority_path,
        dmw_no_pending_path, license_to_recruit_path,
        password_hash
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

        recruitment_label = "Local" if employer_data["recruitment_type"] == "Local" else "International"
        notification_title = f"Employer Account Pending Approval"
        notification_message = f"1 {recruitment_label} employer registration needs approval"

        create_notification(
            notification_type='employer_approval',
            title=notification_title,
            message=notification_message,
            count=1,
            related_ids=[employer_id] if employer_id else None,
            recruitment_type=employer_data["recruitment_type"]
        )
        print(
            f"[v0] Notification created for {recruitment_label} employer registration")

        conn.close()
        return True, "Registration successful! Your account is pending admin approval."
    else:
        print("[v0] Failed to register employer in database")
        conn.close()
        return False, "Registration failed. Please try again."


# ===== Routes =====
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
        success, message = register_employer(request.form, request.files)
        flash(message, "success" if success else "danger")

        if success:
            print(f"[v0] Redirecting to home page")
            return redirect(url_for("home"))
        else:
            print(f"[v0] Registration failed, staying on registration page")
            return redirect(url_for("employers.register"))

    return render_template("Landing_Page/employer_registration.html")
