# backend/applicants.py
from flask import Blueprint, render_template, request, redirect, url_for, session, flash
from datetime import datetime
import os
from werkzeug.utils import secure_filename
from db_connection import create_connection, run_query

admin_bp = Blueprint("admin", __name__)


# ====== Admin navigation Pages =====
@admin_bp.route("/home")
def admin_home():
    return render_template("Admin/admin_home.html")
