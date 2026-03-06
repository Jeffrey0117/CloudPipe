package main

import (
	"crypto/tls"
	"encoding/base64"
	"encoding/json"
	"flag"
	"fmt"
	"image"
	"image/gif"
	"image/jpeg"
	"image/png"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	_ "golang.org/x/image/webp" // WebP decode support
	"golang.org/x/image/draw"
)

// Shared HTTP client with connection pooling - THE KEY TO WINNING
var sharedClient *http.Client

func init() {
	// Aggressive connection pooling for batch downloads
	transport := &http.Transport{
		TLSClientConfig: &tls.Config{
			MinVersion: tls.VersionTLS12,
			MaxVersion: tls.VersionTLS13,
		},
		MaxIdleConns:          100,
		MaxIdleConnsPerHost:   10,
		MaxConnsPerHost:       10,
		IdleConnTimeout:       90 * time.Second,
		DisableCompression:    false,
		TLSHandshakeTimeout:   10 * time.Second,
		ResponseHeaderTimeout: 10 * time.Second,
	}

	sharedClient = &http.Client{
		Timeout:   30 * time.Second,
		Transport: transport,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 10 {
				return fmt.Errorf("too many redirects")
			}
			return nil
		},
	}
}

// Result types
type ScrapeResult struct {
	Success bool     `json:"success"`
	Images  []string `json:"images,omitempty"`
	Error   string   `json:"error,omitempty"`
}

type DownloadItem struct {
	URL      string `json:"url"`
	Filename string `json:"filename"`
	Success  bool   `json:"success"`
	Error    string `json:"error,omitempty"`
	Size     int64  `json:"size,omitempty"`
}

type DownloadResult struct {
	Success   bool           `json:"success"`
	Total     int            `json:"total"`
	Completed int            `json:"completed"`
	Failed    int            `json:"failed"`
	Items     []DownloadItem `json:"items"`
	Duration  int64          `json:"duration_ms"`
	Error     string         `json:"error,omitempty"`
}

type ThumbnailItem struct {
	Source    string `json:"source"`
	Output    string `json:"output,omitempty"`
	Base64    string `json:"base64,omitempty"`
	Success   bool   `json:"success"`
	Error     string `json:"error,omitempty"`
	Width     int    `json:"width,omitempty"`
	Height    int    `json:"height,omitempty"`
}

type ThumbnailResult struct {
	Success   bool            `json:"success"`
	Total     int             `json:"total"`
	Completed int             `json:"completed"`
	Failed    int             `json:"failed"`
	Items     []ThumbnailItem `json:"items"`
	Duration  int64           `json:"duration_ms"`
	Error     string          `json:"error,omitempty"`
}

