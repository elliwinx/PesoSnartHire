from datetime import datetime
from db_connection import create_connection, run_query
from .notifications import create_notification
import os
import logging

logger = logging.getLogger(__name__)


def handle_recruitment_type_change(employer_id, db, old_type, new_type):
    """
    Complete recruitment type change workflow with admin notification
    """
    try:
        cursor = db.cursor(dictionary=True)

        # --- Fetch employer ---
        cursor.execute("""
            SELECT employer_id, employer_name, email, recruitment_type,
                   dole_no_pending_case_path, dole_authority_to_recruit_path,
                   dmw_no_pending_case_path, license_to_recruit_path,
                   old_recruitment_type
            FROM employers 
            WHERE employer_id = %s
        """, (employer_id,))
        employer = cursor.fetchone()
        if not employer:
            return {"success": False, "message": "Employer not found"}

        # Pre-check required documents before changing recruitment type
        missing_docs = []
        if new_type == "Local":
            if not employer["dole_no_pending_case_path"]:
                missing_docs.append("DOLE No Pending Case")
            if not employer["dole_authority_to_recruit_path"]:
                missing_docs.append("DOLE Authority to Recruit")
        elif new_type == "International":
            if not employer["dmw_no_pending_case_path"]:
                missing_docs.append("DMW No Pending Case")
            if not employer["license_to_recruit_path"]:
                missing_docs.append("License to Recruit")

        if missing_docs:
            return {
                "success": False,
                "message": f"Cannot change recruitment type to {new_type}. Missing required documents: {', '.join(missing_docs)}."
            }

        # Delete old docs depending on old_type
        files_to_delete, paths_to_clear = [], []
        if old_type == "Local":
            for col in ["dole_no_pending_case_path", "dole_authority_to_recruit_path"]:
                if employer[col]:
                    files_to_delete.append(employer[col])
                    paths_to_clear.append(col)
        elif old_type == "International":
            for col in ["dmw_no_pending_case_path", "license_to_recruit_path"]:
                if employer[col]:
                    files_to_delete.append(employer[col])
                    paths_to_clear.append(col)

        for file_path in files_to_delete:
            try:
                abs_path = os.path.join("static", file_path)
                if os.path.exists(abs_path):
                    os.remove(abs_path)
                    logger.info(
                        f"[v0] Deleted file for employer {employer_id}: {file_path}")
            except Exception as e:
                logger.warning(f"[v0] Failed to delete file {file_path}: {e}")

        # Build update for employers table
        set_clause_str = ", ".join(
            [f"{p}=NULL" for p in paths_to_clear]) if paths_to_clear else ""
        if set_clause_str:
            set_clause_str += ", "

        update_query = f"""
            UPDATE employers
            SET {set_clause_str}
                old_recruitment_type = %s,
                recruitment_type = %s,
                status = 'Pending',
                is_active = 0,
                recruitment_type_change_pending = 1,
                updated_at = %s
            WHERE employer_id = %s
        """
        cursor.execute(update_query, (old_type, new_type,
                       datetime.now(), employer_id))
        db.commit()

        logger.info(
            f"[v0] Updated employer {employer_id}: {old_type} → {new_type}")

        # Update or create notification (reuse employer_approval)
        notif_update = """
            UPDATE notifications
            SET title = %s,
                message = %s,
                count = count + 1,
                is_read = 0,
                updated_at = NOW()
            WHERE employer_id = %s
              AND notification_type = 'employer_approval'
        """
        notif_title = f"Recruitment Type Change - {employer['employer_name']}"
        notif_message = (
            f"Employer {employer['employer_name']} changed recruitment type from "
            f"{old_type} to {new_type}. Status reset to Pending. Please re-review their documents."
        )

        cursor.execute(notif_update, (notif_title, notif_message, employer_id))
        db.commit()

        if cursor.rowcount == 0:
            # Only create if no existing employer_approval notification
            success, notif_id = create_notification(
                notification_type="employer_approval",
                title=notif_title,
                message=notif_message,
                related_ids=[employer_id],
                employer_id=employer_id,
                recruitment_type=new_type
            )
            if success:
                logger.info(
                    f"[v0] Created new notification for employer {employer_id}: {notif_id}")
            else:
                logger.warning(
                    f"[v0] Failed to create notification for employer {employer_id}")
        else:
            logger.info(
                f"[v0] Updated existing notification and marked unread for employer {employer_id}")

        return {
            "success": True,
            "message": f"Recruitment type changed to {new_type}. Please re-upload required documents.",
            "old_type": old_type,
            "new_type": new_type
        }

    except Exception as e:
        db.rollback()
        logger.error(
            f"[v0] Error handling recruitment type change: {e}", exc_info=True)
        return {"success": False, "message": "Error processing recruitment type change", "error": str(e)}


def revert_recruitment_type(employer_id, db, previous_type):
    """
    Revert recruitment type back to previous type when admin rejects the change
    """
    try:
        cursor = db.cursor(dictionary=True)

        # Update back to previous recruitment type
        cursor.execute("""
            UPDATE employers 
            SET recruitment_type = %s,
                recruitment_type_change_pending = 0,
                old_recruitment_type = NULL,
                updated_at = %s
            WHERE employer_id = %s
        """, (previous_type, datetime.now(), employer_id))

        db.commit()
        logger.info(
            f"[v0] Reverted employer {employer_id} back to {previous_type}")

        return {
            "success": True,
            "message": f"Recruitment type reverted to {previous_type}"
        }

    except Exception as e:
        logger.error(f"[v0] Error reverting recruitment type: {e}")
        try:
            db.rollback()
        except:
            pass
        return {
            "success": False,
            "message": f"Error reverting recruitment type: {str(e)}"
        }
