# backend/forgot_password.py
import random
import string
from datetime import datetime, timedelta
from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_mail import Message
from werkzeug.security import generate_password_hash
from db_connection import create_connection, run_query
from extensions import mail  # your Flask-Mail instance
from backend.send_sms import send_sms

forgot_password_bp = Blueprint("forgot_password", __name__)

# ==== FORGOT PASSWORD ROUTES =====


@forgot_password_bp.route("/forgot-password")
def forgot_password():
    user_type = request.args.get("type", "admin")
    return render_template("Forgot_Password/forgot_password_f1.html", user_type=user_type)


@forgot_password_bp.route("/email")
def forgot_password_email():
    user_type = request.args.get("type", "admin")
    back_url = request.referrer or url_for("landing_page")
    return render_template("Forgot_Password/forgot_password_f2_email.html", back_url=back_url, user_type=user_type)


@forgot_password_bp.route("/phone")
def forgot_password_phone():
    user_type = request.args.get("type", "applicant")
    return render_template("Forgot_Password/forgot_password_f2_phone.html", user_type=user_type)


@forgot_password_bp.route("/reset_token")
def forgot_password_reset_token():
    user_type = request.args.get("type", "admin")
    return render_template("Forgot_Password/forgot_password_f3_token_verification.html", user_type=user_type)


# ===== TOKEN GENERATOR =====
def generate_token(length=6):
    chars = string.ascii_uppercase + string.digits
    return ''.join(random.choices(chars, k=length))


# ===== STEP 1: REQUEST PASSWORD RESET (EMAIL) =====
@forgot_password_bp.route("/request", methods=["GET", "POST"])
def forgot_password_request():
    user_type = request.args.get("type", "admin")  # default admin
    if request.method == "POST":
        email = request.form.get("forgotPasswordEmail")

        conn = create_connection()
        if not conn:
            flash("Database connection failed.", "danger")
            return redirect(url_for("forgot_password.forgot_password_request", type=user_type))

        # Choose table based on user type
        user_table = (
            "admin" if user_type == "admin"
            else "applicants" if user_type == "applicant"
            else "employers"
        )

        # Check if user exists
        user = run_query(
            conn, f"SELECT * FROM {user_table} WHERE email=%s", (email,), fetch="one")
        if not user:
            flash("Email not found.", "danger")
            conn.close()
            return redirect(url_for("forgot_password.forgot_password_request", type=user_type))

        # Generate token
        token = generate_token()
        expires_at = datetime.now() + timedelta(minutes=15)

        reset_table = (
            "admin_password_resets" if user_type == "admin"
            else "applicant_password_resets" if user_type == "applicant"
            else "employer_password_resets"
        )

        insert_query = f"""
            INSERT INTO {reset_table} (email, token, expires_at)
            VALUES (%s, %s, %s)
        """
        run_query(conn, insert_query, (email, token, expires_at))
        conn.close()

        # Send email
        msg = Message(
            "Password Reset Token",
            recipients=[email],
            body=f"Good Day Ka-PESO!\n\nWe received a request to reset your account password.\nHere is your password reset token:\n\n{token}\n\nThis token expires in 15 minutes.\nIf you did not request this, please disregard it.\n\nThank you,\nThe PESO team"
        )

        try:
            mail.send(msg)
            flash("Verification token sent to your email.", "success")
        except Exception as e:
            flash(f"Failed to send email: {e}", "danger")

        return redirect(url_for("forgot_password.forgot_password_reset_token", type=user_type))

    return render_template("Forgot_Password/forgot_password_f2_email.html", user_type=user_type)


# ===== STEP 1B: REQUEST PASSWORD RESET (PHONE) =====
@forgot_password_bp.route("/request-phone", methods=["GET", "POST"])
def forgot_password_request_phone():
    user_type = request.args.get("type", "applicant")

    if request.method == "POST":
        phone = request.form.get("forgotPasswordPhoneNumber")

        conn = create_connection()
        if not conn:
            flash("Database connection failed.", "danger")
            return redirect(url_for("forgot_password.forgot_password_phone", type=user_type))

        # Choose table based on user type (phone only for applicants and employers)
        if user_type == "admin":
            flash("Admin users must use email for password reset.", "danger")
            conn.close()
            return redirect(url_for("forgot_password.forgot_password_phone", type=user_type))

        user_table = (
            "applicants" if user_type == "applicant"
            else "employers"
        )

        # Check if user exists by phone
        user = run_query(
            conn, f"SELECT * FROM {user_table} WHERE phone=%s", (phone,), fetch="one")
        if not user:
            flash("Phone number not found.", "danger")
            conn.close()
            return redirect(url_for("forgot_password.forgot_password_phone", type=user_type))

        # Generate token
        token = generate_token()
        expires_at = datetime.now() + timedelta(minutes=15)

        reset_table = (
            "applicant_password_resets" if user_type == "applicant"
            else "employer_password_resets"
        )

        # Store token with email (for later password update)
        insert_query = f"""
            INSERT INTO {reset_table} (email, token, expires_at)
            VALUES (%s, %s, %s)
        """
        run_query(conn, insert_query, (user['email'], token, expires_at))
        conn.close()

        # In production, send SMS instead of email
        # For now, we'll show the token (you should integrate with SMS service like Twilio)
       # ===== Send token via ClickSend SMS =====
        message = f"""Hello from PESO! \n\nHere’s your one-time password (OTP): {token} \n\nIt’s valid for 15 minutes.
        Ignore if you didn't request this.
        - PESO Team"""

        success = send_sms(phone, message)

        if success:
            flash("Verification token sent via SMS.", "success")
        else:
            flash("Failed to send SMS. Please try again or contact support.", "danger")

        return redirect(url_for("forgot_password.forgot_password_reset_token", type=user_type))

    return render_template("Forgot_Password/forgot_password_f2_phone.html", user_type=user_type)


