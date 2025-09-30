from flask import Blueprint, render_template, request, redirect, url_for, session, flash
from datetime import datetime
import os
from werkzeug.utils import secure_filename
from db_connection import create_connection, run_query

employers_bp = Blueprint("employers", __name__)

UPLOAD_FOLDER = "static/uploads"


def save_file(file, subfolder):
    """Save uploaded employer files into a dedicated subfolder."""
    if not file:
        return None
    folder_path = os.path.join(UPLOAD_FOLDER, subfolder)
    os.makedirs(folder_path, exist_ok=True)
    filename = secure_filename(file.filename)
    file_path = os.path.join(folder_path, filename)
    file.save(file_path)
    return file_path


def register_employer(form, files):
    conn = create_connection()
    if not conn:
        return False, "DB connection failed"
    try:
        accepted_terms = int(session.get("accepted_terms", 0))
        accepted_terms_at = session.get("accepted_terms_at", None)

        # File uploads
        logo_path = save_file(files.get("companyLogo"), "employer_logos")
        permit_path = save_file(
            files.get("businessPermit"), "employer_permits")
        dole_no_pending_path = save_file(
            files.get("doleNoPendingCase"), "employer_dole")
        dole_authority_path = save_file(
            files.get("doleAuthorityRecruit"), "employer_dole")
        philiobnet_path = save_file(
            files.get("philiobnetRegistration"), "employer_philiobnet")
        job_orders_path = save_file(
            files.get("jobOrdersOfClient"), "employer_joborders")
        dmw_no_pending_path = save_file(
            files.get("dmwNoPendingCase"), "employer_dmw")
        license_path = save_file(
            files.get("licenseToRecruit"), "employer_license")

        query = """
        INSERT INTO employers (
            employer_name, industry, recruitment_type, contact_person,
            phone, email, street, barangay, city, province,
            company_logo_path, business_permit_path,
            dole_no_pending_case_path, dole_authority_to_recruit_path,
            philiobnet_registration_path, job_orders_of_client_path,
            dmw_no_pending_case_path, license_to_recruit_path,
            accepted_terms, accepted_terms_at
        ) VALUES (
            %(employer_name)s, %(industry)s, %(recruitment_type)s, %(contact_person)s,
            %(phone)s, %(email)s, %(street)s, %(barangay)s, %(city)s, %(province)s,
            %(company_logo_path)s, %(business_permit_path)s,
            %(dole_no_pending_case_path)s, %(dole_authority_to_recruit_path)s,
            %(philiobnet_registration_path)s, %(job_orders_of_client_path)s,
            %(dmw_no_pending_case_path)s, %(license_to_recruit_path)s,
            %(accepted_terms)s, %(accepted_terms_at)s
        )
        """

        data = {
            "employer_name": form.get("employerName"),
            "industry": form.get("employerIndustry"),
            "recruitment_type": form.get("employerRecruitmentType"),
            "contact_person": form.get("employerContactPerson"),
            "phone": form.get("employerPhone"),
            "email": form.get("employerEmail"),
            "street": form.get("employerStreet"),
            "barangay": form.get("employerBarangay"),
            "city": form.get("employerCity"),
            "province": form.get("employerProvince"),
            "company_logo_path": logo_path,
            "business_permit_path": permit_path,
            "dole_no_pending_case_path": dole_no_pending_path,
            "dole_authority_to_recruit_path": dole_authority_path,
            "philiobnet_registration_path": philiobnet_path,
            "job_orders_of_client_path": job_orders_path,
            "dmw_no_pending_case_path": dmw_no_pending_path,
            "license_to_recruit_path": license_path,
            "accepted_terms": accepted_terms,
            "accepted_terms_at": accepted_terms_at,
        }

        run_query(conn, query, data)
        return True, "Employer registration successful!"
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
        success, message = register_employer(request.form, request.files)
        flash(message, "success" if success else "danger")
        return redirect(url_for("employers.register"))

    return render_template("Landing_Page/employer_registration.html")
