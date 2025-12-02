from db_connection import create_connection, run_query
from datetime import datetime
import json


import json
import traceback
from db_connection import create_connection, run_query


def create_notification(
    notification_type,
    title,
    message,
    count=1,
    related_ids=None,
    recruitment_type=None,
    residency_type=None,
    applicant_id=None,
    employer_id=None
):
    """
    Insert or update a notification.
    If a notification exists for the same type and user (applicant/employer),
    update it (increment count, update message, update timestamp).
    Otherwise, insert a new one.
    Returns (True, inserted_id) or (False, error_message).
    """
    conn = create_connection()
    if not conn:
        return False, "DB connection failed"

    # Normalize related_ids into a Python list
    parsed_related = None
    if related_ids is None:
        parsed_related = None
    else:
        if isinstance(related_ids, str):
            try:
                parsed_related = json.loads(related_ids)
            except Exception:
                parsed_related = [related_ids]
        elif isinstance(related_ids, (list, tuple)):
            parsed_related = list(related_ids)
        else:
            parsed_related = [related_ids]

    # Auto-fill applicant_id or employer_id if only one related_id was provided
    try:
        if (applicant_id is None and employer_id is None
                and parsed_related and len(parsed_related) == 1):
            single = parsed_related[0]
            try:
                single_int = int(single)
            except Exception:
                single_int = None

            if single_int is not None:
                if notification_type in (
                    "applicant_reported",
                    "applicant_outdated_docu"
                ):
                    applicant_id = single_int
                elif notification_type in (
                    "employer_approval",
                    "employer_reported",
                    "employer_outdated_docu"
                ):
                    employer_id = single_int
    except Exception:
        pass

    check_query = "SELECT notification_id FROM notifications WHERE notification_type = %s"
    check_params = [notification_type]

    if employer_id:
        check_query += " AND employer_id = %s"
        check_params.append(employer_id)
    elif applicant_id:
        check_query += " AND applicant_id = %s"
        check_params.append(applicant_id)

    if recruitment_type:
        check_query += " AND recruitment_type = %s"
        check_params.append(recruitment_type)

    # Only match unread notifications to reuse
    check_query += " AND is_read = 0 LIMIT 1"

    try:
        existing = run_query(
            conn, check_query, tuple(check_params), fetch="one")

        if existing:
            update_query = """
                UPDATE notifications 
                SET count = count + 1, 
                    message = %s, 
                    title = %s,
                    updated_at = NOW()
                WHERE notification_id = %s
            """
            run_query(conn, update_query,
                      (message, title, existing["notification_id"]))
            conn.commit()
            conn.close()
            print(
                f"[notifications] Updated existing notification id={existing['notification_id']}, incremented count")
            return True, existing["notification_id"]
    except Exception as e:
        print(f"[notifications] Error checking for existing notification: {e}")
        # Fall through to create new one

    related_ids_json = json.dumps(parsed_related) if parsed_related else None

    query = """
        INSERT INTO notifications 
        (notification_type, title, message, count, related_ids, 
         recruitment_type, residency_type, applicant_id, employer_id)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
    """
    params = (
        notification_type,
        title,
        message,
        count,
        related_ids_json,
        recruitment_type,
        residency_type,
        applicant_id,
        employer_id,
    )

    try:
        result = run_query(conn, query, params)
        if result:
            try:
                last = run_query(
                    conn, "SELECT LAST_INSERT_ID() as id", fetch="one")
                inserted_id = last["id"] if last else None
            except Exception:
                inserted_id = None
            conn.commit()
            conn.close()
            print(
                f"[notifications] Inserted new notification id={inserted_id}")
            return True, inserted_id
    except Exception as e:
        print("[notifications] run_query failed:", str(e))
        traceback.print_exc()

    # fallback: raw cursor
    try:
        cur = conn.cursor()
        cur.execute(query, params)
        conn.commit()
        inserted_id = getattr(cur, "lastrowid", None)
        cur.close()
        conn.close()
        print(f"[notifications] Inserted notification id={inserted_id}")
        return True, inserted_id
    except Exception as exc:
        err = str(exc)
        print("[notifications] Exception during insert:", err)
        traceback.print_exc()
        try:
            conn.rollback()
        except Exception:
            pass
        conn.close()
        return False, err


# handling recruitment change
def build_redirect_url(notif, admin_prefix="/admin"):
    """
    Generate a redirect URL for the admin UI.
    Uses applicant_id/employer_id if present, otherwise falls back to related_ids[0].
    """
    ntype = notif.get("notification_type")
    applicant_id = notif.get("applicant_id")
    employer_id = notif.get("employer_id")
    related = notif.get("related_ids") or []

    # Ensure related is a list
    if isinstance(related, str):
        try:
            related = json.loads(related)
        except Exception:
            related = [related]

    # fallback: use first related id if explicit FK missing
    if not applicant_id and related:
        try:
            applicant_id = int(related[0])
        except Exception:
            pass
    if not employer_id and related:
        try:
            employer_id = int(related[0])
        except Exception:
            pass

    # Map to admin routes
    if ntype == "applicant_approval":
        if applicant_id:
            return f"{admin_prefix}/applicants/{applicant_id}"
        return f"{admin_prefix}/applicants"

    if ntype == "employer_approval" and employer_id:
        return f"{admin_prefix}/employers/{employer_id}"

    if ntype == "applicant_reported":
        return f"{admin_prefix}/reported_applicants"

    if ntype == "employer_reported":
        return f"{admin_prefix}/applicants_for_reported_acc"

    if ntype == "applicant_outdated_docu" and applicant_id:
        return f"{admin_prefix}/applicants/{applicant_id}"

    if ntype == "employer_outdated_docu" and employer_id:
        return f"{admin_prefix}/employers/{employer_id}"

    if ntype == "applicant_batch":
        return f"{admin_prefix}/applicants/batch"

    return "#"


