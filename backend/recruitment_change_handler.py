from datetime import datetime
from dateutil.relativedelta import relativedelta
import os
import logging

logger = logging.getLogger(__name__)

# Map of logical document groups to their DB columns
BACKUP_COLS = {
    "dole_no_pending_case": {
        "path": "dole_no_pending_case_path",
        "expiry": "dole_no_pending_case_expiry",
        "warning": "dole_no_pending_case_warning_sent",
        "uploaded_at": "dole_no_pending_uploaded_at",
    },
    "dole_authority": {
        "path": "dole_authority_to_recruit_path",
        "expiry": "dole_authority_expiry",
        "warning": "dole_authority_warning_sent",
        "uploaded_at": "dole_authority_uploaded_at",
    },
    "dmw_no_pending_case": {
        "path": "dmw_no_pending_case_path",
        "expiry": "dmw_no_pending_case_expiry",
        "warning": "dmw_no_pending_case_warning_sent",
        "uploaded_at": "dmw_no_pending_uploaded_at",
    },
    "license_to_recruit": {
        "path": "license_to_recruit_path",
        "expiry": "license_to_recruit_expiry",
        "warning": "license_to_recruit_warning_sent",
        "uploaded_at": "license_to_recruit_uploaded_at",
    }
}


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
    """Validate that necessary documents exist for the requested new_type.

    This function inspects the provided `current_data` (dictionary) for presence
    of required document paths. It does not change the DB.
    """
    try:
        logger.info(
            f"[Validation] Checking documents for employer {employer_id} changing to {new_type}")

        missing_docs = []

        if new_type == "Local":
            if not current_data.get("dole_no_pending_case_path"):
                missing_docs.append("DOLE No Pending Case")
            if not current_data.get("dole_authority_to_recruit_path"):
                missing_docs.append("DOLE Authority to Recruit")
        elif new_type == "International":
            if not current_data.get("dmw_no_pending_case_path"):
                missing_docs.append("DMW No Pending Case")
            if not current_data.get("license_to_recruit_path"):
                missing_docs.append("License to Recruit")

        if missing_docs:
            return False, missing_docs, f"Cannot change to {new_type}. Missing: {', '.join(missing_docs)}"

        return True, [], ""
    except Exception as e:
        logger.exception(f"Validation error: {e}")
        return False, [], str(e)


