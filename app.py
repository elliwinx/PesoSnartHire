from flask import Flask, jsonify, render_template, request, redirect, url_for, session
from db_connection import create_connection, run_query
from extensions import mail
from flask import send_from_directory, make_response
from pathlib import Path
import os
from dotenv import load_dotenv

# Blueprints
from backend.applicants import applicants_bp
from backend.employers import employers_bp
from backend.admin import admin_bp
from backend.forgot_password import forgot_password_bp

app = Flask(__name__)
app.secret_key = "seven-days-a-week"


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


# ==== Mail Config ====
app.config["MAIL_SERVER"] = "smtp.gmail.com"
app.config["MAIL_PORT"] = 587
app.config["MAIL_USE_TLS"] = True
app.config["MAIL_USERNAME"] = "samonteralphmatthew@gmail.com"
app.config["MAIL_PASSWORD"] = "sptkwkkzgscnsxtw"
app.config["MAIL_DEFAULT_SENDER"] = "samonteralphmatthew@gmail.com"

# ✅ initialize extensions here
mail.init_app(app)

# Register blueprints
app.register_blueprint(applicants_bp, url_prefix="/applicants")
app.register_blueprint(employers_bp, url_prefix="/employers")
app.register_blueprint(admin_bp, url_prefix="/admin")
app.register_blueprint(forgot_password_bp, url_prefix="/forgot-password")

if __name__ == "__main__":
    app.run(debug=True)


# ✅ Load .env from backend folder
env_path = Path(__file__).resolve().parent / "backend" / ".env"
load_dotenv(dotenv_path=env_path)

# ✅ Debug print to confirm
print("Loaded from:", env_path)
print("Key:", os.environ.get("RECAPTCHA_SITE_KEY"))

# ✅ Initialize Flask
app = Flask(__name__)

# ✅ Store keys in Flask config
app.config["RECAPTCHA_SITE_KEY"] = os.environ.get("RECAPTCHA_SITE_KEY")
app.config["RECAPTCHA_SECRET_KEY"] = os.environ.get("RECAPTCHA_SECRET_KEY")

# ✅ Make RECAPTCHA_SITE_KEY available in templates
@app.context_processor
def inject_recaptcha_key():
    return {"RECAPTCHA_SITE_KEY": app.config.get("RECAPTCHA_SITE_KEY")}