func main() {
	// Scrape mode
	urlFlag := flag.String("url", "", "URL to scrape")

	// Download mode
	downloadFlag := flag.Bool("download", false, "Enable batch download mode")
	urlsFlag := flag.String("urls", "", "Comma-separated URLs to download")
	outputFlag := flag.String("output", "", "Output directory for downloads/thumbnails")
	concurrencyFlag := flag.Int("concurrency", 8, "Max concurrent operations")

	// Thumbnail mode
	thumbnailFlag := flag.Bool("thumbnail", false, "Enable thumbnail generation mode")
	filesFlag := flag.String("files", "", "Comma-separated file paths for thumbnails")
	sizeFlag := flag.Int("size", 200, "Thumbnail max dimension")
	base64Flag := flag.Bool("base64", false, "Output thumbnails as base64 instead of files")
	streamFlag := flag.Bool("stream", false, "Stream results as NDJSON (one item per line)")

	// Crop mode
	cropFlag := flag.Bool("crop", false, "Enable crop mode")
	inputFlag := flag.String("input", "", "Input file path")
	cropXFlag := flag.Int("x", 0, "Crop X position (pixels)")
	cropYFlag := flag.Int("y", 0, "Crop Y position (pixels)")
	cropWFlag := flag.Int("w", 0, "Crop width (pixels)")
	cropHFlag := flag.Int("h", 0, "Crop height (pixels)")

	// Compress mode
	compressFlag := flag.Bool("compress", false, "Enable compress mode")
	qualityFlag := flag.Int("quality", 85, "JPEG quality (1-100)")

	// Prefetch mode - download URLs to temp, return local paths (streaming)
	prefetchFlag := flag.Bool("prefetch", false, "Enable prefetch mode")

	flag.Parse()

	if *cropFlag {
		// Crop mode
		if *inputFlag == "" || *outputFlag == "" {
			outputJSON(map[string]interface{}{"success": false, "error": "input and output required"})
			return
		}
		result := cropImage(*inputFlag, *outputFlag, *cropXFlag, *cropYFlag, *cropWFlag, *cropHFlag)
		outputJSON(result)
	} else if *compressFlag {
		// Compress mode
		if *inputFlag == "" || *outputFlag == "" {
			outputJSON(map[string]interface{}{"success": false, "error": "input and output required"})
			return
		}
		result := compressImage(*inputFlag, *outputFlag, *qualityFlag)
		outputJSON(result)
	} else if *prefetchFlag {
		// Prefetch mode - streaming download to temp
		if *urlsFlag == "" || *outputFlag == "" {
			outputJSON(map[string]interface{}{"success": false, "error": "urls and output required"})
			return
		}
		urls := strings.Split(*urlsFlag, ",")
		prefetchImages(urls, *outputFlag, *concurrencyFlag)
	} else if *thumbnailFlag {
		// Thumbnail generation mode
		if *filesFlag == "" {
			outputThumbnailError("files are required for thumbnail mode")
			return
		}
		files := strings.Split(*filesFlag, ",")
		if *streamFlag {
			// Streaming mode: output each item immediately as it completes
			batchThumbnailsStreaming(files, *outputFlag, *sizeFlag, *concurrencyFlag, *base64Flag)
		} else {
			result := batchThumbnails(files, *outputFlag, *sizeFlag, *concurrencyFlag, *base64Flag)
			json.NewEncoder(os.Stdout).Encode(result)
		}
	} else if *downloadFlag {
		// Batch download mode
		if *urlsFlag == "" || *outputFlag == "" {
			outputDownloadError("urls and output are required for download mode")
			return
		}
		urls := strings.Split(*urlsFlag, ",")
		result := batchDownload(urls, *outputFlag, *concurrencyFlag)
		json.NewEncoder(os.Stdout).Encode(result)
	} else if *urlFlag != "" {
		// Scrape mode
		images, err := scrapeImages(*urlFlag)
		if err != nil {
			outputScrapeError(err.Error())
			return
		}
		outputScrapeSuccess(images)
	} else {
		outputScrapeError("url, download, or thumbnail mode required")
	}
}

func outputScrapeSuccess(images []string) {
	result := ScrapeResult{Success: true, Images: images}
	json.NewEncoder(os.Stdout).Encode(result)
}

func outputScrapeError(msg string) {
	result := ScrapeResult{Success: false, Error: msg}
	json.NewEncoder(os.Stdout).Encode(result)
}

func outputDownloadError(msg string) {
	result := DownloadResult{Success: false, Error: msg}
	json.NewEncoder(os.Stdout).Encode(result)
}

func outputThumbnailError(msg string) {
	result := ThumbnailResult{Success: false, Error: msg}
	json.NewEncoder(os.Stdout).Encode(result)
}

// ============ THUMBNAIL MODE ============

// Streaming version: output each item immediately as NDJSON
func batchThumbnailsStreaming(files []string, outputDir string, maxSize int, concurrency int, outputBase64 bool) {
	startTime := time.Now()
	encoder := json.NewEncoder(os.Stdout)

	// Create output dir if not base64 mode
	if !outputBase64 && outputDir != "" {
		if err := os.MkdirAll(outputDir, 0755); err != nil {
			encoder.Encode(ThumbnailItem{Source: "", Error: err.Error()})
			return
		}
	}

	sem := make(chan struct{}, concurrency)
	results := make(chan ThumbnailItem, len(files))
	var wg sync.WaitGroup

	for _, file := range files {
		file = strings.TrimSpace(file)
		if file == "" {
			continue
		}

		wg.Add(1)
		go func(filePath string) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			item := generateThumbnail(filePath, outputDir, maxSize, outputBase64)
			results <- item
		}(file)
	}

	go func() {
		wg.Wait()
		close(results)
	}()

	completed := 0
	failed := 0

	// Stream each result immediately as it arrives
	for item := range results {
		encoder.Encode(item) // Output one JSON line per item
		if item.Success {
			completed++
		} else {
			failed++
		}
	}

	// Final summary line (type: "summary")
	duration := time.Since(startTime).Milliseconds()
	encoder.Encode(map[string]interface{}{
		"type":        "summary",
		"total":       len(files),
		"completed":   completed,
		"failed":      failed,
		"duration_ms": duration,
	})
}

