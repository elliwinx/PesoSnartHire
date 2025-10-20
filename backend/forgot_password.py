# backend/forgot_password.py
import random
import string
from datetime import datetime, timedelta
from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_mail import Message
from werkzeug.security import generate_password_hash
from db_connection import create_connection, run_query
from extensions import mail  # your Flask-Mail instance

forgot_password_bp = Blueprint("forgot_password", __name__)

# ==== FORGOT PASSWORD ROUTES =====


@forgot_password_bp.route("/forgot-password")
def forgot_password():
    return render_template("Forgot_Password/forgot_password_f1.html")


@forgot_password_bp.route("/email")
def forgot_password_email():
    back_url = request.referrer or url_for("landing_page")
    return render_template("Forgot_Password/forgot_password_f2_email.html", back_url=back_url)


@forgot_password_bp.route("/phone")
def forgot_password_phone():
    return render_template("Forgot_Password/forgot_password_f2_phone.html")


@forgot_password_bp.route("/reset_token")
def forgot_password_reset_token():
    return render_template("Forgot_Password/forgot_password_f3_token_verification.html")


# ===== TOKEN GENERATOR =====
def generate_token(length=6):
    chars = string.ascii_uppercase + string.digits
    return ''.join(random.choices(chars, k=length))


# ===== STEP 1: REQUEST PASSWORD RESET =====
@forgot_password_bp.route("/request", methods=["GET", "POST"])
def forgot_password_request():
    if request.method == "POST":
        email = request.form.get("forgotPasswordEmail")

        conn = create_connection()
        if not conn:
            flash("Database connection failed.", "danger")
            return redirect(url_for("forgot_password.forgot_password_request"))

        # Check if admin exists
        admin = run_query(
            conn, "SELECT admin_id FROM admin WHERE email=%s", (email,), fetch="one"
        )
        if not admin:
            flash("Email not found", "danger")
            conn.close()
            return redirect(url_for("forgot_password.forgot_password_request"))

        # Generate token & expiration
        token = generate_token()
        expires_at = datetime.now() + timedelta(minutes=15)

        insert_query = """
            INSERT INTO admin_password_resets (email, token, expires_at)
            VALUES (%s, %s, %s)
        """
        run_query(conn, insert_query, (email, token, expires_at))  # commit
        conn.close()

        # Send email
        msg = Message(
            "Password Reset Token",
            recipients=[email],
            body=f"Good Day Ka-PESO!\nYour password reset token is: {token}\nThis token expires in 15 minutes.\nIf you did not request this token, please just disregard it."
        )
        try:
            mail.send(msg)
            flash("Verification token sent to your email.", "success")
        except Exception as e:
            flash(f"Failed to send email: {e}", "danger")

        return redirect(url_for("forgot_password.forgot_password_reset_token"))

    return render_template("Forgot_Password/forgot_password_f2_email.html")


# ===== STEP 2: VERIFY TOKEN =====
@forgot_password_bp.route("/verify-token", methods=["GET", "POST"])
def verify_token():
    if request.method == "POST":
        token = request.form.get("forgotPasswordTokenVerification")

        conn = create_connection()
        if not conn:
            flash("Database connection failed.", "danger")
            return redirect(url_for("forgot_password.forgot_password_request"))

        query = """
            SELECT * FROM admin_password_resets
            WHERE token=%s AND is_used=FALSE
        """
        reset_entry = run_query(conn, query, (token,), fetch="one")
        conn.close()

        if not reset_entry:
            flash("Invalid or expired token.", "danger")
            return redirect(url_for("forgot_password.forgot_password_reset_token"))

        if reset_entry["expires_at"] < datetime.now():
            flash("This token has expired.", "danger")
            return redirect(url_for("forgot_password.forgot_password_reset_token"))

        flash("Token verified. You can now change your password.", "success")
        return redirect(url_for("forgot_password.forgot_password_reset", token=token))

    return render_template("Forgot_Password/forgot_password_f3_token_verification.html")


# ===== STEP 3: RESET PASSWORD =====
@forgot_password_bp.route("/reset/<token>", methods=["GET", "POST"])
def forgot_password_reset(token):
    conn = create_connection()
    if not conn:
        flash("Database connection failed.", "danger")
        return redirect(url_for("forgot_password.forgot_password_request"))

    query = """
        SELECT * FROM admin_password_resets
        WHERE token=%s AND is_used=FALSE
    """
    reset_entry = run_query(conn, query, (token,), fetch="one")

    if not reset_entry:
        flash("Invalid or expired token.", "danger")
        conn.close()
        return redirect(url_for("forgot_password.forgot_password_reset_token"))

    if reset_entry["expires_at"] < datetime.now():
        flash("This token has expired.", "danger")
        conn.close()
        return redirect(url_for("forgot_password.forgot_password_reset_token"))

    if request.method == "POST":
        new_password = request.form.get("newPassword")
        confirm_password = request.form.get("confirmPassword")

        if new_password != confirm_password:
            flash("Passwords do not match.", "danger")
            conn.close()
            return render_template("Forgot_Password/forgot_password_f4_new_password.html", token=token)

        hashed_password = generate_password_hash(new_password)
        run_query(conn, "UPDATE admin SET password_hash=%s WHERE email=%s",
                  (hashed_password, reset_entry["email"]))

        run_query(
            conn, "UPDATE admin_password_resets SET is_used=TRUE WHERE token=%s", (token,))
        conn.close()

        flash("Password updated successfully! You can now log in.", "success")
        return redirect(url_for("home"))  # <-- fixed redirect

    return render_template("Forgot_Password/forgot_password_f4_new_password.html", token=token)
