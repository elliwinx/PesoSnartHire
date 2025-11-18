from datetime import datetime
from dateutil.relativedelta import relativedelta
import os
import logging

logger = logging.getLogger(__name__)

# Adjust these if your DB column names differ
BACKUP_COLS = {
    "dole_no_pending_case": {
        "path": "dole_no_pending_case_path",
        "expiry": "dole_no_pending_case_expiry",
        "warning": "dole_no_pending_case_warning_sent",
        "last_update": "dole_no_pending_case_last_update"
    },
    "dole_authority": {
        "path": "dole_authority_to_recruit_path",
        "expiry": "dole_authority_expiry",
        "warning": "dole_authority_warning_sent",
        "last_update": "dole_authority_last_update"
    },
    "dmw_no_pending_case": {
        "path": "dmw_no_pending_case_path",
        "expiry": "dmw_no_pending_case_expiry",
        "warning": "dmw_no_pending_case_warning_sent",
        "last_update": "dmw_no_pending_case_last_update"
    },
    "license_to_recruit": {
        "path": "license_to_recruit_path",
        "expiry": "license_to_recruit_expiry",
        "warning": "license_to_recruit_warning_sent",
        "last_update": "license_to_recruit_last_update"
    }
}

# corresponding backup column name generator: e.g. old_dole_no_pending_case_path


def backup_col(col_name):
    return f"old_{col_name}"


def safe_remove_file(file_path):
    try:
        if not file_path:
            return False
        abs_path = os.path.join("static", file_path)
        if os.path.exists(abs_path):
            os.remove(abs_path)
            logger.info(f"Deleted file: {abs_path}")
            return True
        else:
            logger.warning(f"File not found (skip delete): {abs_path}")
            return False
    except Exception as e:
        logger.warning(f"Failed to delete file {file_path}: {e}")
        return False


def validate_recruitment_type_change(employer_id, db, new_type, current_data):
    """
    NEW: Validate that required documents exist for new recruitment type BEFORE any DB update.
    This prevents the constraint violation error.

    Returns: (is_valid: bool, missing_docs: list, error_msg: str)
    """
    try:
        logger.info(
            f"[Validation] Checking documents for employer {employer_id} changing to {new_type}")

        missing_docs = []

        if new_type == "Local":
            dole_no_pending = current_data.get("dole_no_pending_case_path")
            dole_authority = current_data.get("dole_authority_to_recruit_path")

            logger.info(
                f"[Validation] Local - dole_no_pending: {bool(dole_no_pending)} ({dole_no_pending}), dole_authority: {bool(dole_authority)} ({dole_authority})")

            if not dole_no_pending:
                missing_docs.append("DOLE No Pending Case")
            if not dole_authority:
                missing_docs.append("DOLE Authority to Recruit")

        elif new_type == "International":
            dmw_no_pending = current_data.get("dmw_no_pending_case_path")
            license_to_recruit = current_data.get("license_to_recruit_path")

            logger.info(
                f"[Validation] International - dmw_no_pending: {bool(dmw_no_pending)} ({dmw_no_pending}), license: {bool(license_to_recruit)} ({license_to_recruit})")

            if not dmw_no_pending:
                missing_docs.append("DMW No Pending Case")
            if not license_to_recruit:
                missing_docs.append("License to Recruit")

        if missing_docs:
            error_msg = f"Cannot change to {new_type}. Missing: {', '.join(missing_docs)}"
            logger.warning(f"[Validation] {error_msg}")
            return False, missing_docs, error_msg

        logger.info(
            f"[Validation] ✓ All required documents present for {new_type}")
        return True, [], ""

    except Exception as e:
        logger.exception(f"[Validation] Error during document validation: {e}")
        return False, [], f"Validation error: {str(e)}"


