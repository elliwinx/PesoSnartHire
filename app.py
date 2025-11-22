from backend.forgot_password import forgot_password_bp
from backend.admin import admin_bp
from backend.employers import employers_bp, check_expired_employer_documents
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime
from backend.applicants import applicants_bp, check_expired_recommendations
from flask import Flask, jsonify, render_template, request, redirect, url_for, session, flash, send_from_directory, make_response
from db_connection import create_connection, run_query
from backend.recaptcha import verify_recaptcha
from dotenv import load_dotenv
from pathlib import Path
from extensions import mail
from datetime import datetime
import os

# =========================================================
# STEP 1 — Load environment variables
# =========================================================
env_path = Path(__file__).resolve().parent / "backend" / ".env"
load_dotenv(dotenv_path=env_path)

# =========================================================
# STEP 2 — Initialize Flask app
# =========================================================
app = Flask(__name__)
app.secret_key = "seven-days-a-week"

# RECAPTCHA CONFIG
app.config["RECAPTCHA_SITE_KEY"] = os.environ.get("RECAPTCHA_SITE_KEY")
app.config["RECAPTCHA_SECRET_KEY"] = os.environ.get("RECAPTCHA_SECRET_KEY")

# MAIL CONFIG
app.config["MAIL_SERVER"] = "smtp.gmail.com"
app.config["MAIL_PORT"] = 587
app.config["MAIL_USE_TLS"] = True
app.config["MAIL_USERNAME"] = "samonteralphmatthew@gmail.com"
app.config["MAIL_PASSWORD"] = "sptkwkkzgscnsxtw"
app.config["MAIL_DEFAULT_SENDER"] = "samonteralphmatthew@gmail.com"

mail.init_app(app)


# =========================================================
# CUSTOM JINJA FILTER — "timeago"
# =========================================================
def time_ago(dt):
    if not dt:
        return "some time ago"

    now = datetime.now()
    diff = now - dt

    seconds = diff.total_seconds()
    minutes = int(seconds / 60)
    hours = int(minutes / 60)
    days = int(hours / 24)

    if seconds < 60:
        return "just now"
    elif minutes < 60:
        return f"{minutes} minute ago" if minutes == 1 else f"{minutes} minutes ago"
    elif hours < 24:
        return f"{hours} hour ago" if hours == 1 else f"{hours} hours ago"
    elif days < 7:
        return f"{days} day ago" if days == 1 else f"{days} days ago"
    else:
        return dt.strftime("%b %d, %Y")

# Register the filter
app.jinja_env.filters["timeago"] = time_ago

# =========================================================
# STEP 3 — Make RECAPTCHA key available in templates
# =========================================================
@app.context_processor
def inject_recaptcha_key():
    return {"RECAPTCHA_SITE_KEY": app.config.get("RECAPTCHA_SITE_KEY")}


# =========================================================
# STEP 4 — Import Blueprints
# =========================================================
app.register_blueprint(applicants_bp, url_prefix="/applicants")
app.register_blueprint(employers_bp, url_prefix="/employers")
app.register_blueprint(admin_bp, url_prefix="/admin")
app.register_blueprint(forgot_password_bp, url_prefix="/forgot-password")


# =========================================================
# STEP 5 — Routes
# =========================================================
@app.route("/")
def home():
    return render_template("Landing_Page/index.html")


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("home"))


@app.route('/uploads/<path:filename>')
def uploaded_file(filename):
    response = make_response(send_from_directory('uploads', filename))
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response


@app.route("/login", methods=["POST"])
def login():
    email = request.form.get("applicantEmail")
    password = request.form.get("applicantPassword")

    token = request.form.get("g-recaptcha-response")
    result = verify_recaptcha(token, request.remote_addr)
    if not result.get("success"):
        flash("CAPTCHA verification failed: " +
              str(result.get("error-codes")), "danger")
        return redirect(url_for("home"))

    flash("Login successful!", "success")
    return redirect(url_for("home"))


@app.route("/employer-login", methods=["POST"])
def employer_login():
    email = request.form.get("employerEmail")
    password = request.form.get("employerPassword")

    token = request.form.get("g-recaptcha-response")
    result = verify_recaptcha(token, request.remote_addr)
    if not result.get("success"):
        flash("CAPTCHA verification failed: " +
              str(result.get("error-codes")), "danger")
        return redirect(url_for("employer_login_page"))

    flash("Employer login successful!", "success")
    return redirect(url_for("employer_dashboard"))


@app.route("/flash", methods=["POST"])
def flash_message():
    data = request.get_json()
    message = data.get("message")
    category = data.get("category", "info")

    flash(message, category)
    return jsonify({"status": "ok"})


@app.route("/terms-and-conditions")
def terms_and_conditions():
    return render_template("Landing_Page/t_and_c_general.html")


# =========================================================
# STEP 6 — Run App
# =========================================================
if __name__ == "__main__":

    def start_scheduler():
        """Start the background scheduler with proper error handling."""
        try:
            scheduler = BackgroundScheduler()

            def safe_check_expired():
                try:
                    print("[v0] ⏱ Scheduler job STARTING at", datetime.now())

                    from backend.employers import check_expired_employer_documents
                    from backend.applicants import check_expired_recommendations

                    with app.app_context():
                        check_expired_employer_documents()
                        check_expired_recommendations()

                    print("[v0] ⏱ Scheduler job COMPLETED at", datetime.now())

                except Exception as e:
                    print(f"[v0] ✗ SCHEDULER ERROR: {e}")

            scheduler.add_job(
                safe_check_expired,
                'interval',
                minutes=1,   # testing
                id='check_expired_docs',
                replace_existing=True
            )

            scheduler.start()
            print("[v0] ✓ Central Scheduler STARTED")

        except Exception as e:
            print(f"[v0] ✗ Failed to start scheduler: {e}")

    start_scheduler()

    app.run(debug=True, use_reloader=False)
