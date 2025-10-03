from db_connection import create_connection, run_query
from datetime import datetime
import json


import json
import traceback
from db_connection import create_connection, run_query


def create_notification(notification_type, title, message, count=1, related_ids=None, recruitment_type=None, residency_type=None):
    """
    Safer create_notification that commits the insert and returns (True, inserted_id) or (False, error_message)
    """
    conn = create_connection()
    if not conn:
        return False, "DB connection failed"

    related_ids_json = json.dumps(related_ids) if related_ids else None

    query = """
        INSERT INTO notifications 
        (notification_type, title, message, count, related_ids, recruitment_type, residency_type)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
    """
    params = (notification_type, title, message, count,
              related_ids_json, recruitment_type, residency_type)

    try:
        # Try using run_query if it returns truthy on success
        result = run_query(conn, query, params)
        # If run_query handled commit and returns truthy, attempt to read last id
        if result:
            try:
                last = run_query(
                    conn, "SELECT LAST_INSERT_ID() as id", fetch="one")
                inserted_id = last["id"] if last else None
            except Exception:
                inserted_id = None
            conn.close()
            return True, inserted_id
    except Exception as e:
        # log and fallthrough to raw cursor method
        print("[v0][notifications] run_query failed (will fallback):", str(e))
        traceback.print_exc()

    # Fallback: raw cursor + explicit commit
    try:
        cur = conn.cursor()
        cur.execute(query, params)
        conn.commit()                       # <--- EXPLICIT COMMIT
        inserted_id = getattr(cur, "lastrowid", None)
        cur.close()
        conn.close()
        print(f"[v0][notifications] Inserted notification id={inserted_id}")
        return True, inserted_id
    except Exception as exc:
        err = str(exc)
        print("[v0][notifications] Exception during insert:", err)
        traceback.print_exc()
        try:
            conn.rollback()
        except Exception:
            pass
        conn.close()
        return False, err


def get_notifications(notification_type=None, is_read=None, limit=50):
    """
    Fetch notifications with optional filtering and normalize the returned dict keys
    so frontend can reliably use: notification_id, title, message, is_read, created_at, redirect_url, related_ids
    """
    conn = create_connection()
    if not conn:
        return []

    # Build query with filters
    query = "SELECT * FROM notifications WHERE 1=1"
    params = []

    if notification_type:
        query += " AND notification_type = %s"
        params.append(notification_type)

    if is_read is not None:
        query += " AND is_read = %s"
        params.append(is_read)

    query += " ORDER BY created_at DESC LIMIT %s"
    params.append(limit)

    rows = run_query(conn, query, tuple(params), fetch="all")
    conn.close()

    if not rows:
        return []

    normalized = []
    for r in rows:
        # normalize id field: support both `notification_id` or `id`
        nid = r.get("notification_id") or r.get("id") or r.get("notif_id")

        # normalize is_read to integer 0/1
        is_read_val = r.get("is_read")
        try:
            # cover booleans, integers and strings
            is_read_norm = 1 if (
                is_read_val is True or int(is_read_val) == 1) else 0
        except Exception:
            # fallback: treat falsy as unread
            is_read_norm = 0 if not is_read_val else 1

        # normalize created_at to ISO string
        created_at_val = r.get("created_at")
        if created_at_val is None:
            created_at_iso = None
        else:
            try:
                created_at_iso = created_at_val.isoformat()
            except Exception:
                created_at_iso = str(created_at_val)

        # parse related_ids JSON safely
        related = []
        if r.get("related_ids"):
            try:
                related = json.loads(r.get("related_ids"))
            except Exception:
                related = []

        normalized.append({
            "notification_id": nid,
            "notification_type": r.get("notification_type"),
            "title": r.get("title"),
            "message": r.get("message"),
            "count": r.get("count") or 1,
            "related_ids": related,
            "recruitment_type": r.get("recruitment_type"),
            "residency_type": r.get("residency_type"),
            "is_read": is_read_norm,          # 0 = unread, 1 = read
            "created_at": created_at_iso,
            "updated_at": (r.get("updated_at").isoformat()
                           if r.get("updated_at") and hasattr(r.get("updated_at"), "isoformat")
                           else (str(r.get("updated_at")) if r.get("updated_at") else None)),
            "redirect_url": r.get("redirect_url") or "#"
        })

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


def get_unread_count():
    """Get count of unread notifications"""
    conn = create_connection()
    if not conn:
        return 0

    query = "SELECT COUNT(*) as count FROM notifications WHERE is_read = 0"
    result = run_query(conn, query, fetch="one")
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
