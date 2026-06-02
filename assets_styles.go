package pyeza

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
)

// CopyStyles copies all component CSS assets to the target directory.
// It auto-discovers the pyeza package location using runtime.Caller.
// Works both in monorepo and as external package.
//
// The targetDir should be the app's assets/css directory.
// Component styles will be copied to assets/css/pyeza/
//
// DEPRECATED: Use CopyStylesWithTheme instead for theme support.
func CopyStyles(targetDir string) error {
	return CopyStylesWithTheme(targetDir, "warm-cream", "default")
}

// CopyStylesWithTheme copies all component CSS assets and generates the app's main.css
// with the specified theme and font. It auto-discovers the pyeza package location using
// runtime.Caller. Works both in monorepo and as external package.
//
// The targetDir should be the app's assets/css directory.
// - Component styles are copied to assets/css/pyeza/
// - App main.css is generated at assets/css/app/main.css with the selected theme and font
func CopyStylesWithTheme(targetDir, theme string, font string) error {
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		return fmt.Errorf("could not determine source file location")
	}

	webStylesDir := filepath.Join(filepath.Dir(filename), "web", "styles")

	componentsTargetDir := filepath.Join(targetDir, "pyeza")
	copied, err := copyDirStyles(filepath.Join(webStylesDir, "components"), componentsTargetDir)
	if err != nil {
		return fmt.Errorf("failed to copy styles: %w", err)
	}

	if copied == 0 {
		return fmt.Errorf("no styles were copied")
	}
	log.Printf("Copied %d component styles to: %s", copied, componentsTargetDir)

	appCssDir := filepath.Join(targetDir, "app")
	if err := generateMainCSS(webStylesDir, appCssDir, theme, font); err != nil {
		return fmt.Errorf("failed to generate main.css: %w", err)
	}

	return nil
}

// generateMainCSS creates the app's main.css by combining:
// 1. Layout tokens (dimensions, radii, transitions, z-index) from base/layout.css
// 2. Default theme CSS variables (normalized to :root) from themes/{theme}.css
// 3. All other theme CSS files for runtime switching via data-theme attribute
// 4. Base styles from base/main-base.css (density, reset, typography)
// 5. Default font attribute on :root
func generateMainCSS(webStylesDir, appCssDir, theme, font string) error {
	themesDir := filepath.Join(webStylesDir, "themes")
	baseDir := filepath.Join(webStylesDir, "base")

	if err := os.MkdirAll(appCssDir, 0755); err != nil {
		return fmt.Errorf("failed to create app CSS directory: %w", err)
	}

	themeFile := filepath.Join(themesDir, theme+".css")
	themeCSS, err := os.ReadFile(themeFile)
	if err != nil {
		return fmt.Errorf("failed to read theme file %s: %w", themeFile, err)
	}

	// Normalize default theme selector to :root so it always applies as the page default.
	// Theme files use [data-theme="name"] or :root, [data-theme="name"] selectors,
	// but the build-time default should always be :root.
	selectorRe := regexp.MustCompile(`(?::root,\s*)?\[data-theme="[^"]+"\]`)
	themeCSSNormalized := selectorRe.ReplaceAllString(string(themeCSS), ":root")

	allThemeFiles, err := filepath.Glob(filepath.Join(themesDir, "*.css"))
	if err != nil {
		return fmt.Errorf("failed to list theme files: %w", err)
	}

	// For non-default themes, strip any :root prefix so only [data-theme="..."] applies.
	// This prevents warm-cream's ":root, [data-theme=...]" from overriding the actual default.
	stripRootRe := regexp.MustCompile(`:root,\s*`)

	var otherThemesCSS string
	var themeCount int
	for _, tf := range allThemeFiles {
		if tf == themeFile {
			continue
		}
		css, err := os.ReadFile(tf)
		if err != nil {
			log.Printf("Warning: Failed to read theme file %s: %v", tf, err)
			continue
		}
		otherThemesCSS += "\n" + stripRootRe.ReplaceAllString(string(css), "")
		themeCount++
	}

	layoutCSS, err := os.ReadFile(filepath.Join(baseDir, "layout.css"))
	if err != nil {
		return fmt.Errorf("failed to read layout.css: %w", err)
	}

	baseCSS, err := os.ReadFile(filepath.Join(baseDir, "main-base.css"))
	if err != nil {
		return fmt.Errorf("failed to read main-base.css: %w", err)
	}

	header := fmt.Sprintf("/*\n * ==========================================================================\n * AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY\n * ==========================================================================\n * This file is generated at build time by ui.CopyStylesWithTheme()\n * Default theme: %s | Font: %s | All themes: %d total\n * \n * To change default theme/font, set APP_THEME and APP_FONT env variables.\n * Users can switch themes at runtime via the theme switcher in the header.\n * To customize styles, edit files in packages/pyeza-golang/web/styles/\n * ==========================================================================\n */\n\n", theme, font, themeCount+1)

	// Set the default data-font on :root. Users can override at runtime via the theme switcher.
	fontAttrCSS := fmt.Sprintf("\n/* Default font from configuration: %s */\n:root {\n    data-font: \"%s\";\n}\n\n", font, font)

	combinedCSS := header + string(layoutCSS) + "\n" + themeCSSNormalized + "\n" + otherThemesCSS + "\n\n" + string(baseCSS) + fontAttrCSS

	mainFile := filepath.Join(appCssDir, "main.css")
	if err := os.WriteFile(mainFile, []byte(combinedCSS), 0644); err != nil {
		return fmt.Errorf("failed to write main.css: %w", err)
	}

	log.Printf("Generated main.css with default theme '%s', font '%s', and %d total themes at: %s", theme, font, themeCount+1, mainFile)
	return nil
}

