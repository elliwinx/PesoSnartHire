# db_connection.py
import mysql.connector
from mysql.connector import Error


def create_connection():
    """
    Create and return a database connection.
    Update the host, user, password, and database values as needed.
    """
    try:
        connection = mysql.connector.connect(
            host="localhost",
            port=3306,
            user="root",
            password="",
            database="peso_smarthire"
        )

        if connection.is_connected():
            return connection

    except Error as e:
        print(f"❌ Error connecting to database: {e}")
        return None


def run_query(connection, query, params=None, fetch=False):
    """
    Execute a SQL query.
    - fetch=True returns results (for SELECT).
    - fetch=False commits changes (for INSERT/UPDATE/DELETE).
    """
    cursor = connection.cursor(dictionary=True)
    try:
        cursor.execute(query, params or ())
        if fetch:
            return cursor.fetchall()
        else:
            connection.commit()
            return cursor.rowcount
    except Error as e:
        print(f"❌ Error executing query: {e}")
        return None
    finally:
        cursor.close()
