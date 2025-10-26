from mysql.connector import Error
import mysql.connector
# db_connection.py


def create_connection():
    """
    Create and return a database connection.
    Update host, user, password, and database as needed.
    """
    try:
        connection = mysql.connector.connect(
            host="localhost",
            port=3307,
            user="root",
            password="",
            database="peso_smarthire"
        )

        if connection.is_connected():
            return connection

    except Error as e:
        print(f"❌ Error connecting to database: {e}")
        return None


def run_query(connection, query, params=None, fetch=None):
    """
    Execute a SQL query.
    fetch options:
      - None (default): execute & commit (INSERT/UPDATE/DELETE)
      - "one": return a single row (dict) or None
      - "all": return all rows (list of dicts)
    """
    # For SELECT queries, use buffered cursor to avoid unread result errors
    buffered = fetch is not None

    cursor = connection.cursor(dictionary=True, buffered=buffered)
    result = None
    try:
        cursor.execute(query, params or ())

        if fetch == "one":
            result = cursor.fetchone()
        elif fetch == "all":
            result = cursor.fetchall()
        else:
            connection.commit()
            result = cursor.rowcount

        return result

    except Error as e:
        print(f"❌ Error executing query: {e}")
        return None
    finally:
        cursor.close()
