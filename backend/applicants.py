import secrets
from werkzeug.security import generate_password_hash, check_password_hash
from flask import Blueprint, render_template, request, redirect, url_for, session, flash, jsonify
from datetime import datetime
import os
from werkzeug.utils import secure_filename
from db_connection import create_connection, run_query
from extensions import mail
from flask_mail import Message
from .notifications import create_notification, get_notifications, mark_notification_read
from .recaptcha import verify_recaptcha
from flask import request

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
                residency_type="Lipeno"
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
                residency_type="Non-Lipeno"
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


# ===== Applicant Navigation Pages =====
@applicants_bp.route("/applicant_home")
def applicant_home():
    if "applicant_id" not in session:
        flash("Please log in to access this page.", "warning")
        return redirect(url_for("home"))

    if session.get("applicant_status") == "Reupload":
        flash("Please complete your document reupload first.", "info")
        return redirect(url_for("applicants.account_security"))

    # 🔹 Fetch active jobs
    conn = create_connection()
    if not conn:
        flash("Database connection failed.", "danger")
        return redirect(url_for("home"))

    try:
        applicant_id = session["applicant_id"]

        jobs = run_query(
            conn,
            """
            SELECT 
                jobs.job_id, 
                jobs.job_position, 
                jobs.work_schedule, 
                jobs.num_vacancy,
                jobs.min_salary, 
                jobs.max_salary, 
                jobs.job_description, 
                jobs.qualifications, 
                jobs.created_at,
                employers.employer_name AS company_name,
                employers.company_logo_path,
                employers.industry AS industry,
                employers.recruitment_type AS type_of_recruitment,
                employers.city AS location,
                (SELECT COUNT(*) FROM applications 
                 WHERE applications.job_id = jobs.job_id 
                 AND applications.applicant_id = %s) as has_applied
            FROM jobs
            LEFT JOIN employers ON jobs.employer_id = employers.employer_id
            WHERE jobs.status = 'active'
            ORDER BY jobs.created_at DESC
            """,
            (applicant_id,),
            fetch="all"
        )

    except Exception as e:
        flash(f"Failed to fetch jobs: {e}", "danger")
        jobs = []
    finally:
        conn.close()

    return render_template("Applicant/applicant_home.html", jobs=jobs)


@applicants_bp.route('/apply/<int:job_id>', methods=['POST'])
def apply_job(job_id):
    if "applicant_id" not in session:
        return jsonify({"success": False, "message": "You must login first."}), 401

    conn = create_connection()
    if not conn:
        return jsonify({"success": False, "message": "Database connection failed."}), 500

    try:
        applicant_id = session["applicant_id"]

        existing = run_query(
            conn,
            "SELECT 1 FROM applications WHERE job_id=%s AND applicant_id=%s",
            (job_id, applicant_id),
            fetch="one"
        )
        if existing:
            return jsonify({"success": False, "message": "You have already applied to this job."}), 400

        job_details = run_query(
            conn,
            """SELECT j.job_position, j.employer_id, e.employer_name 
               FROM jobs j 
               JOIN employers e ON j.employer_id = e.employer_id 
               WHERE j.job_id = %s""",
            (job_id,),
            fetch="one"
        )

        applicant_details = run_query(
            conn,
            "SELECT first_name, last_name FROM applicants WHERE applicant_id = %s",
            (applicant_id,),
            fetch="one"
        )

        # Insert application
        run_query(
            conn,
            "INSERT INTO applications (job_id, applicant_id, applied_at) VALUES (%s, %s, NOW())",
            (job_id, applicant_id)
        )

        if job_details and applicant_details:
            employer_id = job_details["employer_id"]
            job_position = job_details["job_position"]
            applicant_name = f"{applicant_details['first_name']} {applicant_details['last_name']}"

            # Use existing notification system
            try:
                create_notification(
                    # Use job_application notification type instead of employer_approval
                    notification_type='job_application',
                    title=f"New Application for {job_position}",
                    message=f"{applicant_name} has applied to your job posting",
                    count=1,
                    related_ids=[job_id],
                    employer_id=employer_id
                )
            except Exception as notif_error:
                print(f"[v0] Error creating notification: {notif_error}")
                # Continue even if notification fails

            # Try to increment employer applicant count if column exists
            try:
                run_query(
                    conn,
                    "UPDATE employers SET application_count = application_count + 1 WHERE employer_id = %s",
                    (employer_id,)
                )
            except Exception:
                # Fallback to old column name if DB still uses applicant_count
                try:
                    run_query(
                        conn,
                        "UPDATE employers SET applicant_count = applicant_count + 1 WHERE employer_id = %s",
                        (employer_id,)
                    )
                except Exception:
                    print("[v0] Skipping employers application count update (columns may be missing):", e)

            # Also increment the job's application_count so frontend shows correct count
            try:
                run_query(
                    conn,
                    "UPDATE jobs SET application_count = application_count + 1 WHERE job_id = %s",
                    (job_id,)
                )
            except Exception:
                try:
                    run_query(
                        conn,
                        "UPDATE jobs SET applicant_count = applicant_count + 1 WHERE job_id = %s",
                        (job_id,)
                    )
                except Exception:
                    # ignore if column missing
                    pass

        conn.commit()

        # Fetch updated job applicant count
        new_count_row = run_query(
            conn,
            "SELECT application_count FROM jobs WHERE job_id = %s",
            (job_id,),
            fetch="one"
        )
        new_count = new_count_row["application_count"] if new_count_row else 0

        return jsonify({
            "success": True,
            "message": "Application submitted successfully!",
            "application_count": new_count
        })

    except Exception as e:
        conn.rollback()
        return jsonify({"success": False, "message": f"Error submitting application: {str(e)}"}), 500
    finally:
        conn.close()


