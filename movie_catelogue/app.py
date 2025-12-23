from flask import Flask, request, jsonify, render_template, redirect, flash, send_file
import sqlite3
import requests
from contextlib import closing
import csv
from io import StringIO, BytesIO
import os

# Import configuration
import config

# === FLASK APP SETUP ===
app = Flask(__name__)
app.secret_key = config.SECRET_KEY

# === CONFIG VARIABLES ===
TMDB_API_KEY = config.TMDB_API_KEY
DB_PATH = config.DB_PATH
PAGE_SIZE = config.PAGE_SIZE
DEFAULT_STATUS = config.DEFAULT_STATUS
DEFAULT_FORMAT = config.DEFAULT_FORMAT
CSV_EXPORT_FILENAME = config.CSV_EXPORT_FILENAME
TMDB_POSTER_SIZE = config.TMDB_POSTER_SIZE
DEBUG = config.DEBUG

if TMDB_API_KEY == "YOUR_TMDB_API_KEY_HERE":
    print("Warning: TMDb API key is not set. Identification of movies will not work.")

# === DATABASE HELPER ===
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with closing(get_db()) as conn:
        c = conn.cursor()
        # SQLite table with default status
        c.execute(f"""
            CREATE TABLE IF NOT EXISTS movies (
                rowid INTEGER PRIMARY KEY,
                barcode TEXT,
                title TEXT,
                year TEXT,
                format TEXT,
                poster_path TEXT,
                status TEXT DEFAULT '{DEFAULT_STATUS}'
            )
        """)
        c.execute("CREATE INDEX IF NOT EXISTS idx_title ON movies(title COLLATE NOCASE)")
        c.execute("CREATE INDEX IF NOT EXISTS idx_year ON movies(year)")
        c.execute("CREATE INDEX IF NOT EXISTS idx_status ON movies(status)")
        conn.commit()

init_db()

@app.route("/set_tmdb_key", methods=["POST"])
def set_tmdb_key():
    new_key = request.form.get("tmdb_key", "").strip()
    if not new_key:
        return "No key provided", 400

    config_path = os.path.join(os.path.dirname(__file__), "config.py")

    # Read current config.py
    with open(config_path, "r") as f:
        lines = f.readlines()

    # Update or add TMDB_API_KEY
    found = False
    for i, line in enumerate(lines):
        if line.startswith("TMDB_API_KEY"):
            lines[i] = f'TMDB_API_KEY = "{new_key}"\n'
            found = True
            break
    if not found:
        lines.append(f'\nTMDB_API_KEY = "{new_key}"\n')

    # Write back
    with open(config_path, "w") as f:
        f.writelines(lines)

    return "TMDb API key updated successfully. Please restart the app.", 200

# === TMDb LOOKUP ===
def lookup_tmdb(title_guess, year_guess=None):
    if not title_guess or TMDB_API_KEY == "YOUR_TMDB_API_KEY_HERE":
        return None, None, None
    try:
        url = "https://api.themoviedb.org/3/search/movie"
        params = {"api_key": TMDB_API_KEY, "query": title_guess}
        if year_guess:
            params["year"] = year_guess
        r = requests.get(url, params=params, timeout=10)
        r.raise_for_status()
        results = r.json().get("results", [])
        if results:
            movie = results[0]
            title = movie.get("title")
            year = movie.get("release_date", "")[:4]
            poster_path = movie.get("poster_path")
            if poster_path:
                poster_path = f"https://image.tmdb.org/t/p/{TMDB_POSTER_SIZE}{poster_path}"
            return title, year, poster_path
    except Exception as e:
        print("TMDb lookup error:", e)
    return None, None, None

# === CONTEXT PROCESSOR ===
@app.context_processor
def inject_api_key_status():
    return {"tmdb_key_set": bool(TMDB_API_KEY and TMDB_API_KEY != "YOUR_TMDB_API_KEY_HERE")}

# === ROUTES ===
@app.route("/")
def home():
    return redirect("/catalogue")

@app.route("/catalogue")
def catalogue():
    return render_template("catalogue.html", page=1, total=0, total_pages=1, query="")

