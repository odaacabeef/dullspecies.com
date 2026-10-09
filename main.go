// Command dullspecies serves dullspecies.com for local development and
// renders it as a static site for GitHub Pages.
package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"html/template"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"
)

const siteURL = "https://dullspecies.com"

// pages are rendered from templates/<name> to <name> at the site root.
var pages = []string{"index.html", "404.html"}

func main() {
	build := flag.Bool("build", false, "render the static site into -out and exit")
	out := flag.String("out", "dist", "output directory for -build")
	addr := flag.String("addr", "localhost:3000", "listen address for the dev server")
	flag.Parse()

	if *build {
		if err := buildSite(*out); err != nil {
			log.Fatal(err)
		}
		log.Printf("built site in %s/", *out)
		return
	}

	log.Printf("serving http://%s", *addr)
	log.Fatal(http.ListenAndServe(*addr, devServer()))
}

// buildSite renders every page and copies static assets into dir.
func buildSite(dir string) error {
	if err := os.RemoveAll(dir); err != nil {
		return err
	}
	if err := os.CopyFS(filepath.Join(dir, "static"), os.DirFS("static")); err != nil {
		return err
	}
	for _, page := range pages {
		var buf bytes.Buffer
		if err := render(&buf, page, true); err != nil {
			return fmt.Errorf("%s: %w", page, err)
		}
		if err := os.WriteFile(filepath.Join(dir, page), buf.Bytes(), 0o644); err != nil {
			return err
		}
	}
	cname, err := os.ReadFile("CNAME")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(dir, "CNAME"), cname, 0o644)
}

// devServer re-renders templates on every request so edits show up on reload.
func devServer() http.Handler {
	mux := http.NewServeMux()
	mux.Handle("GET /static/", http.StripPrefix("/static/", http.FileServer(http.Dir("static"))))
	mux.HandleFunc("GET /{$}", servePage("index.html", http.StatusOK))
	mux.HandleFunc("GET /", servePage("404.html", http.StatusNotFound))
	return mux
}

func servePage(page string, status int) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var buf bytes.Buffer
		if err := render(&buf, page, false); err != nil {
			log.Print(err)
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(status)
		buf.WriteTo(w)
	}
}

// render executes templates/layout.html with the given page template.
// build is true when rendering for production.
func render(w io.Writer, page string, build bool) error {
	site, err := loadSite()
	if err != nil {
		return err
	}
	site.Build = build

	tmpl, err := template.New("").Funcs(template.FuncMap{"asset": asset}).ParseFiles(
		filepath.Join("templates", "layout.html"),
		filepath.Join("templates", page),
	)
	if err != nil {
		return err
	}
	return tmpl.ExecuteTemplate(w, "layout", site)
}

// asset returns the URL of a file in static/ with a content hash appended
// so browsers pick up changes immediately.
func asset(name string) (string, error) {
	b, err := os.ReadFile(filepath.Join("static", name))
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(b)
	return "/static/" + name + "?v=" + hex.EncodeToString(sum[:5]), nil
}

// Site is everything the templates render. Links and releases come from
// site.json; doods are whatever images are in static/images/doods.
type Site struct {
	Links    []Link    `json:"links"`
	Releases []Release `json:"releases"`

	Doods []Dood `json:"-"`
	Build bool   `json:"-"`
	Year  int    `json:"-"`
}

type Link struct {
	Name string `json:"name"`
	URL  string `json:"url"`
}

type Release struct {
	Title   string  `json:"title"`
	Date    Date    `json:"date"`
	Cover   string  `json:"cover"` // file in static/images/covers
	Color   string  `json:"color"` // accent color pulled from the cover
	Spotify string  `json:"spotify"`
	Apple   string  `json:"apple"`
	Tracks  []Track `json:"tracks"`

	Number int `json:"-"` // catalog number, counting up from the first release
}

type Track struct {
	Title    string `json:"title"`
	YouTube  string `json:"youtube"` // video ID
	Duration string `json:"duration"`
}

type Dood struct {
	Src     string
	Caption string
}

// Date is a calendar date written as YYYY-MM-DD.
type Date struct{ time.Time }

func (d *Date) UnmarshalJSON(b []byte) error {
	var s string
	if err := json.Unmarshal(b, &s); err != nil {
		return err
	}
	t, err := time.Parse(time.DateOnly, s)
	d.Time = t
	return err
}

func loadSite() (Site, error) {
	var site Site
	b, err := os.ReadFile("site.json")
	if err != nil {
		return site, err
	}
	if err := json.Unmarshal(b, &site); err != nil {
		return site, fmt.Errorf("site.json: %w", err)
	}
	if len(site.Releases) == 0 {
		return site, errors.New("site.json: no releases")
	}

	slices.SortFunc(site.Releases, func(a, b Release) int { return b.Date.Compare(a.Date.Time) })
	for i := range site.Releases {
		r := &site.Releases[i]
		r.Number = len(site.Releases) - i
		if len(r.Tracks) == 0 {
			return site, fmt.Errorf("site.json: %q has no tracks", r.Title)
		}
		if _, err := os.Stat(filepath.Join("static", "images", "covers", r.Cover)); err != nil {
			return site, fmt.Errorf("site.json: %q cover: %w", r.Title, err)
		}
	}

	if site.Doods, err = loadDoods(); err != nil {
		return site, err
	}
	site.Year = time.Now().Year()
	return site, nil
}

func loadDoods() ([]Dood, error) {
	files, err := os.ReadDir(filepath.Join("static", "images", "doods"))
	if err != nil {
		return nil, err
	}
	var doods []Dood
	for _, f := range files {
		ext := filepath.Ext(f.Name())
		switch strings.ToLower(ext) {
		case ".webp", ".png", ".jpg", ".jpeg", ".gif":
		default:
			continue
		}
		doods = append(doods, Dood{
			Src:     "/static/images/doods/" + f.Name(),
			Caption: strings.ReplaceAll(strings.TrimSuffix(f.Name(), ext), "-", " "),
		})
	}
	return doods, nil
}

// Latest is the newest release.
func (s Site) Latest() Release { return s.Releases[0] }

// First is the oldest release.
func (s Site) First() Release { return s.Releases[len(s.Releases)-1] }

// JSONLD describes the band for search engines.
func (s Site) JSONLD() any {
	type album struct {
		Type        string `json:"@type"`
		Name        string `json:"name"`
		Date        string `json:"datePublished"`
		Image       string `json:"image"`
		ReleaseType string `json:"albumReleaseType"`
		Tracks      int    `json:"numTracks"`
	}
	group := struct {
		Context string   `json:"@context"`
		Type    string   `json:"@type"`
		Name    string   `json:"name"`
		URL     string   `json:"url"`
		SameAs  []string `json:"sameAs"`
		Albums  []album  `json:"album"`
	}{
		Context: "https://schema.org",
		Type:    "MusicGroup",
		Name:    "Dull Species",
		URL:     siteURL + "/",
	}
	for _, l := range s.Links {
		group.SameAs = append(group.SameAs, l.URL)
	}
	for _, r := range s.Releases {
		group.Albums = append(group.Albums, album{
			Type:        "MusicAlbum",
			Name:        r.Title,
			Date:        r.Date.Format(time.DateOnly),
			Image:       siteURL + "/static/images/covers/" + r.Cover,
			ReleaseType: "https://schema.org/SingleRelease",
			Tracks:      len(r.Tracks),
		})
	}
	return group
}