def get_notifications(notification_type=None, is_read=None, limit=50, exclude_types=None):
    """
    Fetch notifications with optional filtering and normalize the returned dict keys
    so frontend can reliably use: notification_id, title, message, is_read, created_at, redirect_url, related_ids

    exclude_types: list of notification types to exclude (e.g., ['job_application'])
    """
    conn = create_connection()
    if not conn:
        return []

    query = "SELECT * FROM notifications WHERE 1=1"
    params = []

    if notification_type:
        query += " AND notification_type = %s"
        params.append(notification_type)

    if is_read is not None:
        query += " AND is_read = %s"
        params.append(is_read)

    if exclude_types and len(exclude_types) > 0:
        placeholders = ", ".join(["%s"] * len(exclude_types))
        query += f" AND notification_type NOT IN ({placeholders})"
        params.extend(exclude_types)

    query += " ORDER BY is_read ASC, created_at DESC LIMIT %s"
    params.append(limit)

    rows = run_query(conn, query, tuple(params), fetch="all")
    conn.close()

    if not rows:
        return []

    normalized = []
    for r in rows:
        # normalize id
        nid = r.get("notification_id") or r.get("id") or r.get("notif_id")

        # normalize is_read
        is_read_val = r.get("is_read")
        try:
            is_read_norm = 1 if (
                is_read_val is True or int(is_read_val) == 1) else 0
        except Exception:
            is_read_norm = 0 if not is_read_val else 1

        # normalize created_at
        created_at_val = r.get("created_at")
        if created_at_val is None:
            created_at_iso = None
        else:
            try:
                created_at_iso = created_at_val.isoformat()
            except Exception:
                created_at_iso = str(created_at_val)

        # parse related_ids
        related = []
        if r.get("related_ids"):
            try:
                related = json.loads(r.get("related_ids"))
            except Exception:
                related = []

        notif_obj = {
            "notification_id": nid,
            "notification_type": r.get("notification_type"),
            "title": r.get("title"),
            "message": r.get("message"),
            "count": r.get("count") or 1,
            "related_ids": related,
            "recruitment_type": r.get("recruitment_type"),
            "residency_type": r.get("residency_type"),
            "applicant_id": r.get("applicant_id"),
            "employer_id": r.get("employer_id"),
            "is_read": is_read_norm,
            "created_at": created_at_iso,
            "updated_at": (r.get("updated_at").isoformat()
                           if r.get("updated_at") and hasattr(r.get("updated_at"), "isoformat")
                           else (str(r.get("updated_at")) if r.get("updated_at") else None))
        }

        # Inject redirect_url dynamically
        notif_obj["redirect_url"] = build_redirect_url(notif_obj)

        normalized.append(notif_obj)

    return normalized


def mark_notification_read(notification_id):
    """Mark a notification as read"""
    conn = create_connection()
    if not conn:
        return False

    query = "UPDATE notifications SET is_read = 1 WHERE notification_id = %s"
    result = run_query(conn, query, (notification_id,))
    conn.close()

    return result


def get_unread_count(exclude_types=None):
    """Get count of unread notifications, excluding specific types"""
    conn = create_connection()
    if not conn:
        return 0

    query = "SELECT COUNT(*) as count FROM notifications WHERE is_read = 0"
    params = []

    # Add the exclusion logic here
    if exclude_types and len(exclude_types) > 0:
        placeholders = ", ".join(["%s"] * len(exclude_types))
        query += f" AND notification_type NOT IN ({placeholders})"
        params.extend(exclude_types)

    result = run_query(conn, query, tuple(params), fetch="one")
    conn.close()

    return result['count'] if result else 0


def batch_lipeno_applicants():
    """
    Create a batch notification for Lipeno applicants registered in the last 30 minutes
    This should be called by a scheduled task (cron job or scheduler)
    """
    conn = create_connection()
    if not conn:
        return False

    # Get Lipeno applicants registered in last 30 minutes that haven't been batched
    query = """
        SELECT applicant_id, CONCAT(first_name, ' ', last_name) as name
        FROM applicants 
        WHERE residency = 'Lipeno' 
        AND created_at >= DATE_SUB(NOW(), INTERVAL 30 MINUTE)
        AND status = 'Approved'
    """

    applicants = run_query(conn, query, fetch="all")
    conn.close()

    if applicants and len(applicants) > 0:
        count = len(applicants)
        applicant_ids = [a['applicant_id'] for a in applicants]

        title = "New Lipeno Applicants Batch"
        message = f"{count} new Lipeno applicant{'s' if count > 1 else ''} registered"

        return create_notification(
            notification_type='applicant_batch',
            title=title,
            message=message,
            count=count,
            related_ids=applicant_ids,
            residency_type='Lipeno'
        )

    return True  # No applicants to batch, but not an error