@app.route("/add", methods=["POST"])
def add_movie():
    barcode = request.form.get("barcode") or None
    title_guess = request.form.get("title")
    year_guess = request.form.get("year") or None
    format_ = request.form.get("format") or DEFAULT_FORMAT
    status = request.form.get("status") or DEFAULT_STATUS

    title, year, poster_path = lookup_tmdb(title_guess, year_guess)
    if not title:
        title = title_guess
        year = year_guess
        poster_path = None

    with closing(get_db()) as conn:
        c = conn.cursor()
        c.execute("""
            INSERT INTO movies (barcode, title, year, format, poster_path, status)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (barcode, title, year, format_, poster_path, status))
        conn.commit()

    flash("Movie added successfully")
    return redirect("/catalogue")

@app.route("/edit/<int:rowid>", methods=["POST"])
def edit_movie(rowid):
    new_title = request.form.get("title")
    new_year = request.form.get("year")
    new_format = request.form.get("format")
    new_status = request.form.get("status") or DEFAULT_STATUS

    title, year, poster_path = lookup_tmdb(new_title, new_year)
    if not title:
        title = new_title
        year = new_year

    with closing(get_db()) as conn:
        c = conn.cursor()
        c.execute("""
            UPDATE movies
            SET title = ?, year = ?, format = ?, poster_path = ?, status = ?
            WHERE rowid = ?
        """, (title, year, new_format, poster_path, new_status, rowid))
        conn.commit()

    return redirect("/catalogue")

@app.route("/delete/<int:rowid>", methods=["POST"])
def delete_movie(rowid):
    with closing(get_db()) as conn:
        c = conn.cursor()
        c.execute("DELETE FROM movies WHERE rowid = ?", (rowid,))
        conn.commit()
    return redirect("/catalogue")

@app.route("/tmdb_suggestions")
def tmdb_suggestions():
    if TMDB_API_KEY == "YOUR_TMDB_API_KEY_HERE":
        return jsonify([])

    title = request.args.get("title")
    year = request.args.get("year")
    if not title:
        return jsonify([])

    params = {"api_key": TMDB_API_KEY, "query": title}
    if year:
        params["year"] = year

    r = requests.get("https://api.themoviedb.org/3/search/movie", params=params)
    results = r.json().get("results", [])
    return jsonify(results[:20])

@app.route("/update_movie/<int:rowid>", methods=["POST"])
def update_movie(rowid):
    data = request.get_json()
    title = data.get("title")
    year = data.get("year")
    poster_path = data.get("poster_path")

    if poster_path and not poster_path.startswith("http"):
        poster_path = f"https://image.tmdb.org/t/p/{TMDB_POSTER_SIZE}{poster_path}"

    with closing(get_db()) as conn:
        c = conn.cursor()
        c.execute("""
            UPDATE movies
            SET title = ?, year = ?, poster_path = ?
            WHERE rowid = ?
        """, (title, year, poster_path, rowid))
        conn.commit()

    return "", 204

@app.route("/api/search")
def api_search():
    page = request.args.get("page", 1, type=int)
    query = request.args.get("q", "").strip()
    sort = request.args.get("sort", "recent")
    starts_with = request.args.get("starts_with", "").strip()
    status = request.args.get("status", DEFAULT_STATUS)
    offset = (page - 1) * PAGE_SIZE

    where_clauses = ["status=?"]
    params = [status]

    if starts_with:
        where_clauses.append("title LIKE ?")
        params.append(f"{starts_with}%")
    elif query:
        q = f"%{query}%"
        where_clauses.append("(title LIKE ? OR year LIKE ? OR format LIKE ?)")
        params.extend([q, q, q])

    where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""
    order_by = "rowid DESC" if sort == "recent" else "title COLLATE NOCASE ASC"

    with closing(get_db()) as conn:
        movies = conn.execute(f"""
            SELECT rowid, barcode, title, year, format, poster_path, status
            FROM movies
            {where_sql}
            ORDER BY {order_by}
            LIMIT ? OFFSET ?
        """, (*params, PAGE_SIZE, offset)).fetchall()
        total = conn.execute(f"SELECT COUNT(*) FROM movies {where_sql}", params).fetchone()[0]

    return jsonify({
        "movies": [dict(m) for m in movies],
        "total": total,
        "page": page,
        "pages": (total + PAGE_SIZE - 1) // PAGE_SIZE
    })

# --- EXPORT CSV ---
@app.route("/export_csv")
def export_csv():
    with closing(get_db()) as conn:
        c = conn.cursor()
        c.execute("SELECT barcode, title, year, format, poster_path, status FROM movies ORDER BY rowid ASC")
        movies = c.fetchall()

    si = StringIO()
    writer = csv.writer(si)
    writer.writerow(["barcode", "title", "year", "format", "poster_path", "status"])
    for m in movies:
        writer.writerow([m["barcode"], m["title"], m["year"], m["format"], m["poster_path"], m["status"]])
    si.seek(0)

    return send_file(
        BytesIO(si.getvalue().encode("utf-8")),
        mimetype="text/csv",
        as_attachment=True,
        download_name=CSV_EXPORT_FILENAME
    )

# --- IMPORT CSV ---
@app.route("/import_csv", methods=["POST"])
def import_csv():
    file = request.files.get("csv_file")
    if not file or not file.filename.endswith(".csv"):
        flash("Please upload a valid CSV file")
        return redirect("/catalogue")

    stream = StringIO(file.stream.read().decode("utf-8"))
    reader = csv.DictReader(stream)

    with closing(get_db()) as conn:
        c = conn.cursor()
        for row in reader:
            c.execute("""
                INSERT INTO movies (barcode, title, year, format, poster_path, status)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                row.get("barcode") or None,
                row.get("title") or "",
                row.get("year") or None,
                row.get("format") or DEFAULT_FORMAT,
                row.get("poster_path") or None,
                row.get("status") or DEFAULT_STATUS
            ))
        conn.commit()

    flash("CSV imported successfully")
    return redirect("/catalogue")

# --- CLEAR ALL MOVIES ---
@app.route("/clear_movies", methods=["POST"])
def clear_movies():
    with closing(get_db()) as conn:
        c = conn.cursor()
        c.execute("DELETE FROM movies")
        conn.commit()
    flash("All movies have been cleared.")
    return redirect("/catalogue")


# === RUN ===
if __name__ == "__main__":
    app.run(debug=DEBUG)
