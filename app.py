from flask import Flask, jsonify, render_template
from db_connection import create_connection, run_query

# Blueprints
from backend.applicants import applicants_bp
from backend.employers import employers_bp
from backend.admin import admin_bp

app = Flask(__name__)
app.secret_key = "seven-days-a-week"

# Register blueprints with prefixes
app.register_blueprint(applicants_bp, url_prefix="/applicants")
app.register_blueprint(employers_bp, url_prefix="/employers")
app.register_blueprint(admin_bp, url_prefix="/admin")


# ===== General Routes =====
@app.route("/")
def home():
    return render_template("Landing_Page/index.html")


@app.route("/forgot-password")
def forgot_password():
    return render_template("Forgot_Password/forgot_password_f1.html")


@app.route("/forgot-password-email")
def forgot_password_email():
    return render_template("Forgot_Password/forgot_password_f2_email.html")


@app.route("/forgot-password-phone")
def forgot_password_phone():
    return render_template("Forgot_Password/forgot_password_f2_phone.html")


@app.route("/forgot-password-reset_token")
def forgot_password_reset_token():
    return render_template("Forgot_Password/forgot_password_f3_token_verification.html")


# ===== DB Connection Test =====
@app.route("/dbtest")
def dbtest():
    conn = create_connection()
    if not conn:
        return "❌ DB connection failed", 500
    try:
        res = run_query(conn, "SELECT DATABASE() AS db;", fetch=True)
        return jsonify({"connected_database": res[0]["db"]})
    finally:
        conn.close()


if __name__ == "__main__":
    app.run(debug=True)