func batchThumbnails(files []string, outputDir string, maxSize int, concurrency int, outputBase64 bool) ThumbnailResult {
	startTime := time.Now()

	// Create output dir if not base64 mode
	if !outputBase64 && outputDir != "" {
		if err := os.MkdirAll(outputDir, 0755); err != nil {
			return ThumbnailResult{Success: false, Error: err.Error()}
		}
	}

	sem := make(chan struct{}, concurrency)
	results := make(chan ThumbnailItem, len(files))
	var wg sync.WaitGroup

	for _, file := range files {
		file = strings.TrimSpace(file)
		if file == "" {
			continue
		}

		wg.Add(1)
		go func(filePath string) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			item := generateThumbnail(filePath, outputDir, maxSize, outputBase64)
			results <- item
		}(file)
	}

	go func() {
		wg.Wait()
		close(results)
	}()

	var items []ThumbnailItem
	completed := 0
	failed := 0

	for item := range results {
		items = append(items, item)
		if item.Success {
			completed++
		} else {
			failed++
		}
	}

	duration := time.Since(startTime).Milliseconds()

	return ThumbnailResult{
		Success:   failed == 0,
		Total:     len(files),
		Completed: completed,
		Failed:    failed,
		Items:     items,
		Duration:  duration,
	}
}

func generateThumbnail(source string, outputDir string, maxSize int, outputBase64 bool) ThumbnailItem {
	item := ThumbnailItem{Source: source}

	// Open image file
	var reader io.ReadCloser
	var err error

	if strings.HasPrefix(source, "http://") || strings.HasPrefix(source, "https://") {
		// Download from URL
		resp, err := sharedClient.Get(source)
		if err != nil {
			item.Error = err.Error()
			return item
		}
		defer resp.Body.Close()
		if resp.StatusCode != 200 {
			item.Error = fmt.Sprintf("HTTP %d", resp.StatusCode)
			return item
		}
		reader = resp.Body
	} else {
		// Local file
		f, err := os.Open(source)
		if err != nil {
			item.Error = err.Error()
			return item
		}
		defer f.Close()
		reader = f
	}

	// Decode image
	img, format, err := image.Decode(reader)
	if err != nil {
		item.Error = fmt.Sprintf("decode: %v", err)
		return item
	}

	// Calculate thumbnail dimensions
	bounds := img.Bounds()
	origW := bounds.Dx()
	origH := bounds.Dy()

	var newW, newH int
	if origW > origH {
		if origW > maxSize {
			newW = maxSize
			newH = int(float64(origH) * float64(maxSize) / float64(origW))
		} else {
			newW = origW
			newH = origH
		}
	} else {
		if origH > maxSize {
			newH = maxSize
			newW = int(float64(origW) * float64(maxSize) / float64(origH))
		} else {
			newW = origW
			newH = origH
		}
	}

	// Create thumbnail using high-quality CatmullRom scaling
	thumb := image.NewRGBA(image.Rect(0, 0, newW, newH))
	draw.CatmullRom.Scale(thumb, thumb.Bounds(), img, bounds, draw.Over, nil)

	item.Width = newW
	item.Height = newH

	if outputBase64 {
		// Encode to base64
		var buf strings.Builder
		buf.WriteString("data:image/jpeg;base64,")

		// Create a pipe to encode directly to base64
		pr, pw := io.Pipe()
		go func() {
			jpeg.Encode(pw, thumb, &jpeg.Options{Quality: 80})
			pw.Close()
		}()

		data, err := io.ReadAll(pr)
		if err != nil {
			item.Error = fmt.Sprintf("encode: %v", err)
			return item
		}

		item.Base64 = "data:image/jpeg;base64," + base64.StdEncoding.EncodeToString(data)
		item.Success = true
	} else {
		// Save to file
		filename := filepath.Base(source)
		// Change extension to .jpg
		ext := filepath.Ext(filename)
		if ext != "" {
			filename = filename[:len(filename)-len(ext)] + ".jpg"
		} else {
			filename = filename + ".jpg"
		}

		outputPath := filepath.Join(outputDir, "thumb_"+filename)

		f, err := os.Create(outputPath)
		if err != nil {
			item.Error = err.Error()
			return item
		}
		defer f.Close()

		// Use appropriate encoder based on format
		if format == "gif" {
			err = gif.Encode(f, thumb, nil)
		} else {
			err = jpeg.Encode(f, thumb, &jpeg.Options{Quality: 85})
		}

		if err != nil {
			item.Error = fmt.Sprintf("encode: %v", err)
			return item
		}

		item.Output = outputPath
		item.Success = true
	}

	return item
}