def handle_recruitment_type_change(employer_id, db, new_type, uploaded_paths=None):
    """Mark a recruitment type change as pending.

    FLOW:
      1. Back up ONLY OLD TYPE's document columns (old_* columns)
      2. Clear OLD TYPE's regular columns after backup
      3. Calculate and SET dates for NEW type documents immediately
      4. Mark employer as pending (status='Pending', is_active=0)
      5. Keep old document paths/info intact in old_* columns
      6. Notify admins for review

    Args:
        employer_id: ID of the employer
        db: Database connection
        new_type: New recruitment type ('Local' or 'International')
        uploaded_paths: Dict of uploaded file paths for new type documents
                       e.g. {'dole_no_pending_case_path': '/path/to/file', ...}
    """
    try:
        if uploaded_paths is None:
            uploaded_paths = {}

        now = datetime.now()
        cursor = db.cursor(dictionary=True)

        # Get employer record
        cursor.execute(
            "SELECT * FROM employers WHERE employer_id = %s", (employer_id,))
        employer = cursor.fetchone()

        if not employer:
            return {"success": False, "message": "Employer not found"}

        current_type = employer.get("recruitment_type")
        if current_type == new_type:
            return {"success": False, "message": "Recruitment type is already the requested type"}

        old_type = current_type

        # === DEBUG LOG: print current expiries ===
        logger.debug("=== EMPLOYER BEFORE CHANGE ===")
        for k in [
            "dole_no_pending_case_expiry",
            "dole_authority_expiry",
            "dmw_no_pending_case_expiry",
            "license_to_recruit_expiry"
        ]:
            logger.debug(f"{k}: {employer.get(k)}")

        cursor.execute("SET FOREIGN_KEY_CHECKS=0")
        cursor.execute("ALTER TABLE employers DISABLE KEYS")
        cursor.execute("SET sql_mode='NO_ZERO_DATE'")

        # === Step 1: Back up ONLY OLD TYPE's document-related columns ===
        backup_assignments = []
        backup_values = []

        # Determine which groups belong to the old type
        if old_type == "Local":
            groups_to_backup = ["dole_no_pending_case", "dole_authority"]
        elif old_type == "International":
            groups_to_backup = ["dmw_no_pending_case", "license_to_recruit"]
        else:
            groups_to_backup = []

        # Only backup the old type's columns
        for group_name in groups_to_backup:
            group = BACKUP_COLS[group_name]
            for key in ["path", "expiry", "warning", "uploaded_at"]:
                col = group[key]
                backup_assignments.append(f"{backup_col(col)} = %s")
                backup_values.append(employer.get(col))

        if backup_assignments:
            backup_query = f"""
                UPDATE employers
                SET {', '.join(backup_assignments)}
                WHERE employer_id = %s
            """
            cursor.execute(backup_query, backup_values + [employer_id])
            db.commit()

        # === DEBUG LOG: check what got saved in old_* columns ===
        logger.debug("=== AFTER BACKUP QUERY ===")
        cursor.execute("""
            SELECT old_dole_no_pending_case_expiry,
                   old_dole_authority_expiry,
                   old_dmw_no_pending_case_expiry,
                   old_license_to_recruit_expiry
            FROM employers WHERE employer_id = %s
        """, (employer_id,))
        backup_check = cursor.fetchone()
        logger.debug(f"Backed-up expiries: {backup_check}")

        # This ensures old documents don't show in the regular columns anymore
        clear_old_type_assignments = []
        if old_type == "Local":
            # Clearing DOLE columns since changing away from Local
            for key in ["path", "expiry", "warning", "uploaded_at"]:
                clear_old_type_assignments.append(
                    f"{BACKUP_COLS['dole_no_pending_case'][key]} = NULL")
                clear_old_type_assignments.append(
                    f"{BACKUP_COLS['dole_authority'][key]} = NULL")
        elif old_type == "International":
            # Clearing DMW columns since changing away from International
            for key in ["path", "expiry", "warning", "uploaded_at"]:
                clear_old_type_assignments.append(
                    f"{BACKUP_COLS['dmw_no_pending_case'][key]} = NULL")
                clear_old_type_assignments.append(
                    f"{BACKUP_COLS['license_to_recruit'][key]} = NULL")

        if clear_old_type_assignments:
            clear_query = f"""
                UPDATE employers
                SET {', '.join(clear_old_type_assignments)}
                WHERE employer_id = %s
            """
            cursor.execute(clear_query, (employer_id,))
            db.commit()
            logger.debug(f"Cleared {old_type} type columns after backup")

        # === Step 3: Set dates for NEW type documents in regular columns ===
        set_new_dates_assignments = []
        set_new_dates_values = []

        if new_type == "Local":
            set_new_dates_assignments.append(
                f"{BACKUP_COLS['dole_no_pending_case']['expiry']} = %s")
            set_new_dates_values.append(now + relativedelta(months=6))

            set_new_dates_assignments.append(
                f"{BACKUP_COLS['dole_authority']['expiry']} = %s")
            set_new_dates_values.append(now + relativedelta(months=36))

            set_new_dates_assignments.append(
                f"{BACKUP_COLS['dole_no_pending_case']['uploaded_at']} = %s")
            set_new_dates_values.append(now)

            set_new_dates_assignments.append(
                f"{BACKUP_COLS['dole_authority']['uploaded_at']} = %s")
            set_new_dates_values.append(now)

            dole_pending_path = uploaded_paths.get('dole_no_pending_case_path')
            dole_authority_path = uploaded_paths.get(
                'dole_authority_to_recruit_path')

            if dole_pending_path:
                set_new_dates_assignments.append(
                    f"{BACKUP_COLS['dole_no_pending_case']['path']} = %s")
                set_new_dates_values.append(dole_pending_path)
            else:
                set_new_dates_assignments.append(
                    f"{BACKUP_COLS['dole_no_pending_case']['path']} = NULL")

            if dole_authority_path:
                set_new_dates_assignments.append(
                    f"{BACKUP_COLS['dole_authority']['path']} = %s")
                set_new_dates_values.append(dole_authority_path)
            else:
                set_new_dates_assignments.append(
                    f"{BACKUP_COLS['dole_authority']['path']} = NULL")

        elif new_type == "International":
            set_new_dates_assignments.append(
                f"{BACKUP_COLS['dmw_no_pending_case']['expiry']} = %s")
            set_new_dates_values.append(now + relativedelta(months=6))

            set_new_dates_assignments.append(
                f"{BACKUP_COLS['license_to_recruit']['expiry']} = %s")
            set_new_dates_values.append(now + relativedelta(months=48))

            set_new_dates_assignments.append(
                f"{BACKUP_COLS['dmw_no_pending_case']['uploaded_at']} = %s")
            set_new_dates_values.append(now)

            set_new_dates_assignments.append(
                f"{BACKUP_COLS['license_to_recruit']['uploaded_at']} = %s")
            set_new_dates_values.append(now)

            dmw_pending_path = uploaded_paths.get('dmw_no_pending_case_path')
            license_path = uploaded_paths.get('license_to_recruit_path')

            if dmw_pending_path:
                set_new_dates_assignments.append(
                    f"{BACKUP_COLS['dmw_no_pending_case']['path']} = %s")
                set_new_dates_values.append(dmw_pending_path)
            else:
                set_new_dates_assignments.append(
                    f"{BACKUP_COLS['dmw_no_pending_case']['path']} = NULL")

            if license_path:
                set_new_dates_assignments.append(
                    f"{BACKUP_COLS['license_to_recruit']['path']} = %s")
                set_new_dates_values.append(license_path)
            else:
                set_new_dates_assignments.append(
                    f"{BACKUP_COLS['license_to_recruit']['path']} = NULL")

        if set_new_dates_assignments:
            set_dates_query = f"""
                UPDATE employers
                SET {', '.join(set_new_dates_assignments)}
                WHERE employer_id = %s
            """
            cursor.execute(set_dates_query,
                           set_new_dates_values + [employer_id])
            db.commit()

        # === Step 4: Mark employer as pending ===
        update_query = """
            UPDATE employers
            SET old_recruitment_type = %s,
                recruitment_type = %s,
                status = 'Pending',
                is_active = 0,
                recruitment_type_change_pending = 1,
                updated_at = %s
            WHERE employer_id = %s
        """
        cursor.execute(update_query, (old_type, new_type, now, employer_id))
        db.commit()

        cursor.execute("ALTER TABLE employers ENABLE KEYS")
        cursor.execute("SET FOREIGN_KEY_CHECKS=1")

        # === Step 5: Notify admins ===
        notif_title = f"Recruitment Type Change - {employer.get('employer_name')}"
        notif_message = (
            f"Employer {employer.get('employer_name')} changed recruitment type "
            f"from {old_type} to {new_type}. Please review their documents."
        )

        try:
            cursor.execute("""
                UPDATE notifications
                SET title = %s,
                    message = %s,
                    count = count + 1,
                    is_read = 0
                WHERE employer_id = %s
                  AND notification_type = 'employer_approval'
            """, (notif_title, notif_message, employer_id))

            if cursor.rowcount == 0:
                try:
                    from .notifications import create_notification
                    create_notification(
                        notification_type="employer_approval",
                        title=notif_title,
                        message=notif_message,
                        related_ids=[employer_id],
                        employer_id=employer_id,
                        recruitment_type=new_type
                    )
                except Exception:
                    logger.exception(
                        "Failed to create notification via create_notification")

            db.commit()
        except Exception as e:
            logger.exception(
                f"[notifications] Failed to update or create notifications: {e}")

        return {"success": True, "message": "Recruitment type change marked for approval."}

    except Exception as e:
        db.rollback()
        logger.exception(e)
        return {
            "success": False,
            "message": "Error processing recruitment type change",
            "error": str(e)
        }


