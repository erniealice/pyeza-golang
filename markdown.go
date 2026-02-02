package ui

import (
	"bytes"
	"html/template"
	"os"
	"path/filepath"

	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/extension"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/renderer/html"
)

var md goldmark.Markdown

func init() {
	md = goldmark.New(
		goldmark.WithExtensions(extension.GFM),
		goldmark.WithParserOptions(
			parser.WithAutoHeadingID(),
		),
		goldmark.WithRendererOptions(
			html.WithHardWraps(),
			html.WithXHTML(),
		),
	)
}

// RenderMarkdown converts markdown content to HTML
func RenderMarkdown(content []byte) (template.HTML, error) {
	var buf bytes.Buffer
	if err := md.Convert(content, &buf); err != nil {
		return "", err
	}
	return template.HTML(buf.String()), nil
}

// LoadHelpContent loads a markdown file from the helpdesk directory and renders it to HTML
// The filename should be the name without path (e.g., "marketplace.md")
// dataDirFunc is a function that returns the data directory path
func LoadHelpContent(filename string, dataDirFunc func() string) (template.HTML, error) {
	dataDir := dataDirFunc()
	fullPath := filepath.Join(dataDir, "helpdesk", filename)
	content, err := os.ReadFile(fullPath)
	if err != nil {
		return "", err
	}
	return RenderMarkdown(content)
}
