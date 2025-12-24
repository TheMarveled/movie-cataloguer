from flask import Flask, request, jsonify, render_template, redirect, send_file
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
# maximum allowed page size to prevent abuse
MAX_PAGE_SIZE = getattr(config, 'MAX_PAGE_SIZE', 200)
DEFAULT_STATUS = config.DEFAULT_STATUS
DEFAULT_FORMAT = config.DEFAULT_FORMAT
CSV_EXPORT_FILENAME = config.CSV_EXPORT_FILENAME
TMDB_POSTER_SIZE = config.TMDB_POSTER_SIZE
DEBUG = config.DEBUG
AUTO_ADD_COLLECTIONS = config.AUTO_ADD_COLLECTIONS

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
        c.execute(f"""
            CREATE TABLE IF NOT EXISTS movies (
                rowid INTEGER PRIMARY KEY,
                barcode TEXT,
                title TEXT NOT NULL,
                year TEXT,
                format TEXT,
                poster_path TEXT,
                tmdb_id INTEGER,
                status TEXT DEFAULT '{DEFAULT_STATUS}',
                version TEXT,
                country TEXT,
                language TEXT,
                region TEXT,
                disc_count INTEGER,
                notes TEXT
            )
        """)
        c.execute("CREATE INDEX IF NOT EXISTS idx_title ON movies(title COLLATE NOCASE)")
        c.execute("CREATE INDEX IF NOT EXISTS idx_year ON movies(year)")
        c.execute("CREATE INDEX IF NOT EXISTS idx_status ON movies(status)")
        conn.commit()
        # ensure tmdb_id column exists for older DBs
        cols = [r[1] for r in conn.execute("PRAGMA table_info(movies)").fetchall()]
        if 'tmdb_id' not in cols:
            c.execute("ALTER TABLE movies ADD COLUMN tmdb_id INTEGER")
            conn.commit()
        # Collections support
        c.execute("""
            CREATE TABLE IF NOT EXISTS collections (
                id INTEGER PRIMARY KEY,
                name TEXT UNIQUE NOT NULL
            )
        """)
        c.execute("""
            CREATE TABLE IF NOT EXISTS movie_collections (
                movie_rowid INTEGER NOT NULL,
                collection_id INTEGER NOT NULL,
                PRIMARY KEY(movie_rowid, collection_id)
            )
        """)
        c.execute("CREATE INDEX IF NOT EXISTS idx_collection_name ON collections(name COLLATE NOCASE)")
        conn.commit()

init_db()

# === TMDb KEY SETTER ===
@app.route("/set_tmdb_key", methods=["POST"])
def set_tmdb_key():
    new_key = request.form.get("tmdb_key", "").strip()
    if not new_key:
        return "No key provided", 400
    config_path = os.path.join(os.path.dirname(__file__), "config.py")
    with open(config_path, "r") as f:
        lines = f.readlines()
    found = False
    for i, line in enumerate(lines):
        if line.startswith("TMDB_API_KEY"):
            lines[i] = f'TMDB_API_KEY = "{new_key}"\n'
            found = True
            break
    if not found:
        lines.append(f'\nTMDB_API_KEY = "{new_key}"\n')
    with open(config_path, "w") as f:
        f.writelines(lines)
    return "TMDb API key updated successfully. Please restart the app.", 200

# === TMDb LOOKUP ===
def lookup_tmdb(title_guess, year_guess=None):
    if not title_guess or TMDB_API_KEY == "YOUR_TMDB_API_KEY_HERE":
        return None, None, None, None
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
            tmdb_id = movie.get("id")
            if poster_path:
                poster_path = f"https://image.tmdb.org/t/p/{TMDB_POSTER_SIZE}{poster_path}"
            return title, year, poster_path, tmdb_id
    except Exception as e:
        print("TMDb lookup error:", e)
    return None, None, None, None

