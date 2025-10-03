from flask import Blueprint, render_template, request, redirect, url_for, session, flash
from datetime import datetime
import os
from werkzeug.utils import secure_filename
from db_connection import create_connection, run_query
from flask_mail import Message
from extensions import mail

employers_bp = Blueprint("employers", __name__)

UPLOAD_FOLDER = "static/uploads"


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


def register_employer(form, files):
    conn = create_connection()
    if not conn:
        return False, "Database connection failed."

    try:
        email = form.get("employerEmail")
        phone = form.get("employerPhoneNumber")

        print(f"[v0] Registration attempt for email: {email}")
        print(f"[v0] Form data keys: {list(form.keys())}")
        print(f"[v0] Files data keys: {list(files.keys())}")

        # ==== Check if employer already exists ====
        existing = run_query(
            conn,
            "SELECT employer_id FROM employers WHERE email=%s OR phone=%s",
            (email, phone),
            fetch="all"
        )
        if existing:
            print(f"[v0] Employer already exists")
            return False, "This employer is already registered. Please log in or contact admin."

        accepted_terms = int(session.get("accepted_terms", 0))
        accepted_terms_at = session.get("accepted_terms_at", None)
        recruitment_type = form.get("employerRecruitment")

        print(f"[v0] Recruitment type: {recruitment_type}")

        # ==== Required files ====
        logo_path = save_file(
            files.get("employerCompanyLogo"), "employer_logos")
        permit_path = save_file(
            files.get("employerBusinessPermit"), "employer_permits")
        philiobnet_path = save_file(
            files.get("employerPhiliobnetRegistration"), "employer_philiobnet")
        job_orders_path = save_file(
            files.get("employerJobOrdersOfClient"), "employer_joborders")

        print(f"[v0] Logo path: {logo_path}")
        print(f"[v0] Permit path: {permit_path}")
        print(f"[v0] Philiobnet path: {philiobnet_path}")
        print(f"[v0] Job orders path: {job_orders_path}")

        if not (logo_path and permit_path and philiobnet_path and job_orders_path):
            print(f"[v0] Missing required documents")
            return False, "All required employer documents must be uploaded."

        # ==== Local Recruitment docs ====
        dole_no_pending_path = None
        dole_authority_path = None
        if recruitment_type == "Local":
            dole_no_pending_path = save_file(
                files.get("employerDOLENoPendingCase"), "employer_dole")
            dole_authority_path = save_file(
                files.get("employerDOLEAuthorityToRecruit"), "employer_dole")

            print(f"[v0] DOLE no pending path: {dole_no_pending_path}")
            print(f"[v0] DOLE authority path: {dole_authority_path}")

            if not dole_no_pending_path or not dole_authority_path:
                print(f"[v0] Missing DOLE documents for Local recruitment")
                return False, "DOLE documents are required for Local recruitment."

        # ==== International Recruitment docs ====
        dmw_no_pending_path = None
        license_path = None
        if recruitment_type == "International":
            dmw_no_pending_path = save_file(
                files.get("employerDMWNoPendingCase"), "employer_dmw")
            license_path = save_file(
                files.get("employerLicenseToRecruit"), "employer_license")

            print(f"[v0] DMW no pending path: {dmw_no_pending_path}")
            print(f"[v0] License path: {license_path}")

            if not dmw_no_pending_path or not license_path:
                print(f"[v0] Missing DMW documents for International recruitment")
                return False, "DMW documents are required for International recruitment."

        # ==== Insert into DB ====
        print(f"[v0] Attempting database insert")
        query = """
        INSERT INTO employers (
            employer_name, industry, recruitment_type, contact_person,
            phone, email, street, barangay, city, province,
            company_logo_path, business_permit_path,
            philiobnet_registration_path, job_orders_of_client_path,
            dole_no_pending_case_path, dole_authority_to_recruit_path,
            dmw_no_pending_case_path, license_to_recruit_path,
            accepted_terms, accepted_terms_at, status
        ) VALUES (
            %(employer_name)s, %(industry)s, %(recruitment_type)s, %(contact_person)s,
            %(phone)s, %(email)s, %(street)s, %(barangay)s, %(city)s, %(province)s,
            %(company_logo_path)s, %(business_permit_path)s,
            %(philiobnet_registration_path)s, %(job_orders_of_client_path)s,
            %(dole_no_pending_case_path)s, %(dole_authority_to_recruit_path)s,
            %(dmw_no_pending_case_path)s, %(license_to_recruit_path)s,
            %(accepted_terms)s, %(accepted_terms_at)s, %(status)s
        )
        """
        data = {
            "employer_name": form.get("employerName"),
            "industry": form.get("employerIndustry"),
            "recruitment_type": recruitment_type,
            "contact_person": form.get("employerContactPerson"),
            "phone": phone,
            "email": email,
            "street": form.get("employerStreet"),
            "barangay": form.get("employerBarangay"),
            "city": form.get("employerCity"),
            "province": form.get("employerProvince"),
            "company_logo_path": logo_path,
            "business_permit_path": permit_path,
            "philiobnet_registration_path": philiobnet_path,
            "job_orders_of_client_path": job_orders_path,
            "dole_no_pending_case_path": dole_no_pending_path,
            "dole_authority_to_recruit_path": dole_authority_path,
            "dmw_no_pending_case_path": dmw_no_pending_path,
            "license_to_recruit_path": license_path,
            "accepted_terms": accepted_terms,
            "accepted_terms_at": accepted_terms_at,
            "status": "Pending"
        }

        run_query(conn, query, data)
        conn.commit()

        print(f"[v0] Database insert successful")

        # ==== Fetch employer_code ====
        employer_code_row = run_query(
            conn,
            "SELECT employer_code FROM employers WHERE email=%s",
            (email,),
            fetch="one"
        )
        employer_code = employer_code_row["employer_code"] if employer_code_row else "N/A"

        # ==== Send confirmation email ====
        try:
            subject = "PESO SmartHire - Employer Registration Submitted"
            body = f"""
            <p>Hi {form.get('employerName')},</p>
            <p>This is the PESO SmartHire Team.</p>
            <p>Your employer registration has been submitted and is now pending admin approval.</p>
            <p>After approval, you will receive your login credentials.</p>
            <p>Thank you for joining the PESO SmartHire Platform.</p>
            """

            msg = Message(subject=subject, recipients=[email], html=body)
            mail.send(msg)
            print(f"[v0] Confirmation email sent successfully")
        except Exception as e:
            print(f"❌ Failed to send email: {e}")

        print(f"[v0] Registration completed successfully")
        return True, "Registration submitted! Please wait for admin approval."

    except Exception as e:
        print(f"[v0] Registration error: {str(e)}")
        return False, f"Registration failed: {str(e)}"

    finally:
        conn.close()


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
