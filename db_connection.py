import os
import mysql.connector
from mysql.connector import Error
from dotenv import load_dotenv
import logging

# Load environment variables
load_dotenv()


def create_connection():
    """
    Create a database connection using environment variables.
    """
    try:
        connection = mysql.connector.connect(
<<<<<<< HEAD
            host=os.getenv("DB_HOST", "localhost"),
            port=int(os.getenv("DB_PORT", 3306)),
            user=os.getenv("DB_USER", "root"),
            password=os.getenv("DB_PASSWORD", ""),
            database=os.getenv("DB_NAME", "peso_smarthire")
=======
            host="localhost",
            port=3307,
            user="root",
            password="",
            database="peso_smarthire"
>>>>>>> support
        )

        if connection.is_connected():
            return connection

    except Error as e:
        logging.error(f"Database connection failed: {e}")
        return None


def run_query(connection, query, params=None, fetch=None):
    """
    Execute a SQL query.

    Args:
        connection: The MySQL connection object
        query: SQL query string
        params: Tuple of parameters for the query
        fetch: "one" (single row), "all" (list of rows), or None (commit changes)

    Returns:
        The query result or None if an error occurs.
    """
    if not connection:
        logging.error("Cannot run query: No connection provided.")
        return None

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
        logging.error(
            f"Error executing query: {e}\nQuery: {query}\nParams: {params}")
        return None
    finally:
        # Ensure cursor is closed even if connection stays open
        try:
            cursor.close()
        except Exception:
            pass