# === TMDb MOVIE DETAILS ===
def get_tmdb_movie_details(tmdb_id):
    if not tmdb_id or TMDB_API_KEY == "YOUR_TMDB_API_KEY_HERE":
        return None
    try:
        url = f"https://api.themoviedb.org/3/movie/{tmdb_id}"
        params = {"api_key": TMDB_API_KEY}
        r = requests.get(url, params=params, timeout=10)
        r.raise_for_status()
        movie = r.json()
        collection = movie.get("belongs_to_collection")
        if collection:
            return {"name": collection.get("name"), "id": collection.get("id")}
    except Exception as e:
        print("TMDb movie details error:", e)
    return None

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
    return render_template(
        "catalogue.html",
        catalogue_title=config.MOVIE_CATALOGUE_TITLE,
        page=1,
        total=0,
        total_pages=1,
        query=""
    )

@app.route("/set_catalogue_title", methods=["POST"])
def set_catalogue_title():
    new_title = request.form.get("catalogue_title", "").strip()
    if not new_title:
        return "No title provided", 400
    config_path = os.path.join(os.path.dirname(__file__), "config.py")
    with open(config_path, "r") as f:
        lines = f.readlines()
    found = False
    for i, line in enumerate(lines):
        if line.startswith("MOVIE_CATALOGUE_TITLE"):
            lines[i] = f'MOVIE_CATALOGUE_TITLE = "{new_title}"\n'
            found = True
            break
    if not found:
        lines.append(f'\nMOVIE_CATALOGUE_TITLE = "{new_title}"\n')
    with open(config_path, "w") as f:
        f.writelines(lines)
    return "Title updated successfully", 200