// ============ DOWNLOAD MODE ============

func batchDownload(urls []string, outputDir string, concurrency int) DownloadResult {
	startTime := time.Now()

	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return DownloadResult{Success: false, Error: err.Error()}
	}

	sem := make(chan struct{}, concurrency)
	results := make(chan DownloadItem, len(urls))
	var wg sync.WaitGroup

	for i, rawURL := range urls {
		rawURL = strings.TrimSpace(rawURL)
		if rawURL == "" {
			continue
		}

		wg.Add(1)
		go func(idx int, imageURL string) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			filename := generateFilename(imageURL, idx)
			outputPath := filepath.Join(outputDir, filename)
			size, err := downloadFile(imageURL, outputPath)

			item := DownloadItem{
				URL:      imageURL,
				Filename: filename,
			}

			if err != nil {
				item.Success = false
				item.Error = err.Error()
			} else {
				item.Success = true
				item.Size = size
			}

			results <- item
		}(i, rawURL)
	}

	go func() {
		wg.Wait()
		close(results)
	}()

	var items []DownloadItem
	completed := 0
	failed := 0

	for item := range results {
		items = append(items, item)
		if item.Success {
			completed++
		} else {
			failed++
		}
	}

	duration := time.Since(startTime).Milliseconds()

	return DownloadResult{
		Success:   failed == 0,
		Total:     len(urls),
		Completed: completed,
		Failed:    failed,
		Items:     items,
		Duration:  duration,
	}
}

func downloadFile(imageURL, outputPath string) (int64, error) {
	req, err := http.NewRequest("GET", imageURL, nil)
	if err != nil {
		return 0, err
	}

	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "image/webp,image/apng,image/*,*/*;q=0.8")
	req.Header.Set("Accept-Language", "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7")

	resp, err := sharedClient.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return 0, fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	contentType := resp.Header.Get("Content-Type")
	if !strings.Contains(contentType, "image") && contentType != "" {
		return 0, fmt.Errorf("not an image: %s", contentType)
	}

	out, err := os.Create(outputPath)
	if err != nil {
		return 0, err
	}
	defer out.Close()

	written, err := io.Copy(out, resp.Body)
	if err != nil {
		os.Remove(outputPath)
		return 0, err
	}

	return written, nil
}