def approve_recruitment_type_change(employer_id, db):
    """Approve a pending recruitment type change.

    This function performs a safe approval flow:
      - Loads ALL current and old_* backup columns
      - Deletes old-type backup files (those stored in old_* path columns)
      - Clears ALL old-type document columns (path, expiry, warning, uploaded_at)
      - Also clears all backup (old_*) columns to complete the cleanup
      - NEW-type dates are already set from handle_recruitment_type_change()
      - Activates the employer, clears pending flags, and clears backup columns
    """
    try:
        cursor = db.cursor(dictionary=True)

        # Build SELECT for all current and backup columns
        select_cols = ["recruitment_type", "old_recruitment_type"]
        for group in BACKUP_COLS.values():
            for key in ["path", "expiry", "warning", "uploaded_at"]:
                col = group[key]
                select_cols.append(col)
                select_cols.append(backup_col(col))

        cursor.execute(f"""
            SELECT {', '.join(select_cols)}
            FROM employers
            WHERE employer_id = %s AND recruitment_type_change_pending = 1
        """, (employer_id,))
        employer = cursor.fetchone()

        if not employer:
            return {"success": False, "message": "Employer not found or no pending change"}

        new_type = employer["recruitment_type"]
        old_type = employer["old_recruitment_type"]

        # Delete OLD-TYPE backup files using old_* path columns (if present)
        files_to_delete = []
        if old_type == "Local":
            files_to_delete.append(employer.get(backup_col(
                BACKUP_COLS['dole_no_pending_case']['path'])))
            files_to_delete.append(employer.get(
                backup_col(BACKUP_COLS['dole_authority']['path'])))
        elif old_type == "International":
            files_to_delete.append(employer.get(backup_col(
                BACKUP_COLS['dmw_no_pending_case']['path'])))
            files_to_delete.append(employer.get(
                backup_col(BACKUP_COLS['license_to_recruit']['path'])))

        for f in files_to_delete:
            safe_remove_file(f)

        now = datetime.now()

        columns_to_null = []

        # Clear ALL old-type document columns (path, expiry, warning, uploaded_at)
        if old_type == "Local":
            for key in ["path", "expiry", "warning", "uploaded_at"]:
                columns_to_null.append(
                    BACKUP_COLS['dole_no_pending_case'][key])
                columns_to_null.append(BACKUP_COLS['dole_authority'][key])
        else:  # International
            for key in ["path", "expiry", "warning", "uploaded_at"]:
                columns_to_null.append(BACKUP_COLS['dmw_no_pending_case'][key])
                columns_to_null.append(BACKUP_COLS['license_to_recruit'][key])

        # Clear ALL backup (old_*) columns
        for group in BACKUP_COLS.values():
            for key in ["path", "expiry", "warning", "uploaded_at"]:
                columns_to_null.append(backup_col(group[key]))

        # Build SET clauses
        set_clauses = ["recruitment_type = %s"]
        for col in columns_to_null:
            set_clauses.append(f"{col} = NULL")

        set_clauses.extend([
            "status = 'Approved'",
            "is_active = 1",
            "recruitment_type_change_pending = 0",
            "old_recruitment_type = NULL",
            "updated_at = NOW()"
        ])

        update_query = f"""
            UPDATE employers SET {', '.join(set_clauses)} WHERE employer_id = %s
        """

        cursor.execute(update_query, [new_type, employer_id])
        db.commit()

        return {"success": True, "message": "Recruitment type change approved."}

    except Exception as e:
        db.rollback()
        logger.exception(e)
        return {"success": False, "message": str(e)}