def handle_recruitment_type_change(employer_id, db, old_type, new_type):
    """
    Called when an employer requests recruitment_type change.
    - Back up ALL old document fields into old_* columns
    - Set recruitment_type to new_type, mark pending and inactive
    - Do NOT delete any files yet
    """
    try:
        cursor = db.cursor(dictionary=True)
        cursor.execute("""
            SELECT * FROM employers WHERE employer_id = %s
        """, (employer_id,))
        employer = cursor.fetchone()
        if not employer:
            logger.error(
                f"[handle_recruitment_type_change] Employer {employer_id} not found")
            return {"success": False, "message": "Employer not found"}

        is_valid, missing_docs, error_msg = validate_recruitment_type_change(
            employer_id, db, new_type, employer
        )

        if not is_valid:
            logger.warning(
                f"[handle_recruitment_type_change] Validation failed: {error_msg}")
            return {
                "success": False,
                "message": error_msg,
                "missing_docs": missing_docs
            }

        now = datetime.now()

        # Build backup assignment list
        backup_assignments = []
        backup_values = []
        for group in BACKUP_COLS.values():
            p = group["path"]
            e = group["expiry"]
            w = group["warning"]
            l = group["last_update"]

            backup_assignments.extend([
                f"{backup_col(p)} = %s",
                f"{backup_col(e)} = %s",
                f"{backup_col(w)} = %s",
                f"{backup_col(l)} = %s"
            ])
            backup_values.extend([
                employer.get(p),
                employer.get(e),
                employer.get(w),
                employer.get(l)
            ])

        update_query = f"""
            UPDATE employers SET
                old_recruitment_type = recruitment_type,
                recruitment_type = %s,
                status = 'Pending',
                is_active = 0,
                recruitment_type_change_pending = 1,
                updated_at = %s,
                {', '.join(backup_assignments)}
            WHERE employer_id = %s
        """

        params = [new_type, now] + backup_values + [employer_id]
        cursor.execute(update_query, params)
        db.commit()
        logger.info(
            f"[handle_recruitment_type_change] ✓ Updated employer {employer_id}: {old_type} -> {new_type}")

        # Notification logic (reuse your existing create_notification)
        notif_title = f"Recruitment Type Change - {employer.get('employer_name')}"
        notif_message = f"Employer {employer.get('employer_name')} changed recruitment type from {old_type} to {new_type}. Please re-review their documents."
        try:
            cursor.execute("""
                UPDATE notifications SET
                    title = %s, message = %s, count = count + 1, is_read = 0, updated_at = NOW()
                WHERE employer_id = %s AND notification_type = 'employer_approval'
            """, (notif_title, notif_message, employer_id))
            if cursor.rowcount == 0:
                # fallback to your create_notification helper
                from .notifications import create_notification
                create_notification(
                    notification_type="employer_approval",
                    title=notif_title,
                    message=notif_message,
                    related_ids=[employer_id],
                    employer_id=employer_id,
                    recruitment_type=new_type
                )
            db.commit()
            logger.info(
                f"[handle_recruitment_type_change] ✓ Notification created for employer {employer_id}")
        except Exception as e:
            logger.exception(
                f"[handle_recruitment_type_change] Failed to update/create notification: {e}")

        return {"success": True, "message": "Recruitment type change marked for approval and backed up."}

    except Exception as e:
        db.rollback()
        logger.exception(f"[handle_recruitment_type_change] Error: {e}")
        return {"success": False, "message": "Error processing recruitment type change", "error": str(e)}


