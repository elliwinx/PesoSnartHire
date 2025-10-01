# backend/admin.py
from flask import Blueprint, render_template, request, redirect, url_for, session, flash
from werkzeug.security import check_password_hash
from db_connection import create_connection, run_query

admin_bp = Blueprint("admin", __name__)


# ===== Admin Home (Dashboard placeholder) =====
@admin_bp.route("/home")
def admin_home():
    if "admin_id" not in session:  # Protect route
        return redirect(url_for("admin.login"))
    return render_template("Admin/admin_home.html")


# ===== Admin Login =====
@admin_bp.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        admin_code = request.form.get("adminID")
        email = request.form.get("adminEmail")
        password = request.form.get("adminPassword")

        conn = create_connection()
        if not conn:
            flash("Database connection failed", "danger")
            return redirect(url_for("admin.login"))

        query = "SELECT * FROM admin WHERE admin_code = %s AND email = %s"
        result = run_query(conn, query, (admin_code, email), fetch=True)
        conn.close()

        if result:
            admin = result[0]
            if check_password_hash(admin["password_hash"], password):
                session["admin_id"] = admin["admin_id"]
                session["admin_code"] = admin["admin_code"]
                flash("Login successful!", "success")
                return redirect(url_for("admin.admin_home"))
            else:
                flash("Invalid password", "danger")
        else:
            flash("Invalid Admin ID or Email", "danger")

    return render_template("Admin/admin_login.html")
