from flask import Flask, jsonify, render_template
from db_connection import create_connection, run_query
from extensions import mail

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