# --- ADD MOVIE ---
@app.route("/add", methods=["POST"])
def add_movie():
    if request.is_json:
        data = request.get_json()
        barcode = data.get("barcode") or None
        title_guess = (data.get("title") or "").strip()
        year_guess = data.get("year") or None
        format_ = data.get("format") or DEFAULT_FORMAT
        status = data.get("status") or DEFAULT_STATUS
        version = data.get("version") or None
        country = data.get("country") or None
        language = data.get("language") or None
        region = data.get("region") or None
        disc_count = data.get("disc_count") or None
        notes = data.get("notes") or None
    else:
        barcode = request.form.get("barcode") or None
        title_guess = (request.form.get("title") or "").strip()
        year_guess = request.form.get("year") or None
        format_ = request.form.get("format") or DEFAULT_FORMAT
        status = request.form.get("status") or DEFAULT_STATUS
        version = request.form.get("version") or None
        country = request.form.get("country") or None
        language = request.form.get("language") or None
        region = request.form.get("region") or None
        disc_count = request.form.get("disc_count") or None
        notes = request.form.get("notes") or None

    if not title_guess:
        return "Title cannot be empty", 400

    title, year, poster_path, tmdb_id = lookup_tmdb(title_guess, year_guess)
    if not title:
        title = title_guess
        year = year_guess
        poster_path = None
        tmdb_id = None

    with closing(get_db()) as conn:
        c = conn.cursor()
        c.execute("""
            INSERT INTO movies (barcode, title, year, format, poster_path, tmdb_id, status,
                                version, country, language, region, disc_count, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (barcode, title, year, format_, poster_path, tmdb_id, status,
              version, country, language, region, disc_count, notes))
        conn.commit()
        rowid = c.lastrowid

    if request.is_json or request.headers.get("X-Requested-With") == "XMLHttpRequest":
        return jsonify({
            "rowid": rowid,
            "title": title,
            "year": year,
            "tmdb_id": tmdb_id,
            "format": format_,
            "status": status,
            "version": version,
            "country": country,
            "language": language,
            "region": region,
            "disc_count": disc_count,
            "notes": notes,
            "poster_path": poster_path
        })

    return redirect("/catalogue")

# --- EDIT MOVIE ---
@app.route("/edit/<int:rowid>", methods=["POST"])
def edit_movie(rowid):
    data = request.get_json() if request.is_json else request.form
    new_title = (data.get("title") or "").strip()
    new_year = data.get("year") or None
    new_format = data.get("format") or DEFAULT_FORMAT
    new_status = data.get("status") or DEFAULT_STATUS
    version = data.get("version") or None
    country = data.get("country") or None
    language = data.get("language") or None
    region = data.get("region") or None
    disc_count = data.get("disc_count") or None
    notes = data.get("notes") or None

    if not new_title:
        return "Title cannot be empty", 400

    title, year, poster_path, tmdb_id = lookup_tmdb(new_title, new_year)
    if not title:
        title = new_title
        year = new_year
        poster_path = None
        tmdb_id = None
    # prefer client-provided tmdb_id if present
    provided_tmdb = data.get('tmdb_id') if isinstance(data, dict) else None
    if provided_tmdb:
        try:
            tmdb_id = int(provided_tmdb)
        except Exception:
            pass

    with closing(get_db()) as conn:
        c = conn.cursor()
        c.execute("""
            UPDATE movies
            SET title = ?, year = ?, format = ?, poster_path = ?, tmdb_id = ?, status = ?,
                version = ?, country = ?, language = ?, region = ?, disc_count = ?, notes = ?
            WHERE rowid = ?
        """, (title, year, new_format, poster_path, tmdb_id, new_status,
              version, country, language, region, disc_count, notes, rowid))
        conn.commit()

    # handle collections (client may send a list of collection names or a comma-separated string)
    try:
        coll_input = data.get('collections') if isinstance(data, dict) else data.get('collections')
        coll_names = []
        if coll_input:
            if isinstance(coll_input, list):
                coll_names = [str(x).strip() for x in coll_input if str(x).strip()]
            else:
                coll_names = [x.strip() for x in str(coll_input).split(',') if x.strip()]
        if coll_names:
            with closing(get_db()) as conn:
                c = conn.cursor()
                # ensure collections exist
                coll_ids = []
                for name in coll_names:
                    c.execute("SELECT id FROM collections WHERE name = ? COLLATE NOCASE", (name,))
                    r = c.fetchone()
                    if r:
                        coll_ids.append(r[0])
                    else:
                        c.execute("INSERT INTO collections (name) VALUES (?)", (name,))
                        coll_ids.append(c.lastrowid)
                # clear existing associations
                c.execute("DELETE FROM movie_collections WHERE movie_rowid = ?", (rowid,))
                # insert new
                for cid in coll_ids:
                    c.execute("INSERT OR IGNORE INTO movie_collections (movie_rowid, collection_id) VALUES (?, ?)", (rowid, cid))
                conn.commit()
        else:
            # if empty list provided, remove associations
            if 'collections' in (data if isinstance(data, dict) else {}):
                with closing(get_db()) as conn:
                    c = conn.cursor()
                    c.execute("DELETE FROM movie_collections WHERE movie_rowid = ?", (rowid,))
                    conn.commit()
    except Exception:
        pass

    return jsonify({
        "rowid": rowid,
        "title": title,
        "year": year,
        "tmdb_id": tmdb_id,
        "format": new_format,
        "status": new_status,
        "version": version,
        "country": country,
        "language": language,
        "region": region,
        "disc_count": disc_count,
        "notes": notes,
        "poster_path": poster_path
    })

# --- DELETE MOVIE ---
@app.route("/delete/<int:rowid>", methods=["POST"])
def delete_movie(rowid):
    with closing(get_db()) as conn:
        c = conn.cursor()
        c.execute("DELETE FROM movies WHERE rowid = ?", (rowid,))
        conn.commit()
    if request.headers.get("X-Requested-With") == "XMLHttpRequest":
        return jsonify({"rowid": rowid, "deleted": True})
    return redirect("/catalogue")


@app.route("/delete_bulk", methods=["POST"])
def delete_bulk():
    # expects JSON: { "rowids": [1,2,3] }
    data = None
    try:
        data = request.get_json(force=True)
    except Exception:
        return jsonify({"error": "Invalid JSON"}), 400
    if not data or 'rowids' not in data:
        return jsonify({"error": "rowids required"}), 400
    rowids = [int(r) for r in data.get('rowids') if str(r).isdigit()]
    if not rowids:
        return jsonify({"deleted": 0})
    placeholders = ','.join(['?'] * len(rowids))
    with closing(get_db()) as conn:
        c = conn.cursor()
        c.execute(f"DELETE FROM movies WHERE rowid IN ({placeholders})", tuple(rowids))
        deleted = c.rowcount
        conn.commit()
    return jsonify({"deleted": deleted})


@app.route("/update_bulk", methods=["POST"])
def update_bulk():
    try:
        data = request.get_json(force=True)
    except Exception:
        return jsonify({"error": "Invalid JSON"}), 400
    if not data or 'rowids' not in data or 'fields' not in data:
        return jsonify({"error": "rowids and fields required"}), 400
    rowids = [int(r) for r in data.get('rowids') if str(r).isdigit()]
    fields = data.get('fields') or {}
    if not rowids or not fields:
        return jsonify({"updated": 0})
    allowed = {'status','format','version','country','language','region','disc_count','notes'}
    set_parts = []
    params = []
    for k, v in fields.items():
        if k not in allowed: continue
        set_parts.append(f"{k} = ?")
        params.append(v)
    if not set_parts:
        return jsonify({"updated": 0})
    placeholders = ','.join(['?'] * len(rowids))
    sql = f"UPDATE movies SET {', '.join(set_parts)} WHERE rowid IN ({placeholders})"
    params.extend(rowids)
    with closing(get_db()) as conn:
        c = conn.cursor()
        c.execute(sql, tuple(params))
        updated = c.rowcount
        conn.commit()
    return jsonify({"updated": updated})


@app.route('/add_bulk_collections', methods=['POST'])
def add_bulk_collections():
    try:
        data = request.get_json(force=True)
    except Exception:
        return jsonify({"error": "Invalid JSON"}), 400
    if not data or 'rowids' not in data or 'collections' not in data:
        return jsonify({"error": "rowids and collections required"}), 400
    rowids = [int(r) for r in data.get('rowids') if str(r).isdigit()]
    coll_in = data.get('collections') or []
    coll_names = []
    if isinstance(coll_in, list):
        coll_names = [str(x).strip() for x in coll_in if str(x).strip()]
    else:
        coll_names = [x.strip() for x in str(coll_in).split(',') if x.strip()]
    if not rowids or not coll_names:
        return jsonify({"added": 0})
    added = 0
    with closing(get_db()) as conn:
        c = conn.cursor()
        coll_ids = []
        for name in coll_names:
            c.execute("SELECT id FROM collections WHERE name = ? COLLATE NOCASE", (name,))
            r = c.fetchone()
            if r:
                coll_ids.append(r[0])
            else:
                c.execute("INSERT INTO collections (name) VALUES (?)", (name,))
                coll_ids.append(c.lastrowid)
        # insert associations
        for rid in rowids:
            for cid in coll_ids:
                c.execute("INSERT OR IGNORE INTO movie_collections (movie_rowid, collection_id) VALUES (?, ?)", (rid, cid))
                # rowcount for sqlite with INSERT OR IGNORE is 1 if inserted, 0 if ignored
                added += c.rowcount
        conn.commit()
    return jsonify({"added": added})

# --- TMDb Suggestions ---
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


@app.route('/api/collections')
def api_collections():
    with closing(get_db()) as conn:
        c = conn.cursor()
        rows = c.execute("SELECT id, name, (SELECT COUNT(*) FROM movie_collections mc WHERE mc.collection_id = collections.id) as count FROM collections ORDER BY name COLLATE NOCASE ASC").fetchall()
        cols = [{'id': r[0], 'name': r[1], 'count': r[2]} for r in rows]
    return jsonify(cols)


@app.route('/api/collection/<int:cid>/movies')
def api_collection_movies(cid):
    with closing(get_db()) as conn:
        c = conn.cursor()
        rows = c.execute("""
            SELECT m.rowid, m.title, m.poster_path
            FROM movies m
            JOIN movie_collections mc ON mc.movie_rowid = m.rowid
            WHERE mc.collection_id = ?
            ORDER BY m.title COLLATE NOCASE ASC
        """, (cid,)).fetchall()
        movies = [dict(r) for r in rows]
    return jsonify(movies)


@app.route('/api/movie_collections/<int:rowid>')
def api_movie_collections(rowid):
    with closing(get_db()) as conn:
        c = conn.cursor()
        rows = c.execute("SELECT c.name FROM collections c JOIN movie_collections mc ON mc.collection_id = c.id WHERE mc.movie_rowid = ? ORDER BY c.name COLLATE NOCASE ASC", (rowid,)).fetchall()
        names = [r[0] for r in rows]
    return jsonify(names)

# --- UPDATE MOVIE POSTER/TITLE/YEAR ---
@app.route("/update_movie/<int:rowid>", methods=["POST"])
def update_movie(rowid):
    data = request.get_json()
    title = (data.get("title") or "").strip()
    year = data.get("year") or None
    poster_path = data.get("poster_path") or None

    if not title:
        return "Title cannot be empty", 400
    if poster_path and not poster_path.startswith("http"):
        poster_path = f"https://image.tmdb.org/t/p/{TMDB_POSTER_SIZE}{poster_path}"

    tmdb_id = data.get("tmdb_id") or None
    if tmdb_id:
        try:
            tmdb_id = int(tmdb_id)
        except Exception:
            tmdb_id = None
    with closing(get_db()) as conn:
        c = conn.cursor()
        c.execute("""
            UPDATE movies
            SET title = ?, year = ?, poster_path = ?, tmdb_id = ?
            WHERE rowid = ?
        """, (title, year, poster_path, tmdb_id, rowid))
        conn.commit()
    return "", 204

# --- SEARCH API ---
@app.route("/api/search")
def api_search():
    page = request.args.get("page", 1, type=int)
    query = request.args.get("q", "").strip()
    sort = request.args.get("sort", "recent")
    starts_with = request.args.get("starts_with", "").strip()
    status = request.args.get("status", "")
    # optional page_size param (client-controlled). Validate and cap to MAX_PAGE_SIZE
    page_size = request.args.get('page_size', type=int)
    if not page_size or page_size < 1:
        page_size = PAGE_SIZE
    else:
        page_size = min(page_size, MAX_PAGE_SIZE)
    # formats: comma-separated list
    formats_raw = request.args.get("formats", "").strip()
    formats = [f.strip() for f in formats_raw.split(",") if f.strip()] if formats_raw else []

    # Build WHERE clauses and params first so we can compute total correctly
    where_clauses = []
    params = []

    # status filter: empty means no status filtering (both)
    if status:
        where_clauses.append("status = ?")
        params.append(status)

    if starts_with:
        where_clauses.append("title LIKE ?")
        params.append(f"{starts_with}%")
    elif query:
        q = f"%{query}%"
        where_clauses.append("(title LIKE ? OR year LIKE ? OR format LIKE ?)")
        params.extend([q, q, q])

    # formats filter (IN clause)
    if formats:
        placeholders = ",".join(["?"] * len(formats))
        where_clauses.append(f"format IN ({placeholders})")
        params.extend(formats)

    where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

    # compute total now that where_sql and params are available
    with closing(get_db()) as conn:
        total = conn.execute(f"SELECT COUNT(*) FROM movies {where_sql}", params).fetchone()[0]

    # page_size handling: treat missing or non-positive values as default; clamp positive values
    if page_size is None or page_size < 1:
        page_size = PAGE_SIZE
    else:
        page_size = min(page_size, MAX_PAGE_SIZE)

    offset = (page - 1) * page_size

    # Sorting options
    if sort == "recent":
        order_by = "rowid DESC"
    elif sort == "alpha":
        order_by = "title COLLATE NOCASE ASC"
    elif sort == "year_desc":
        order_by = "CAST(year AS INTEGER) DESC"
    elif sort == "year_asc":
        order_by = "CAST(year AS INTEGER) ASC"
    elif sort == "format":
        order_by = "format COLLATE NOCASE ASC, title COLLATE NOCASE ASC"
    else:
        order_by = "rowid DESC"

    with closing(get_db()) as conn:
        movies = conn.execute(f"""
            SELECT rowid, barcode, title, year, format, poster_path, tmdb_id, status,
                   version, country, language, region, disc_count, notes
            FROM movies
            {where_sql}
            ORDER BY {order_by}
            LIMIT ? OFFSET ?
        """, (*params, page_size, offset)).fetchall()

    return jsonify({
        "movies": [dict(m) for m in movies],
        "total": total,
        "page": page,
        "pages": (total + page_size - 1) // page_size,
        "page_size": page_size
    })

# --- EXPORT CSV ---
@app.route("/export_csv")
def export_csv():
    with closing(get_db()) as conn:
        c = conn.cursor()
        c.execute("""
            SELECT barcode, title, year, format, poster_path, tmdb_id, status,
                   version, country, language, region, disc_count, notes
            FROM movies
            ORDER BY rowid ASC
        """)
        movies = c.fetchall()

    si = StringIO()
    writer = csv.writer(si)
    writer.writerow(["barcode", "title", "year", "format", "poster_path", "tmdb_id", "status",
                     "version", "country", "language", "region", "disc_count", "notes"])
    for m in movies:
        writer.writerow([m["barcode"], m["title"], m["year"], m["format"], m["poster_path"], m["tmdb_id"], m["status"],
                         m["version"], m["country"], m["language"], m["region"], m["disc_count"], m["notes"]])
    si.seek(0)
    return send_file(BytesIO(si.getvalue().encode("utf-8")),
                     mimetype="text/csv",
                     as_attachment=True,
                     download_name=CSV_EXPORT_FILENAME)

# --- IMPORT CSV ---
@app.route("/import_csv", methods=["POST"])
def import_csv():
    file = request.files.get("csv_file")
    if not file or not file.filename.endswith(".csv"):
        return redirect("/catalogue")

    stream = StringIO(file.stream.read().decode("utf-8"))
    reader = csv.DictReader(stream)

    with closing(get_db()) as conn:
        c = conn.cursor()
        for row in reader:
            title = (row.get("title") or "").strip()
            if not title:
                continue
            c.execute("""
                INSERT INTO movies (barcode, title, year, format, poster_path, tmdb_id, status,
                                    version, country, language, region, disc_count, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                row.get("barcode") or None,
                title,
                row.get("year") or None,
                row.get("format") or DEFAULT_FORMAT,
                row.get("poster_path") or None,
                int(row.get("tmdb_id")) if row.get("tmdb_id") else None,
                row.get("status") or DEFAULT_STATUS,
                row.get("version") or None,
                row.get("country") or None,
                row.get("language") or None,
                row.get("region") or None,
                row.get("disc_count") or None,
                row.get("notes") or None
            ))
        conn.commit()

    return redirect("/catalogue")

# --- CLEAR ALL MOVIES ---
@app.route("/clear_movies", methods=["POST"])
def clear_movies():
    with closing(get_db()) as conn:
        c = conn.cursor()
        c.execute("DELETE FROM movies")
        conn.commit()
    return redirect("/catalogue")

# === RUN APP ===
if __name__ == "__main__":
    app.run(debug=DEBUG)
