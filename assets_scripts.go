package pyeza

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"runtime"
)

// CopyStaticAssets copies all component JavaScript assets to the target directory.
// It auto-discovers the pyeza package location using runtime.Caller.
// Works both in monorepo and as external package.
//
// The targetDir should be the app's assets/js directory. Component JS files
// (web/js/components/*.js) are copied flat to assets/js/pyeza/, and the table
// JS subdirectory (web/js/table/) is mirrored to assets/js/pyeza/table/.
func CopyStaticAssets(targetDir string) error {
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		return fmt.Errorf("could not determine source file location")
	}

	webJSDir := filepath.Join(filepath.Dir(filename), "web", "js")
	componentsTargetDir := filepath.Join(targetDir, "pyeza")

	totalCopied := 0

	copied, err := copyDirAssets(
		filepath.Join(webJSDir, "components"),
		componentsTargetDir,
	)
	if err != nil {
		return fmt.Errorf("failed to copy component JS: %w", err)
	}
	totalCopied += copied

	copied, err = copyDirAssets(
		filepath.Join(webJSDir, "table"),
		filepath.Join(componentsTargetDir, "table"),
	)
	if err != nil {
		return fmt.Errorf("failed to copy table JS: %w", err)
	}
	totalCopied += copied

	if totalCopied == 0 {
		return fmt.Errorf("no assets were copied")
	}

	log.Printf("Copied %d component assets to: %s", totalCopied, componentsTargetDir)
	return nil
}

// copyDirAssets copies all .js files from source directory to destination directory.
func copyDirAssets(srcDir, dstDir string) (int, error) {
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
