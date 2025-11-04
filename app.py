from flask import Flask, jsonify, render_template, request, redirect, url_for, session, flash
from db_connection import create_connection, run_query
from extensions import mail
from flask import send_from_directory, make_response

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


@app.route("/flash", methods=["POST"])
def flash_message():
    data = request.get_json()
    message = data.get("message")
    category = data.get("category", "info")

    flash(message, category)
    return jsonify({"status": "ok"})


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