@applicants_bp.route('/report', methods=['POST'])
def report_job():
    if "applicant_id" not in session:
        return jsonify({"success": False, "message": "You must log in first."}), 401

    data = request.get_json()
    job_id = data.get("job_id")
    applicant_id = session["applicant_id"]
    reason = data.get("reason")

    if not job_id or not reason:
        return jsonify({"success": False, "message": "Job ID and reason are required."}), 400

    conn = create_connection()
    if not conn:
        return jsonify({"success": False, "message": "Database connection failed."}), 500

    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT id FROM job_reports WHERE job_id=%s AND applicant_id=%s",
            (job_id, applicant_id)
        )
        if cursor.fetchone():
            return jsonify({"success": False, "message": "You already reported this job."})

        cursor.execute(
            "INSERT INTO job_reports (job_id, applicant_id, reason) VALUES (%s, %s, %s)",
            (job_id, applicant_id, reason)
        )
        conn.commit()
        return jsonify({"success": True})

    except Exception as e:
        print("Report Error:", e)
        conn.rollback()
        return jsonify({"success": False, "message": "Failed to submit report."}), 500

    finally:
        cursor.close()
        conn.close()


@applicants_bp.route("/job/<int:job_id>")
def job_page(job_id):
    if "applicant_id" not in session:
        # return plain text with 401 so fetch.ok will be false
        return "Please log in to view job details.", 401

    conn = create_connection()
    if not conn:
        return "Database connection failed.", 500

    try:
        job = run_query(
            conn,
            "SELECT j.*, e.employer_name AS company_name, e.company_logo_path "
            "FROM jobs j "
            "LEFT JOIN employers e ON j.employer_id = e.employer_id "
            "WHERE j.job_id = %s",
            (job_id,),
            fetch="one"
        )

        if not job:
            return "Job not found.", 404

        # Return only modal fragment HTML
        return render_template("Applicant/job_modal_content.html", job=job)

    except Exception as e:
        print(f"[job_page] Error fetching job {job_id}: {e}")
        return "An error occurred while fetching job details.", 500

    finally:
        conn.close()