func generateFilename(imageURL string, index int) string {
	parsed, err := url.Parse(imageURL)
	if err != nil {
		return fmt.Sprintf("image_%d.jpg", index)
	}

	urlPath := parsed.Path
	filename := filepath.Base(urlPath)

	ext := strings.ToLower(filepath.Ext(filename))
	validExts := map[string]bool{".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".webp": true}

	if !validExts[ext] {
		filename = fmt.Sprintf("image_%d.jpg", index)
	}

	filename = strings.ReplaceAll(filename, ":", "_")
	filename = strings.ReplaceAll(filename, "?", "_")
	filename = strings.ReplaceAll(filename, "&", "_")

	return filename
}

// ============ SCRAPE MODE ============

func scrapeImages(targetURL string) ([]string, error) {
	parsedURL, err := url.Parse(targetURL)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest("GET", targetURL, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	req.Header.Set("Accept-Language", "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7")

	if strings.Contains(parsedURL.Host, "ptt.cc") {
		req.Header.Set("Cookie", "over18=1")
	}

	resp, err := sharedClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	html := string(body)
	images := extractImages(html, parsedURL)

	return images, nil
}

func extractImages(html string, baseURL *url.URL) []string {
	imageSet := make(map[string]bool)
	var mu sync.Mutex

	patterns := []string{
		`<img[^>]+src=["']([^"']+)["']`,
		`srcset=["']([^"']+)["']`,
		`<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']`,
		`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']`,
		`background(?:-image)?:\s*url\(["']?([^"')]+)["']?\)`,
		`href=["'](https?://[^"']+\.(?:jpg|jpeg|png|gif|webp))["']`,
		`(https?://(?:i\.)?imgur\.com/[a-zA-Z0-9]+\.(?:jpg|jpeg|png|gif|webp))`,
	}

	for _, pattern := range patterns {
		re := regexp.MustCompile(pattern)
		matches := re.FindAllStringSubmatch(html, -1)
		for _, match := range matches {
			if len(match) > 1 {
				if strings.Contains(pattern, "srcset") {
					srcsetParts := strings.Split(match[1], ",")
					for _, part := range srcsetParts {
						part = strings.TrimSpace(part)
						fields := strings.Fields(part)
						if len(fields) > 0 {
							addImage(imageSet, &mu, fields[0], baseURL)
						}
					}
				} else {
					addImage(imageSet, &mu, match[1], baseURL)
				}
			}
		}
	}

	var images []string
	for img := range imageSet {
		images = append(images, img)
	}

	return images
}

func addImage(imageSet map[string]bool, mu *sync.Mutex, imgURL string, baseURL *url.URL) {
	imgURL = strings.TrimSpace(imgURL)

	if imgURL == "" {
		return
	}

	if strings.HasPrefix(imgURL, "data:") ||
		strings.Contains(imgURL, "1x1") ||
		strings.Contains(imgURL, "pixel") ||
		strings.Contains(imgURL, "tracking") ||
		strings.Contains(imgURL, "spacer") {
		return
	}

	if strings.HasPrefix(imgURL, "//") {
		imgURL = "https:" + imgURL
	}

	if strings.HasPrefix(imgURL, "/") {
		imgURL = baseURL.Scheme + "://" + baseURL.Host + imgURL
	}

	if !strings.HasPrefix(imgURL, "http") {
		return
	}

	mu.Lock()
	imageSet[imgURL] = true
	mu.Unlock()
}

// ============ HELPERS ============

func outputJSON(data interface{}) {
	json.NewEncoder(os.Stdout).Encode(data)
}

// ============ CROP MODE ============

func cropImage(inputPath, outputPath string, x, y, w, h int) map[string]interface{} {
	result := make(map[string]interface{})

	f, err := os.Open(inputPath)
	if err != nil {
		result["success"] = false
		result["error"] = err.Error()
		return result
	}
	defer f.Close()

	img, format, err := image.Decode(f)
	if err != nil {
		result["success"] = false
		result["error"] = fmt.Sprintf("decode: %v", err)
		return result
	}

	bounds := img.Bounds()
	origW := bounds.Dx()
	origH := bounds.Dy()

	// Validate crop bounds
	if w <= 0 || h <= 0 || x < 0 || y < 0 || x+w > origW || y+h > origH {
		result["success"] = false
		result["error"] = fmt.Sprintf("invalid crop bounds: x=%d y=%d w=%d h=%d (image: %dx%d)", x, y, w, h, origW, origH)
		return result
	}

	// Create cropped image using SubImage (zero-copy if possible)
	type subImager interface {
		SubImage(r image.Rectangle) image.Image
	}

	var cropped image.Image
	if si, ok := img.(subImager); ok {
		cropped = si.SubImage(image.Rect(x, y, x+w, y+h))
	} else {
		// Fallback: copy pixels
		dst := image.NewRGBA(image.Rect(0, 0, w, h))
		draw.Draw(dst, dst.Bounds(), img, image.Pt(x, y), draw.Src)
		cropped = dst
	}

	// Create output file
	out, err := os.Create(outputPath)
	if err != nil {
		result["success"] = false
		result["error"] = err.Error()
		return result
	}
	defer out.Close()

	// Encode based on output extension or original format
	ext := strings.ToLower(filepath.Ext(outputPath))
	switch ext {
	case ".png":
		err = png.Encode(out, cropped)
	case ".gif":
		err = gif.Encode(out, cropped, nil)
	default:
		err = jpeg.Encode(out, cropped, &jpeg.Options{Quality: 95})
	}

	if err != nil {
		result["success"] = false
		result["error"] = fmt.Sprintf("encode: %v", err)
		return result
	}

	result["success"] = true
	result["output"] = outputPath
	result["width"] = w
	result["height"] = h
	result["format"] = format
	return result
}

// ============ COMPRESS MODE ============

// ============ PREFETCH MODE ============

// PrefetchItem represents a single prefetch result
type PrefetchItem struct {
	URL       string `json:"url"`
	LocalPath string `json:"localPath,omitempty"`
	Success   bool   `json:"success"`
	Error     string `json:"error,omitempty"`
	Size      int64  `json:"size,omitempty"`
	Cached    bool   `json:"cached,omitempty"` // true if file already existed
}

// prefetchImages downloads images to temp dir, streaming results as NDJSON
func prefetchImages(urls []string, tempDir string, concurrency int) {
	encoder := json.NewEncoder(os.Stdout)

	// Create temp dir if needed
	if err := os.MkdirAll(tempDir, 0755); err != nil {
		encoder.Encode(PrefetchItem{Error: err.Error()})
		return
	}

	sem := make(chan struct{}, concurrency)
	results := make(chan PrefetchItem, len(urls))
	var wg sync.WaitGroup

	for _, rawURL := range urls {
		rawURL = strings.TrimSpace(rawURL)
		if rawURL == "" || !strings.HasPrefix(rawURL, "http") {
			continue
		}

		wg.Add(1)
		go func(imageURL string) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			item := prefetchSingleImage(imageURL, tempDir)
			results <- item
		}(rawURL)
	}

	go func() {
		wg.Wait()
		close(results)
	}()

	// Stream each result immediately
	completed := 0
	failed := 0
	for item := range results {
		encoder.Encode(item)
		if item.Success {
			completed++
		} else {
			failed++
		}
	}

	// Final summary
	encoder.Encode(map[string]interface{}{
		"type":      "summary",
		"completed": completed,
		"failed":    failed,
	})
}

// prefetchSingleImage downloads one image to temp dir
func prefetchSingleImage(imageURL, tempDir string) PrefetchItem {
	item := PrefetchItem{URL: imageURL}

	// Generate filename from URL hash (deterministic)
	hash := hashURL(imageURL)
	ext := getExtFromURL(imageURL)
	filename := hash + ext
	localPath := filepath.Join(tempDir, filename)

	// Check if already cached
	if info, err := os.Stat(localPath); err == nil {
		item.Success = true
		item.LocalPath = localPath
		item.Size = info.Size()
		item.Cached = true
		return item
	}

	// Download
	req, err := http.NewRequest("GET", imageURL, nil)
	if err != nil {
		item.Error = err.Error()
		return item
	}

	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
	req.Header.Set("Accept", "image/webp,image/apng,image/*,*/*;q=0.8")

	resp, err := sharedClient.Do(req)
	if err != nil {
		item.Error = err.Error()
		return item
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		item.Error = fmt.Sprintf("HTTP %d", resp.StatusCode)
		return item
	}

	// Write to temp file
	out, err := os.Create(localPath)
	if err != nil {
		item.Error = err.Error()
		return item
	}
	defer out.Close()

	written, err := io.Copy(out, resp.Body)
	if err != nil {
		os.Remove(localPath)
		item.Error = err.Error()
		return item
	}

	item.Success = true
	item.LocalPath = localPath
	item.Size = written
	return item
}

// hashURL creates a short hash from URL for filename
func hashURL(u string) string {
	// Simple hash: use last 16 chars of base64 encoded URL
	encoded := base64.URLEncoding.EncodeToString([]byte(u))
	if len(encoded) > 16 {
		return encoded[len(encoded)-16:]
	}
	return encoded
}

// getExtFromURL extracts extension from URL
func getExtFromURL(u string) string {
	parsed, err := url.Parse(u)
	if err != nil {
		return ".jpg"
	}
	ext := strings.ToLower(filepath.Ext(parsed.Path))
	validExts := map[string]bool{".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".webp": true}
	if validExts[ext] {
		return ext
	}
	return ".jpg"
}

func compressImage(inputPath, outputPath string, quality int) map[string]interface{} {
	result := make(map[string]interface{})

	f, err := os.Open(inputPath)
	if err != nil {
		result["success"] = false
		result["error"] = err.Error()
		return result
	}
	defer f.Close()

	img, format, err := image.Decode(f)
	if err != nil {
		result["success"] = false
		result["error"] = fmt.Sprintf("decode: %v", err)
		return result
	}

	// Clamp quality
	if quality < 1 {
		quality = 1
	} else if quality > 100 {
		quality = 100
	}

	// Create output file
	out, err := os.Create(outputPath)
	if err != nil {
		result["success"] = false
		result["error"] = err.Error()
		return result
	}
	defer out.Close()

	// Always output JPEG for compression
	err = jpeg.Encode(out, img, &jpeg.Options{Quality: quality})
	if err != nil {
		result["success"] = false
		result["error"] = fmt.Sprintf("encode: %v", err)
		return result
	}

	// Get file size
	info, _ := os.Stat(outputPath)
	var size int64
	if info != nil {
		size = info.Size()
	}

	result["success"] = true
	result["output"] = outputPath
	result["quality"] = quality
	result["size"] = size
	result["format"] = format
	return result
}
