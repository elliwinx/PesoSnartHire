# C:\xampp\htdocs\PesoSnartHire\app.py
from flask import Flask, jsonify
from db_connection import create_connection, run_query

app = Flask(__name__)


@app.route("/")
def home():
    return "Hello, PESO SmartHire!"


@app.route("/dbtest")
def dbtest():
    conn = create_connection()
    if not conn:
        return "❌ DB connection failed", 500
    try:
        res = run_query(conn, "SELECT DATABASE() AS db;", fetch=True)
        return jsonify({"connected_database": res[0]["db"]})
    finally:
        conn.close()


if __name__ == "__main__":
    app.run(debug=True)