@applicants_bp.route("/notifications")
def notifications():
    if "applicant_id" not in session:
        flash("Please log in to access this page.", "warning")
        return redirect(url_for("home"))

    if session.get("applicant_status") == "Reupload":
        flash("Please complete your document reupload first.", "info")
        return redirect(url_for("applicants.account_security"))

    # Fetch notifications for the current applicant and pass to template
    try:
        all_notifs = get_notifications(limit=200)
        applicant_id = session.get('applicant_id')
        notifications = []
        # Normalize types that should NOT be shown to applicants (admin-only)
        admin_only_types = {
            'employer_approval', 'applicant_approval', 'employer_reported', 'employer_outdated_docu', 'applicant_batch'
        }
        for n in (all_notifs or []):
            try:
                # First, always skip admin-only notification types regardless of FK (defensive for existing bad rows)
                if n.get('notification_type') in admin_only_types:
                    continue

                # direct FK match
                if n.get('applicant_id') == applicant_id:
                    notifications.append(n)
                    continue

                # fallback: related_ids may contain the applicant id (stored as ints or strings)
                related = n.get('related_ids') or []
                related_norm = [int(x) if isinstance(x, (int, str)) and str(x).isdigit() else None for x in related]
                related_norm = [x for x in related_norm if x is not None]
                if applicant_id in related_norm:
                    notifications.append(n)
            except Exception:
                # be resilient to malformed related_ids
                continue
    except Exception as e:
        print('[v0] Failed to load notifications:', e)
        notifications = []

    return render_template("Applicant/notif.html", notifications=notifications)


@applicants_bp.route('/api/notifications/<int:notif_id>/read', methods=['POST'])
def mark_applicant_notification_read(notif_id):
    if 'applicant_id' not in session:
        return jsonify({'success': False, 'message': 'Not logged in'}), 401

    applicant_id = session['applicant_id']
    conn = create_connection()
    if not conn:
        return jsonify({'success': False, 'message': 'DB connection failed'}), 500

    try:
        row = run_query(conn, 'SELECT applicant_id FROM notifications WHERE notification_id = %s', (notif_id,), fetch='one')
        conn.close()
        if not row or row.get('applicant_id') != applicant_id:
            return jsonify({'success': False, 'message': 'Notification not found'}), 404

        ok = mark_notification_read(notif_id)
        if ok:
            return jsonify({'success': True})
        else:
            return jsonify({'success': False, 'message': 'Failed to mark read'}), 500
    except Exception as e:
        try:
            conn.close()
        except Exception:
            pass
        print('[v0] Error marking notification read:', e)
        return jsonify({'success': False, 'message': str(e)}), 500


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


@applicants_bp.route('/register', methods=['GET', 'POST'])
def register():
    """Render and process applicant registration form."""
    if request.method == 'POST':
        print(f"[v0] Applicant registration form submitted")

        result = register_applicant(request.form, request.files)
        if result is None:
            success, message = False, "Registration failed unexpectedly."
        else:
            success, message = result

        flash(message, "success" if success else "danger")

        if success:
            return redirect(url_for('home'))
        else:
            return redirect(url_for('applicants.register'))

    return render_template('Landing_Page/applicant_registration.html')


@applicants_bp.route('/account-security', methods=['GET', 'POST'])
def account_security():
    """Applicant account & security page (exists so templates can link to it)."""
    if 'applicant_id' not in session:
        flash('Please log in to access this page.', 'warning')
        return redirect(url_for('home'))

    applicant_id = session['applicant_id']
    conn = create_connection()
    if not conn:
        flash('Database connection failed.', 'danger')
        return redirect(url_for('applicants.applicant_home'))

    try:
        applicant = run_query(conn, 'SELECT * FROM applicants WHERE applicant_id = %s', (applicant_id,), fetch='one')
        conn.close()
        return render_template('Applicant/acc&secu.html', applicant=applicant)
    except Exception as e:
        try:
            conn.close()
        except Exception:
            pass
        print('[v0] Failed to load applicant account_security:', e)
        flash('Failed to load account security page.', 'danger')
        return redirect(url_for('applicants.applicant_home'))


@applicants_bp.route('/applications')
def applications_page():
    """Render the applicant's Applications page. The page uses client-side JS to load data from /applicants/api/applications."""
    if 'applicant_id' not in session:
        flash('Please log in to access this page.', 'warning')
        return redirect(url_for('home'))

    if session.get('applicant_status') == 'Reupload':
        flash('Please complete your document reupload first.', 'info')
        return redirect(url_for('applicants.account_security'))

    # Render the template; JS will call /applicants/api/applications to populate the list
    return render_template('Applicant/application.html')


