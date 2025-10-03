from db_connection import create_connection, run_query
from datetime import datetime
import json


def create_notification(notification_type, title, message, count=1, related_ids=None, recruitment_type=None, residency_type=None):
    """
    Create a new notification for the admin dashboard

    Args:
        notification_type: Type of notification (applicant_approval, employer_approval, etc.)
        title: Notification title
        message: Notification message
        count: Number of items (for batch notifications)
        related_ids: List of related entity IDs (for batch notifications)
        recruitment_type: For employer notifications (Local/International)
        residency_type: For applicant notifications (Lipeno/Non-Lipeno)

    Returns:
        bool: True if successful, False otherwise
    """
    conn = create_connection()
    if not conn:
        return False

    # Convert related_ids list to JSON string
    related_ids_json = json.dumps(related_ids) if related_ids else None

    query = """
        INSERT INTO notifications 
        (notification_type, title, message, count, related_ids, recruitment_type, residency_type)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
    """

    result = run_query(
        conn,
        query,
        (notification_type, title, message, count,
         related_ids_json, recruitment_type, residency_type)
    )

    conn.close()
    return result


def get_notifications(notification_type=None, is_read=None, limit=50):
    """
    Fetch notifications with optional filtering

    Args:
        notification_type: Filter by notification type (optional)
        is_read: Filter by read status (optional)
        limit: Maximum number of notifications to return

    Returns:
        list: List of notification dictionaries
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

    notifications = run_query(conn, query, tuple(params), fetch="all")
    conn.close()

    # Parse related_ids JSON
    if notifications:
        for notif in notifications:
            if notif.get('related_ids'):
                try:
                    notif['related_ids'] = json.loads(notif['related_ids'])
                except:
                    notif['related_ids'] = []

    return notifications or []


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
