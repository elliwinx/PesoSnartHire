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


# ===== Admin Account & Security =====
@admin_bp.route("/account", methods=["GET", "POST"])
def account_settings():
    if "admin_id" not in session:
        return redirect(url_for("admin.login"))

    conn = create_connection()
    if not conn:
        flash("Database connection failed", "danger")
        return redirect(url_for("admin.admin_home"))

    if request.method == "POST":
        # Only allow email update
        new_email = request.form.get("email")
        update_query = "UPDATE admin SET email = %s WHERE admin_id = %s"
        result = run_query(conn, update_query,
                           (new_email, session["admin_id"]))
        conn.close()

        if result:
            flash("Email updated successfully", "success")
            session["admin_email"] = new_email
        else:
            flash("Failed to update email", "danger")

        return redirect(url_for("admin.account_settings"))

    # GET request → fetch current admin info
    query = "SELECT admin_code, email FROM admin WHERE admin_id = %s"
    result = run_query(conn, query, (session["admin_id"],), fetch=True)
    conn.close()

    admin_data = result[0] if result else None
    return render_template("Admin/admin_acc.html", admin=admin_data)

    if "admin_id" not in session:
        return redirect(url_for("admin.login"))

    conn = create_connection()
    if not conn:
        flash("Database connection failed", "danger")
        return redirect(url_for("admin.admin_home"))

    if request.method == "POST":
        # Only allow email update
        new_email = request.form.get("email")
        update_query = "UPDATE admin SET email = %s WHERE admin_id = %s"
        result = run_query(conn, update_query,
                           (new_email, session["admin_id"]))
        conn.close()

        if result:
            flash("Email updated successfully", "success")
            session["admin_email"] = new_email
        else:
            flash("Failed to update email", "danger")

        return redirect(url_for("admin.account_settings"))

    # GET request → fetch current admin info
    query = "SELECT admin_code, email FROM admin WHERE admin_id = %s"
    result = run_query(conn, query, (session["admin_id"],), fetch=True)
    conn.close()

    admin_data = result[0] if result else None
    return render_template("Admin/admin_acc.html", admin=admin_data)


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


# ===== Account & Security =====
@admin_bp.route("/account", methods=["GET", "POST"])
def account():
    if "admin_id" not in session:
        return redirect(url_for("admin.login"))

    conn = create_connection()
    if not conn:
        flash("Database connection failed", "danger")
        return redirect(url_for("admin.admin_home"))

    if request.method == "POST":
        # Only allow email update (for now)
        new_email = request.form.get("email")

        update_query = "UPDATE admin SET email = %s WHERE admin_id = %s"
        result = run_query(conn, update_query,
                           (new_email, session["admin_id"]))
        conn.close()

        if result:
            flash("Email updated successfully", "success")
            session["admin_email"] = new_email
        else:
            flash("Failed to update email", "danger")

        return redirect(url_for("admin.account"))

    # GET request → fetch current admin info
    query = "SELECT admin_code, email FROM admin WHERE admin_id = %s"
    result = run_query(conn, query, (session["admin_id"],), fetch=True)
    conn.close()

    admin_data = result[0] if result else None
    return render_template("Admin/admin_account.html", admin=admin_data)