def approve_recruitment_type_change(employer_id, db):
    """
    Admin approves the recruitment type change:
    - Delete OLD documents (from old_* backup fields)
    - Set expiries for current (new) documents (if they exist)
    - Clear backup columns and pending flag, activate account
    """
    try:
        cursor = db.cursor(dictionary=True)
        cursor.execute("""
            SELECT recruitment_type, old_recruitment_type,
                   %s, %s, %s, %s, %s, %s, %s, %s
            FROM employers WHERE employer_id = %s AND recruitment_type_change_pending = 1
        """ % (
            BACKUP_COLS["dole_no_pending_case"]["path"], BACKUP_COLS["dole_no_pending_case"]["expiry"],
            BACKUP_COLS["dole_authority"]["path"], BACKUP_COLS["dole_authority"]["expiry"],
            BACKUP_COLS["dmw_no_pending_case"]["path"], BACKUP_COLS["dmw_no_pending_case"]["expiry"],
            BACKUP_COLS["license_to_recruit"]["path"], BACKUP_COLS["license_to_recruit"]["expiry"]
        ), (employer_id,))
        employer = cursor.fetchone()
        if not employer:
            logger.error(
                f"[approve_recruitment_type_change] Employer {employer_id} not found or no pending change")
            return {"success": False, "message": "Employer not found or no pending recruitment type change"}

        new_type = employer["recruitment_type"]
        old_type = employer["old_recruitment_type"]

        # Delete old documents from backups (only those that belonged to OLD recruitment type)
        files_to_delete = []
        if old_type == "Local":
            files_to_delete.append(employer.get(backup_col(
                BACKUP_COLS["dole_no_pending_case"]["path"])))
            files_to_delete.append(employer.get(
                backup_col(BACKUP_COLS["dole_authority"]["path"])))
        elif old_type == "International":
            files_to_delete.append(employer.get(backup_col(
                BACKUP_COLS["dmw_no_pending_case"]["path"])))
            files_to_delete.append(employer.get(backup_col(
                BACKUP_COLS["license_to_recruit"]["path"])))

        for f in files_to_delete:
            if f:
                safe_remove_file(f)

        now = datetime.now()
        # Prepare expiry updates based on new_type and presence of the new paths (current path columns)
        expiry_updates = {}
        if new_type == "Local":
            expiry_updates = {
                BACKUP_COLS["dole_no_pending_case"]["expiry"]: now + relativedelta(months=6),
                BACKUP_COLS["dole_authority"]["expiry"]: now + relativedelta(months=36),
                BACKUP_COLS["dmw_no_pending_case"]["expiry"]: None,
                BACKUP_COLS["license_to_recruit"]["expiry"]: None
            }
        else:  # International
            expiry_updates = {
                BACKUP_COLS["dmw_no_pending_case"]["expiry"]: now + relativedelta(months=6),
                BACKUP_COLS["license_to_recruit"]["expiry"]: now + relativedelta(months=48),
                BACKUP_COLS["dole_no_pending_case"]["expiry"]: None,
                BACKUP_COLS["dole_authority"]["expiry"]: None
            }

        # Build SET clause for clearing backups too
        set_clauses = []
        values = []
        for col, val in expiry_updates.items():
            if val is None:
                set_clauses.append(f"{col} = NULL")
            else:
                set_clauses.append(f"{col} = %s")
                values.append(val)

        # Activate employer, clear pending flag, clear all old_* backup columns
        # Compose clearing of all backup columns
        clear_backups = []
        for group in BACKUP_COLS.values():
            clear_backups.append(f"{backup_col(group['path'])} = NULL")
            clear_backups.append(f"{backup_col(group['expiry'])} = NULL")
            clear_backups.append(f"{backup_col(group['warning'])} = NULL")
            clear_backups.append(f"{backup_col(group['last_update'])} = NULL")
        clear_backups.append("old_recruitment_type = NULL")

        set_clauses.extend([
            "is_active = 1",
            "status = 'Active'",
            "recruitment_type_change_pending = 0",
            "updated_at = NOW()"
        ])
        set_clauses.extend(clear_backups)

        update_query = f"UPDATE employers SET {', '.join(set_clauses)} WHERE employer_id = %s"
        values.append(employer_id)

        cursor.execute(update_query, values)
        db.commit()

        logger.info(
            f"[approve_recruitment_type_change] ✓ Approved employer {employer_id}: {old_type} -> {new_type}")
        return {"success": True, "message": "Recruitment type change approved. Old documents removed and backups cleared."}

    except Exception as e:
        db.rollback()
        logger.exception(f"[approve_recruitment_type_change] Error: {e}")
        return {"success": False, "message": "Error approving recruitment type change", "error": str(e)}


