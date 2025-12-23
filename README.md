<p align="center">
  <img src="logo.PNG" alt="Movie Cataloguer Logo" width="200">
</p>

# Movie Cataloguer

A web-based movie catalogue built with **Flask** and **SQLite** that lets you manage your movie collection. It supports adding, editing, deleting, and organizing movies, integrates with **TMDb API** for movie identification, and allows importing/exporting via CSV.

![Python](https://img.shields.io/badge/python-3.11-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---


## Support / Donate

If you enjoy this project and want to support me, you can donate via:

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20me%20a%20coffee-FFDD00?style=flat&logo=buymeacoffee&logoColor=000)](https://www.buymeacoffee.com/msjxzqtrwfj)

[![PayPal](https://img.shields.io/badge/Donate-PayPal-00457C?style=flat&logo=paypal&logoColor=FFFFFF)](https://www.paypal.com/donate/?hosted_button_id=WVYHSXPALLQ88)

[![Join Discord](https://img.shields.io/badge/Discord-Join%20Server-5865F2?logo=discord&logoColor=white)](https://discord.gg/gge6W3nknx)

---

## Features

* **Add movies** with title, year, barcode, format (Blu-ray/DVD/4K), and status (Owned/Wanted).
* **TMDb integration** for automatic movie title, release year, and poster lookup. (requires API key)
* **Edit and delete movies** directly in the interface.
* **Search and filter** your collection by title, year, format, status, or alphabetically.
* **Pagination** for browsing large collections.
* **Export your collection to CSV** or **import from CSV**.
* **Clear all movies** from the catalogue.
* **Dynamic TMDb API key input** in the web interface if no key is set—enter your key without editing code manually.

---

<img src="/imgs/main_img.PNG" alt='img src' width="500">
This is the cataloguer. Compact and easy to understand.
<img src="/imgs/top-card.PNG" alt='img src' width="400">
This is the top card. You can search movies, add movies, and sort/filter.

## Installation

1. **Clone the repository**

```bash
git clone https://github.com/themarveled/movie-cataloguer.git
cd movie-cataloguer
```

2. **Create a virtual environment and install dependencies**

```bash
python -m venv venv
# Activate environment
source venv/bin/activate   # Linux/macOS
venv\Scripts\activate      # Windows
pip install -r requirements.txt
```

3. **Set up TMDb API key (optional if you want identification)**

* You can either:

  * Open `config.py` and replace the placeholder:

```python
TMDB_API_KEY = "YOUR_TMDB_API_KEY_HERE"
```

* Or, if no key is set, enter it directly in the web interface after running the app (dynamic input box appears).

4. **Run the app**

```bash
python app.py
```

5. **Open in browser**

Visit [http://127.0.0.1:5000](http://127.0.0.1:5000)

---

## Usage

* **Add Movie**: Fill in the title, optional year and barcode, select format and status, then click *Add Movie*.
* **Edit Movie**: Change the details in the movie card and click the save button.
* **Identify Movie**: Use the TMDb identify button to fetch poster, correct title, or release year.
* **Delete Movie**: Click the trash icon on a movie card.
* **Search & Filter**: Use the search bar, sort buttons, filter buttons, or alphabet bar.
* **Export CSV**: Download your collection as `movies_export.csv`.
* **Import CSV**: Select a CSV file to upload your collection.
* **Clear All Movies**: Removes all movies from the database permanently.
* **Set TMDb API Key**: If not set, a red warning box appears at the top; enter your API key directly to enable movie identification.

---

# Skins

<img src="/imgs/dark.PNG" alt='img src' width="400">
=============== Dark Theme ===============
<img src="/imgs/light.PNG" alt='img src' width="400">
=============== Light Theme ===============
<img src="/imgs/classic.PNG" alt='img src' width="400">
=============== Classic Theme ===============

--

## Project Structure

```
.
├── app.py             # Main Flask application
├── config.py          # Config file with all options (API keys, DB path, defaults)
├── templates/
│   └── catalogue.html # Main HTML template
├── static/
│   └── styles.css     # (Optional) Separate CSS file
├── movies.db          # SQLite database (auto-created)
├── requirements.txt   # Python dependencies
└── README.md
```

---

## Dependencies

* [Flask](https://flask.palletsprojects.com/)
* [Requests](https://docs.python-requests.org/)
* SQLite (built-in with Python)

---

## Configuration (`config.py`)

* **TMDb API Key**: Required for identifying movies and fetching posters. Can be set in the file or via the web UI.
* **Database Path**: `DB_PATH = "movies.db"` (default location of SQLite database).
* **Page Size**: Number of movies per page (`PAGE_SIZE = 78` default).
* **Flask Secret Key**: `SECRET_KEY` for session security.
* **Default Movie Status**: `DEFAULT_STATUS = "owned"`
* **Default Movie Format**: `DEFAULT_FORMAT = "Blu-ray"`
* **CSV Export Filename**: `CSV_EXPORT_FILENAME = "movies_export.csv"`
* **TMDb Poster Size**: `TMDB_POSTER_SIZE = "w200"`
* **Debug Mode**: `DEBUG = True`

You can customize all these settings in `config.py` to personalize your app.
<img src="/imgs/config.PNG" alt='img src' width="400">

---

## Contributing

Contributions are welcome! Feel free to:

* Submit bug reports or feature requests.
* Open a pull request with improvements.
* Suggest UI enhancements or new features.

---

## License

This project is licensed under the MIT License.

---

## Notes

* If **TMDb API key is not set**, movie identification features will be disabled.
* CSV import requires headers: `barcode,title,year,format,poster_path,status`.
* The dynamic key input allows setting the API key **without editing code manually**, but you must **restart the app** for changes to take effect.
* Inside the movie_catalogue folder is a file **movies_export.csv**. You can use this to demo the catalogue by importing it via the import button in the footer. This is my own personal collection, so enjoy.

---

## Why did I make this?

I’ve been looking for a good way to catalogue my physical movie collection for years, but everything I found was locked behind **subscriptions**, **artificial limits**, or was simply **clunky to use**. Most importantly, none of them were **open source**.

If I want to change how a piece of software works, I want to be able to do that — not wait for an update or pay for a feature.

So I built **Movie Cataloguer** to be:

* **Fully open source**
* **Completely self-hosted**
* **Highly customisable**
* **Free to use, forever**

To get you started quickly, the app includes **TMDb API integration** for automatic movie identification, **fast backend processing** with Flask and SQLite, and a **clean, visual UI** designed specifically for browsing physical media collections.
However I do appreciate a donation to help maintain this project.

---

# Donator's Column

Empty... so far