@applicants_bp.route('/api/applications')
def api_applications():
    """Return JSON list of applications for the logged-in applicant.
    Fields match what the frontend expects: id, job_id, jobTitle, companyName, location, date, status
    """
    if 'applicant_id' not in session:
        return jsonify({'success': False, 'message': 'Not logged in'}), 401

    applicant_id = session['applicant_id']
    conn = create_connection()
    if not conn:
        return jsonify({'success': False, 'message': 'DB connection failed'}), 500

    try:
        # Try to select common id column names (application_id or id)
        rows = run_query(
            conn,
            """
            SELECT
                a.id AS id,
                a.job_id,
                j.job_position AS jobTitle,
                e.employer_name AS companyName,
                e.city AS location,
                a.applied_at AS date,
                COALESCE(a.status, 'Applied') AS status
            FROM applications a
            LEFT JOIN jobs j ON a.job_id = j.job_id
            LEFT JOIN employers e ON j.employer_id = e.employer_id
            WHERE a.applicant_id = %s
            ORDER BY a.applied_at DESC
            """,
            (applicant_id,),
            fetch='all'
        ) or []

        # Normalize date to ISO strings for client-side Date parsing
        apps = []
        for r in rows:
            d = r.get('date')
            if hasattr(d, 'isoformat'):
                date_str = d.isoformat()
            else:
                date_str = str(d) if d is not None else None

            apps.append({
                'id': r.get('id'),
                'jobId': r.get('job_id'),
                'jobTitle': r.get('jobTitle') or r.get('job_position') or 'N/A',
                'companyName': r.get('companyName') or '',
                'location': r.get('location') or '',
                'date': date_str,
                'status': r.get('status') or 'Applied'
            })

        return jsonify(apps)
    except Exception as e:
        print('[v0] Error fetching applications:', e)
        return jsonify({'success': False, 'message': 'Failed to load applications'}), 500
    finally:
        conn.close()


@applicants_bp.route('/api/delete-application/<int:app_id>', methods=['DELETE'])
def api_delete_application(app_id):
    if 'applicant_id' not in session:
        return jsonify({'success': False, 'message': 'Not logged in'}), 401

    applicant_id = session['applicant_id']
    conn = create_connection()
    if not conn:
        return jsonify({'success': False, 'message': 'DB connection failed'}), 500

    try:
        # Verify ownership and get job_id
        row = run_query(conn, 'SELECT * FROM applications WHERE id = %s AND applicant_id = %s', (app_id, applicant_id), fetch='one')
        if not row:
            return jsonify({'success': False, 'message': 'Application not found'}), 404

        job_id = row.get('job_id')

        # Delete the application
        run_query(conn, 'DELETE FROM applications WHERE id = %s', (app_id,))

        # Decrement job.application_count if present
        try:
            run_query(conn, 'UPDATE jobs SET application_count = application_count - 1 WHERE job_id = %s AND application_count > 0', (job_id,))
        except Exception:
            # try legacy column name
            try:
                run_query(conn, 'UPDATE jobs SET applicant_count = applicant_count - 1 WHERE job_id = %s AND applicant_count > 0', (job_id,))
            except Exception:
                pass

        # If we can get employer id, decrement employer counts too
        try:
            jid = run_query(conn, 'SELECT employer_id FROM jobs WHERE job_id = %s', (job_id,), fetch='one')
            if jid and jid.get('employer_id'):
                emp_id = jid.get('employer_id')
                try:
                    run_query(conn, 'UPDATE employers SET application_count = application_count - 1 WHERE employer_id = %s AND application_count > 0', (emp_id,))
                except Exception:
                    try:
                        run_query(conn, 'UPDATE employers SET applicant_count = applicant_count - 1 WHERE employer_id = %s AND applicant_count > 0', (emp_id,))
                    except Exception:
                        pass
        except Exception:
            pass

        conn.commit()
        return jsonify({'success': True})
    except Exception as e:
        conn.rollback()
        print('[v0] Error deleting application:', e)
        return jsonify({'success': False, 'message': 'Failed to delete application'}), 500
    finally:
        conn.close()
