import random
import string
from datetime import datetime, timedelta
from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_mail import Message
from werkzeug.security import generate_password_hash
from db_connection import create_connection, run_query
from extensions import mail


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


# ==== TOKEN GENERATOR ====
def generate_token(length=6):
    chars = string.ascii_uppercase + string.digits
    return ''.join(random.choices(chars, k=length))


# ==== STEP 1: REQUEST TOKEN ====
@forgot_password_bp.route("/request", methods=["GET", "POST"])
def forgot_password_request():
    if request.method == "POST":
        email = request.form.get("forgotPasswordEmail")

        conn = create_connection()
        if not conn:
            flash("Database connection failed.", "danger")
            return redirect(url_for("forgot_password.forgot_password_request"))

        # Check if admin exists
        result = run_query(
            conn, "SELECT admin_id FROM admin WHERE email=%s", (email,), fetch=True)
        if not result:
            flash("Email not found", "danger")
            conn.close()
            return redirect(url_for("forgot_password.forgot_password_request"))

        # Remove old tokens for this email
        run_query(
            conn, "DELETE FROM admin_password_resets WHERE email=%s", (email,))

        # Insert new token
        token = generate_token(6)
        expires_at = datetime.now() + timedelta(minutes=5)
        run_query(conn, """
            INSERT INTO admin_password_resets (email, token, expires_at)
            VALUES (%s, %s, %s)
        """, (email, token, expires_at))

        # Send email
        msg = Message(
            subject="PESO SmartHire - Password Reset Token",
            sender="samonteralphmatthew@gmail.com",
            recipients=[email],
            body=f"Your password reset token is: {token}\n\n⚠️ This token will expire in 5 minutes.\n\nIf you did not request this token, please ignore this email.\n\nRegards,\nPESO SmartHire Team"
        )
        mail.send(msg)

        conn.close()
        flash("A reset token has been sent to your email.", "success")
        return redirect(url_for("forgot_password.forgot_password_reset_token"))

    return render_template("Forgot_Password/forgot_password_f2_email.html")


# ==== STEP 2: VERIFY TOKEN ====
@forgot_password_bp.route("/verify-token", methods=["POST"])
def verify_token():
    token = request.form.get("forgotPasswordTokenVerification")

    conn = create_connection()
    result = run_query(conn, """
        SELECT * FROM admin_password_resets
        WHERE token=%s AND is_used=FALSE
    """, (token,), fetch=True)

    if not result:
        flash("Invalid or expired token.", "danger")
        conn.close()
        return redirect(url_for("forgot_password.forgot_password_reset_token"))

    reset_entry = result[0]
    if reset_entry["expires_at"] < datetime.now():
        flash("This token has expired.", "danger")
        conn.close()
        return redirect(url_for("forgot_password.forgot_password_reset_token"))

    conn.close()
    # ✅ If valid, go to new password form
    return redirect(url_for("forgot_password.forgot_password_reset", token=token))


# ==== STEP 3: RESET PASSWORD ====
@forgot_password_bp.route("/reset/<token>", methods=["GET", "POST"])
def forgot_password_reset(token):
    conn = create_connection()
    if not conn:
        flash("Database connection failed.", "danger")
        return redirect(url_for("forgot_password.forgot_password_request"))

    # Check token validity again
    result = run_query(conn, """
        SELECT * FROM admin_password_resets
        WHERE token=%s AND is_used=FALSE
    """, (token,), fetch=True)

    if not result:
        flash("Invalid or expired token.", "danger")
        conn.close()
        return redirect(url_for("forgot_password.forgot_password_reset_token"))

    reset_entry = result[0]
    if reset_entry["expires_at"] < datetime.now():
        flash("This token has expired.", "danger")
        conn.close()
        return redirect(url_for("forgot_password.forgot_password_reset_token"))

    if request.method == "POST":
        new_password = request.form.get("newPassword")
        confirm_password = request.form.get("confirmPassword")

        if new_password != confirm_password:
            flash("Passwords do not match", "danger")
            return redirect(url_for("forgot_password.forgot_password_reset", token=token))

        hashed_pw = generate_password_hash(new_password)

        # Update password
        run_query(conn, "UPDATE admin SET password_hash=%s WHERE email=%s",
                  (hashed_pw, reset_entry["email"]))

        # Mark token as used
        run_query(conn, "UPDATE admin_password_resets SET is_used=TRUE WHERE id=%s",
                  (reset_entry["id"],))

        conn.close()
        flash("Password updated successfully. Please log in.", "success")
        return redirect(url_for("home"))  # adjust to your login/home route

    conn.close()
    return render_template("Forgot_Password/forgot_password_f4_new_password.html", token=token)