def revert_recruitment_type_change(employer_id, db):
    """
    Admin rejects the recruitment type change:
    - Delete NEW documents that were uploaded for the pending change (current path columns for new type)
    - Restore ALL old document fields from old_* backup columns
    - Clear backup columns and set employer back to previous (active) state
    """
    try:
        cursor = db.cursor(dictionary=True)
        # fetch current and backup columns
        select_cols = []
        for group in BACKUP_COLS.values():
            select_cols.append(group["path"])
            select_cols.append(group["expiry"])
            select_cols.append(group["warning"])
            select_cols.append(group["last_update"])
            # corresponding backups
            select_cols.append(backup_col(group["path"]))
            select_cols.append(backup_col(group["expiry"]))
            select_cols.append(backup_col(group["warning"]))
            select_cols.append(backup_col(group["last_update"]))
        select_cols_str = ", ".join(
            select_cols + ["recruitment_type", "old_recruitment_type"])

        cursor.execute(f"""
            SELECT {select_cols_str}
            FROM employers
            WHERE employer_id = %s AND recruitment_type_change_pending = 1
        """, (employer_id,))
        row = cursor.fetchone()
        if not row:
            logger.error(
                f"[revert_recruitment_type_change] Employer {employer_id} not found or no pending change")
            return {"success": False, "message": "Employer not found or no pending recruitment type change"}

        new_type = row["recruitment_type"]
        old_type = row["old_recruitment_type"]

        # Delete only NEW documents that were uploaded for the pending change (current paths for new_type)
        files_to_delete = []
        if new_type == "Local":
            files_to_delete.append(
                row.get(BACKUP_COLS["dole_no_pending_case"]["path"]))
            files_to_delete.append(
                row.get(BACKUP_COLS["dole_authority"]["path"]))
        else:  # International
            files_to_delete.append(
                row.get(BACKUP_COLS["dmw_no_pending_case"]["path"]))
            files_to_delete.append(
                row.get(BACKUP_COLS["license_to_recruit"]["path"]))

        for f in files_to_delete:
            if f:
                safe_remove_file(f)

        # Build restore assignments: current_col = old_current_col
        restore_assignments = []
        restore_values = []
        for group in BACKUP_COLS.values():
            p = group["path"]
            e = group["expiry"]
            w = group["warning"]
            l = group["last_update"]

            restore_assignments.extend([
                f"{p} = {backup_col(p)}",
                f"{e} = {backup_col(e)}",
                f"{w} = {backup_col(w)}",
                f"{l} = {backup_col(l)}"
            ])
        # Restore recruitment_type from old_recruitment_type and clear old_* backups
        clear_backups = []
        for group in BACKUP_COLS.values():
            clear_backups.append(f"{backup_col(group['path'])} = NULL")
            clear_backups.append(f"{backup_col(group['expiry'])} = NULL")
            clear_backups.append(f"{backup_col(group['warning'])} = NULL")
            clear_backups.append(f"{backup_col(group['last_update'])} = NULL")
        clear_backups.append("old_recruitment_type = NULL")

        update_query = f"""
            UPDATE employers SET
                recruitment_type = old_recruitment_type,
                {', '.join(restore_assignments)},
                status = 'Active',
                is_active = 1,
                recruitment_type_change_pending = 0,
                updated_at = NOW(),
                {', '.join(clear_backups)}
            WHERE employer_id = %s
        """
        cursor.execute(update_query, (employer_id,))
        db.commit()

        logger.info(
            f"[revert_recruitment_type_change] ✓ Reverted employer {employer_id} back to {old_type}")
        return {"success": True, "message": f"Recruitment type change rejected. Reverted to {old_type}."}

    except Exception as e:
        db.rollback()
        logger.exception(f"[revert_recruitment_type_change] Error: {e}")
        return {"success": False, "message": "Error reverting recruitment type change", "error": str(e)}
