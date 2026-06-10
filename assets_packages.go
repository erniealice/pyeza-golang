package pyeza

import (
	"fmt"
	"io/fs"
	"log"
	"os"
	"path/filepath"
)

// CopyNamespacedAssets copies every file matching pattern from an embedded FS
// (under srcSubdir) into targetDir/<namespace>/. It replaces each view package's
// duplicated CopyStyles/CopyStaticAssets + the runtime.Caller packageDir() hack:
// the package embeds its own assets and passes the embed.FS in. Returns the count
// copied. A missing/empty srcSubdir is not an error (returns 0) — mirrors the prior
// "no files found -> log and continue" behaviour.
func CopyNamespacedAssets(assets fs.FS, srcSubdir, namespace, targetDir, pattern string) (int, error) {
	matches, err := fs.Glob(assets, filepath.Join(srcSubdir, pattern))
	if err != nil {
		return 0, fmt.Errorf("glob %s/%s: %w", srcSubdir, pattern, err)
	}
	if len(matches) == 0 {
		log.Printf("%s: no %s files found under %s", namespace, pattern, srcSubdir)
		return 0, nil
	}
	dstDir := filepath.Join(targetDir, namespace)
	if err := os.MkdirAll(dstDir, 0755); err != nil {
		return 0, fmt.Errorf("create %s: %w", dstDir, err)
	}
	var copied int
	for _, src := range matches {
		data, rerr := fs.ReadFile(assets, src)
		if rerr != nil {
			log.Printf("Warning: failed to read %s: %v", src, rerr)
			continue
		}
		dst := filepath.Join(dstDir, filepath.Base(src))
		if werr := os.WriteFile(dst, data, 0644); werr != nil {
			return copied, fmt.Errorf("write %s: %w", dst, werr)
		}
		copied++
	}
	log.Printf("Copied %d %s assets to %s", copied, namespace, dstDir)
	return copied, nil
}
