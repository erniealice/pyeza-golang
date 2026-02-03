package pyeza

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
)

// assetMapping defines a source file and its relative destination path
type assetMapping struct {
	srcRelPath  string // relative to componentsDir
	dstRelPath  string // relative to targetDir
}

// CopyStyles copies all component CSS assets to the target directory.
// It auto-discovers the components package location using runtime.Caller.
// Works both in monorepo and as external package.
//
// The targetDir should be the app's assets/css directory.
// Component styles will be copied to assets/css/components/
//
// Infrastructure files (_variables.css, index.css) are not copied as they
// are build-time imports only.
//
// DEPRECATED: Use CopyStylesWithTheme instead for theme support.
//
// Example:
//
//	cssDir := filepath.Join(dataDir, "assets", "css")
//	if err := ui.CopyStyles(cssDir); err != nil {
//	    log.Printf("Warning: Failed to copy component styles: %v", err)
//	}
func CopyStyles(targetDir string) error {
	return CopyStylesWithTheme(targetDir, "warm-cream", "default")
}

// CopyStylesWithTheme copies all component CSS assets and generates the app's main.css
// with the specified theme and font. It auto-disovers the components package location using
// runtime.Caller. Works both in monorepo and as external package.
//
// The targetDir should be the app's assets/css directory.
// - Component styles are copied to assets/css/components/
// - App main.css is generated at assets/css/app/main.css with the selected theme and font
//
// Theme options: warm-cream, ocean-deep, forest-night, minimal-light, sunset-glow
// Font options: default, serif, mono, rounded, condensed
//
// Example:
//
//	cssDir := filepath.Join(dataDir, "assets", "css")
//	if err := ui.CopyStylesWithTheme(cssDir, "warm-cream", "default"); err != nil {
//	    log.Printf("Warning: Failed to copy component styles: %v", err)
//	}
func CopyStylesWithTheme(targetDir, theme string, font string) error {
	// Get the components package directory using runtime.Caller
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		return fmt.Errorf("could not determine source file location")
	}

	componentsDir := filepath.Dir(filename)
	stylesSrcDir := filepath.Join(componentsDir, "styles")

	// Copy component styles to assets/css/components/
	componentsTargetDir := filepath.Join(targetDir, "components")
	copied, err := copyDirStyles(stylesSrcDir, componentsTargetDir)
	if err != nil {
		return fmt.Errorf("failed to copy styles: %w", err)
	}

	if copied == 0 {
		return fmt.Errorf("no styles were copied")
	}
	log.Printf("Copied %d component styles to: %s", copied, componentsTargetDir)

	// Generate main.css at assets/css/app/main.css
	appCssDir := filepath.Join(targetDir, "app")
	if err := generateMainCSS(stylesSrcDir, appCssDir, theme, font); err != nil {
		return fmt.Errorf("failed to generate main.css: %w", err)
	}

	return nil
}

// generateMainCSS creates the app's main.css by combining:
// 1. Default theme CSS variables (normalized to :root) from themes/{theme}.css
// 2. All other theme CSS files for runtime switching via data-theme attribute
// 3. Base styles from main-base.css (density, reset, typography)
// 4. Default font attribute on :root
func generateMainCSS(stylesSrcDir, appCssDir, theme, font string) error {
	// Ensure target directory exists
	if err := os.MkdirAll(appCssDir, 0755); err != nil {
		return fmt.Errorf("failed to create app CSS directory: %w", err)
	}

	// Read the default theme file
	themeFile := filepath.Join(stylesSrcDir, "themes", theme+".css")
	themeCSS, err := os.ReadFile(themeFile)
	if err != nil {
		return fmt.Errorf("failed to read theme file %s: %w", themeFile, err)
	}

	// Normalize default theme selector to :root so it always applies as the page default.
	// Theme files use [data-theme="name"] or :root, [data-theme="name"] selectors,
	// but the build-time default should always be :root.
	selectorRe := regexp.MustCompile(`(?::root,\s*)?\[data-theme="[^"]+"\]`)
	themeCSSNormalized := selectorRe.ReplaceAllString(string(themeCSS), ":root")

	// Read all other theme files for runtime switching
	allThemeFiles, err := filepath.Glob(filepath.Join(stylesSrcDir, "themes", "*.css"))
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
			continue // skip the default theme (already included as :root)
		}
		css, err := os.ReadFile(tf)
		if err != nil {
			log.Printf("Warning: Failed to read theme file %s: %v", tf, err)
			continue
		}
		otherThemesCSS += "\n" + stripRootRe.ReplaceAllString(string(css), "")
		themeCount++
	}

	// Read layout.css (structural variables: dimensions, radii, transitions, z-index)
	layoutFile := filepath.Join(stylesSrcDir, "layout.css")
	layoutCSS, err := os.ReadFile(layoutFile)
	if err != nil {
		return fmt.Errorf("failed to read layout.css: %w", err)
	}

	// Read main-base.css
	baseFile := filepath.Join(stylesSrcDir, "main-base.css")
	baseCSS, err := os.ReadFile(baseFile)
	if err != nil {
		return fmt.Errorf("failed to read main-base.css: %w", err)
	}

	// Add file header to indicate this is auto-generated
	header := fmt.Sprintf("/*\n * ==========================================================================\n * AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY\n * ==========================================================================\n * This file is generated at build time by ui.CopyStylesWithTheme()\n * Default theme: %s | Font: %s | All themes: %d total\n * \n * To change default theme/font, set APP_THEME and APP_FONT env variables.\n * Users can switch themes at runtime via the theme switcher in the header.\n * To customize styles, edit files in packages/ui/styles/\n * ==========================================================================\n */\n\n", theme, font, themeCount+1)

	// Add font attribute to root as the default
	// This sets the data-font attribute on :root, making it the default font
	// Users can still override it via theme switcher or HTML attribute
	fontAttrCSS := fmt.Sprintf("\n/* Default font from configuration: %s */\n:root {\n    data-font: \"%s\";\n}\n\n", font, font)

	// Combine: header, layout vars, default theme (:root), other themes, base styles, font attribute
	combinedCSS := header + string(layoutCSS) + "\n" + themeCSSNormalized + "\n" + otherThemesCSS + "\n\n" + string(baseCSS) + fontAttrCSS

	// Write to app/main.css (always overwrites existing file - this is a generated file)
	mainFile := filepath.Join(appCssDir, "main.css")
	if err := os.WriteFile(mainFile, []byte(combinedCSS), 0644); err != nil {
		return fmt.Errorf("failed to write main.css: %w", err)
	}

	log.Printf("Generated main.css with default theme '%s', font '%s', and %d total themes at: %s", theme, font, themeCount+1, mainFile)
	return nil
}

