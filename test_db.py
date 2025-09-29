from db_connection import create_connection

conn = create_connection()

if conn:
    print("✅ Database connection successful")
    conn.close()
else:
    print("❌ Database connection failed")

# The connection was successful!