// CopyFonts copies the self-hosted web fonts to the target directory.
// It auto-discovers the pyeza package location using runtime.Caller, mirroring
// CopyStaticAssets / CopyStylesWithTheme. Works both in monorepo and as external package.
//
// The targetDir should be the app's top-level assets directory (e.g. "assets").
//   - woff2 binaries (web/assets/fonts/*.woff2) are copied to assets/fonts/
//   - the @font-face stylesheet (web/assets/css/fonts.css) is copied to assets/css/fonts.css
//
// This pairs with web/templates/partials/fonts.html, which loads /assets/css/fonts.css,
// whose @font-face rules reference /assets/fonts/<f>.woff2 — both served by the static
// file handler. Fonts are self-hosted (Plan-8 W4 / Q-CSP-1): no Google CDN is contacted.
func CopyFonts(targetDir string) error {
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		return fmt.Errorf("could not determine source file location")
	}

	webAssetsDir := filepath.Join(filepath.Dir(filename), "web", "assets")

	// woff2 binaries -> assets/fonts/
	fontsTargetDir := filepath.Join(targetDir, "fonts")
	copied, err := copyDirFonts(filepath.Join(webAssetsDir, "fonts"), fontsTargetDir)
	if err != nil {
		return fmt.Errorf("failed to copy fonts: %w", err)
	}
	if copied == 0 {
		return fmt.Errorf("no fonts were copied")
	}

	// fonts.css -> assets/css/fonts.css (served at /assets/css/fonts.css)
	cssTargetDir := filepath.Join(targetDir, "css")
	if err := os.MkdirAll(cssTargetDir, 0755); err != nil {
		return fmt.Errorf("failed to create css target directory: %w", err)
	}
	if err := copyFileAsset(
		filepath.Join(webAssetsDir, "css", "fonts.css"),
		filepath.Join(cssTargetDir, "fonts.css"),
	); err != nil {
		return fmt.Errorf("failed to copy fonts.css: %w", err)
	}

	log.Printf("Copied %d fonts to: %s (+ fonts.css to %s)", copied, fontsTargetDir, cssTargetDir)
	return nil
}

// copyDirFonts copies all .woff2 files from source directory to destination directory.
func copyDirFonts(srcDir, dstDir string) (int, error) {
	if err := os.MkdirAll(dstDir, 0755); err != nil {
		return 0, fmt.Errorf("failed to create target directory: %w", err)
	}

	files, err := filepath.Glob(filepath.Join(srcDir, "*.woff2"))
	if err != nil {
		return 0, fmt.Errorf("failed to list source files: %w", err)
	}

	if len(files) == 0 {
		return 0, nil
	}

	var copied int
	for _, srcFile := range files {
		baseName := filepath.Base(srcFile)
		dstFile := filepath.Join(dstDir, baseName)
		if err := copyFileAsset(srcFile, dstFile); err != nil {
			return copied, err
		}
		copied++
	}

	return copied, nil
}

// copyDirStyles copies all .css files from source directory to destination directory.
// Infrastructure files (_variables.css, index.css) are excluded as build-time imports only.
func copyDirStyles(srcDir, dstDir string) (int, error) {
	if err := os.MkdirAll(dstDir, 0755); err != nil {
		return 0, fmt.Errorf("failed to create target directory: %w", err)
	}

	files, err := filepath.Glob(filepath.Join(srcDir, "*.css"))
	if err != nil {
		return 0, fmt.Errorf("failed to list source files: %w", err)
	}

	excludeFiles := map[string]bool{
		"_variables.css": true,
		"index.css":      true,
	}

	var copied int
	for _, srcFile := range files {
		baseName := filepath.Base(srcFile)
		if excludeFiles[baseName] {
			continue
		}
		dstFile := filepath.Join(dstDir, baseName)
		if err := copyFileAsset(srcFile, dstFile); err != nil {
			return copied, err
		}
		copied++
	}

	return copied, nil
}

// copyFileAsset copies a single file from src to dst.
// Shared helper used by both CSS and JS copy paths.
func copyFileAsset(src, dst string) error {
	data, err := os.ReadFile(src)
	if err != nil {
		return fmt.Errorf("failed to read: %w", err)
	}

	if err := os.WriteFile(dst, data, 0644); err != nil {
		return fmt.Errorf("failed to write: %w", err)
	}

	return nil
}