// CopyStaticAssets copies all component JavaScript assets to the target directory.
// It auto-discovers the components package location using runtime.Caller.
// Works both in monorepo and as external package.
//
// The targetDir should be the app's assets/js directory.
// Component assets will be copied to assets/js/components/
//
// Example:
//
//	assetsDir := filepath.Join(dataDir, "assets", "js")
//	if err := ui.CopyStaticAssets(assetsDir); err != nil {
//	    log.Printf("Warning: Failed to copy component assets: %v", err)
//	}
func CopyStaticAssets(targetDir string) error {
	// Get the components package directory using runtime.Caller
	// This works both in monorepo and when package is external
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		return fmt.Errorf("could not determine source file location")
	}

	componentsDir := filepath.Dir(filename)

	// All component assets go under a "components" subdirectory for clean separation
	componentsTargetDir := filepath.Join(targetDir, "components")

	// Define all assets to copy: source relative to componentsDir, destination relative to componentsTargetDir
	assets := []assetMapping{
		// Table JS files (to assets/js/components/table/)
		{srcRelPath: "assets/js/table", dstRelPath: "table"},
		// Individual component JS files (to assets/js/components/)
		{srcRelPath: "assets/js/sheet.js", dstRelPath: "sheet.js"},
		{srcRelPath: "assets/js/help-pane.js", dstRelPath: "help-pane.js"},
		{srcRelPath: "assets/js/dialog.js", dstRelPath: "dialog.js"},
	}

	var totalCopied int

	for _, asset := range assets {
		srcPath := filepath.Join(componentsDir, asset.srcRelPath)
		dstPath := filepath.Join(componentsTargetDir, asset.dstRelPath)

		// Check if source is a directory or file
		info, err := os.Stat(srcPath)
		if err != nil {
			log.Printf("Warning: Source not found, skipping: %s", srcPath)
			continue
		}

		if info.IsDir() {
			// Copy all .js files from directory
			copied, err := copyDirAssets(srcPath, dstPath)
			if err != nil {
				log.Printf("Warning: Failed to copy %s: %v", asset.srcRelPath, err)
				continue
			}
			totalCopied += copied
		} else {
			// Copy single file
			if err := copyFileAsset(srcPath, dstPath); err != nil {
				log.Printf("Warning: Failed to copy %s: %v", asset.srcRelPath, err)
				continue
			}
			totalCopied++
		}
	}

	if totalCopied == 0 {
		return fmt.Errorf("no assets were copied")
	}

	log.Printf("Copied %d component assets to: %s", totalCopied, componentsTargetDir)
	return nil
}

// copyDirStyles copies all .css files from source directory to destination directory.
// Infrastructure files (_variables.css, index.css) are excluded.
func copyDirStyles(srcDir, dstDir string) (int, error) {
	// Ensure target directory exists
	if err := os.MkdirAll(dstDir, 0755); err != nil {
		return 0, fmt.Errorf("failed to create target directory: %w", err)
	}

	files, err := filepath.Glob(filepath.Join(srcDir, "*.css"))
	if err != nil {
		return 0, fmt.Errorf("failed to list source files: %w", err)
	}

	// Infrastructure files to exclude (build-time imports only)
	excludeFiles := map[string]bool{
		"_variables.css": true,
		"index.css":      true,
	}

	var copied int
	for _, srcFile := range files {
		baseName := filepath.Base(srcFile)

		// Skip infrastructure files
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

// copyDirAssets copies all .js files from source directory to destination directory
func copyDirAssets(srcDir, dstDir string) (int, error) {
	// Ensure target directory exists
	if err := os.MkdirAll(dstDir, 0755); err != nil {
		return 0, fmt.Errorf("failed to create target directory: %w", err)
	}

	files, err := filepath.Glob(filepath.Join(srcDir, "*.js"))
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

// copyFileAsset copies a single file from src to dst
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