def revert_recruitment_type_change(employer_id, db):
    """Reject/revert a pending recruitment type change.

    This function:
      - Deletes any newly set documents for the requested (new) type
      - Clears all new-type document columns (path, expiry, warning, uploaded_at)
      - Restores all document columns from old_* backups
      - Clears backup columns and resets the employer state
    """
    try:
        cursor = db.cursor(dictionary=True)

        # Build SELECT for all current and backup columns
        select_cols = ["recruitment_type", "old_recruitment_type"]
        for group in BACKUP_COLS.values():
            for key in ["path", "expiry", "warning", "uploaded_at"]:
                col = group[key]
                select_cols.append(col)
                select_cols.append(backup_col(col))

        cursor.execute(f"""
            SELECT {', '.join(select_cols)}
            FROM employers
            WHERE employer_id = %s AND recruitment_type_change_pending = 1
        """, (employer_id,))
        row = cursor.fetchone()

        if not row:
            return {"success": False, "message": "Employer not found or no pending change"}

        new_type = row["recruitment_type"]
        old_type = row["old_recruitment_type"]

        # 1) Delete newly uploaded files that belong to the new (rejected) type
        files_to_delete = []
        if new_type == "International":
            files_to_delete.extend([
                row.get(BACKUP_COLS["dmw_no_pending_case"]["path"]),
                row.get(BACKUP_COLS["license_to_recruit"]["path"]),
            ])
        elif new_type == "Local":
            files_to_delete.extend([
                row.get(BACKUP_COLS["dole_no_pending_case"]["path"]),
                row.get(BACKUP_COLS["dole_authority"]["path"]),
            ])

        for f in files_to_delete:
            safe_remove_file(f)

        # This prevents stale data from being left in the DB
        clear_new_type_assignments = []
        if new_type == "Local":
            for key in ["path", "expiry", "warning", "uploaded_at"]:
                col = BACKUP_COLS["dole_no_pending_case"][key]
                clear_new_type_assignments.append(f"{col} = NULL")
                col = BACKUP_COLS["dole_authority"][key]
                clear_new_type_assignments.append(f"{col} = NULL")
        else:  # International
            for key in ["path", "expiry", "warning", "uploaded_at"]:
                col = BACKUP_COLS["dmw_no_pending_case"][key]
                clear_new_type_assignments.append(f"{col} = NULL")
                col = BACKUP_COLS["license_to_recruit"][key]
                clear_new_type_assignments.append(f"{col} = NULL")

        # This prevents NULL values from overwriting valid expiry dates
        restore_assignments = []
        if old_type == "Local":
            groups_to_restore = ["dole_no_pending_case", "dole_authority"]
        else:  # International
            groups_to_restore = ["dmw_no_pending_case", "license_to_recruit"]

        for group_name in groups_to_restore:
            group = BACKUP_COLS[group_name]
            for key in ["path", "expiry", "warning", "uploaded_at"]:
                col = group[key]
                restore_assignments.append(f"{col} = {backup_col(col)}")

        # 3) Clear backups and old_recruitment_type after restoring
        clear_backups = []
        for group in BACKUP_COLS.values():
            for key in ["path", "expiry", "warning", "uploaded_at"]:
                clear_backups.append(f"{backup_col(group[key])} = NULL")
        clear_backups.append("old_recruitment_type = NULL")

        update_query = f"""
            UPDATE employers SET
                recruitment_type = %s,
                status = 'Approved',
                is_active = 1,
                recruitment_type_change_pending = 0,
                {', '.join(clear_new_type_assignments)},
                {', '.join(restore_assignments)},
                {', '.join(clear_backups)}
            WHERE employer_id = %s
        """

        cursor.execute(update_query, (old_type, employer_id))
        db.commit()

        return {
            "success": True,
            "message": f"Recruitment type change rejected. Reverted to {old_type}."
        }

    except Exception as e:
        db.rollback()
        logger.exception(e)
        return {
            "success": False,
            "message": "Error reverting recruitment type change",
            "error": str(e)
        }