# ===== STEP 2: VERIFY TOKEN =====
@forgot_password_bp.route("/verify-token", methods=["GET", "POST"])
def verify_token():
    user_type = request.args.get("type", "admin")

    if request.method == "POST":
        token = request.form.get("forgotPasswordTokenVerification")

        conn = create_connection()
        if not conn:
            flash("Database connection failed.", "danger")
            return redirect(url_for("forgot_password.forgot_password_reset_token", type=user_type))

        reset_table = (
            "admin_password_resets" if user_type == "admin"
            else "applicant_password_resets" if user_type == "applicant"
            else "employer_password_resets"
        )

        query = f"""
            SELECT * FROM {reset_table} WHERE token=%s AND is_used=FALSE
        """
        reset_entry = run_query(conn, query, (token,), fetch="one")
        conn.close()

        if not reset_entry:
            flash("Invalid or expired token.", "danger")
            return redirect(url_for("home", type=user_type))

        if reset_entry["expires_at"] < datetime.now():
            flash("This token has expired.", "danger")
            return redirect(url_for("home", type=user_type))

        flash("Token verified. You can now change your password.", "success")
        return redirect(url_for("forgot_password.forgot_password_reset", token=token, type=user_type))

    return render_template("Forgot_Password/forgot_password_f3_token_verification.html", user_type=user_type)


# ===== STEP 3: RESET PASSWORD =====
@forgot_password_bp.route("/reset/<token>", methods=["GET", "POST"])
def forgot_password_reset(token):
    user_type = request.args.get("type", "admin")

    conn = create_connection()
    if not conn:
        flash("Database connection failed.", "danger")
        return redirect(url_for("forgot_password.forgot_password_reset_token", type=user_type))

    reset_table = (
        "admin_password_resets" if user_type == "admin"
        else "applicant_password_resets" if user_type == "applicant"
        else "employer_password_resets"
    )

    query = f"SELECT * FROM {reset_table} WHERE token=%s AND is_used=FALSE"
    reset_entry = run_query(conn, query, (token,), fetch="one")

    if not reset_entry:
        flash("Invalid or expired token.", "danger")
        conn.close()
        return redirect(url_for("forgot_password.forgot_password_reset_token", type=user_type))

    if reset_entry["expires_at"] < datetime.now():
        flash("This token has expired.", "danger")
        conn.close()
        return redirect(url_for("forgot_password.forgot_password_reset_token", type=user_type))

    if request.method == "POST":
        new_password = request.form.get("newPassword")
        confirm_password = request.form.get("confirmPassword")

        if new_password != confirm_password:
            flash("Passwords do not match.", "danger")
            conn.close()
            return render_template("Forgot_Password/forgot_password_f4_new_password.html", token=token, user_type=user_type)

        hashed_password = generate_password_hash(new_password)

        # Update correct table based on user_type
        user_table = (
            "admin" if user_type == "admin"
            else "applicants" if user_type == "applicant"
            else "employers"
        )

        run_query(conn, f"UPDATE {user_table} SET password_hash=%s WHERE email=%s",
                  (hashed_password, reset_entry["email"]))

        # Mark token as used
        run_query(
            conn, f"UPDATE {reset_table} SET is_used=TRUE WHERE token=%s", (token,))
        conn.close()

        flash("Password updated successfully! You can now log in.", "success")

        if user_type == "admin":
            return redirect(url_for("home"))
        elif user_type == "applicant":
            return redirect(url_for("home"))
        else:
            return redirect(url_for("home"))

    return render_template("Forgot_Password/forgot_password_f4_new_password.html", token=token, user_type=user_type)
