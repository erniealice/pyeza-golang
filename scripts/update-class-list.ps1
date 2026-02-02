<#
.SYNOPSIS
    Extracts all CSS class names from the styles directory and outputs to class-list.txt

.DESCRIPTION
    This script scans all .css files in packages/components/styles/ and extracts
    unique class names, organized by source file. Useful for auditing which
    classes are available in the design system.

.EXAMPLE
    .\update-class-list.ps1

.NOTES
    Output: packages/components/styles/class-list.txt
#>

# Get script directory and navigate to styles folder
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$stylesDir = Join-Path (Split-Path -Parent $scriptDir) "styles"
$outputFile = Join-Path $stylesDir "class-list.txt"

# Regex pattern to match CSS class selectors
# Matches: .class-name, .class-name:hover, .class-name::before, etc.
$classPattern = '\.([a-zA-Z_-][a-zA-Z0-9_-]*)'

# Initialize collections
$allClasses = @{}
$fileClasses = @{}

Write-Host "Scanning CSS files in: $stylesDir" -ForegroundColor Cyan
Write-Host ""

# Get all CSS files (exclude themes subfolder for main list)
$cssFiles = Get-ChildItem -Path $stylesDir -Filter "*.css" -File |
    Where-Object { $_.Name -ne "class-list.txt" } |
    Sort-Object Name

foreach ($file in $cssFiles) {
    Write-Host "  Processing: $($file.Name)" -ForegroundColor Gray

    $content = Get-Content $file.FullName -Raw
    $classes = [System.Collections.Generic.HashSet[string]]::new()

    # Find all class selectors
    $matches = [regex]::Matches($content, $classPattern)

    foreach ($match in $matches) {
        $className = $match.Groups[1].Value

        # Skip pseudo-elements/states that got captured incorrectly
        if ($className -match '^(hover|focus|active|disabled|checked|before|after|first-child|last-child|nth-child|not|visited|placeholder|focus-within|focus-visible)$') {
            continue
        }

        # Skip CSS property values that might look like classes
        if ($className -match '^(none|auto|inherit|initial|unset)$') {
            continue
        }

        [void]$classes.Add($className)

        if (-not $allClasses.ContainsKey($className)) {
            $allClasses[$className] = $file.Name
        }
    }

    $fileClasses[$file.Name] = ($classes | Sort-Object)
}

# Build output
$output = @()
$output += "# CSS Class List - packages/components/styles/"
$output += "# Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$output += "# Total unique classes: $($allClasses.Count)"
$output += ""
$output += "=" * 70
$output += ""

# Output by file
foreach ($file in ($fileClasses.Keys | Sort-Object)) {
    $classes = $fileClasses[$file]
    if ($classes.Count -gt 0) {
        $output += "## $file ($($classes.Count) classes)"
        $output += "-" * 50
        foreach ($class in $classes) {
            $output += "  .$class"
        }
        $output += ""
    }
}

# Output alphabetical master list
$output += "=" * 70
$output += "## ALPHABETICAL MASTER LIST"
$output += "=" * 70
$output += ""

$sortedClasses = $allClasses.Keys | Sort-Object
$currentLetter = ""

foreach ($class in $sortedClasses) {
    $firstLetter = $class[0].ToString().ToUpper()

    if ($firstLetter -ne $currentLetter) {
        if ($currentLetter -ne "") {
            $output += ""
        }
        $output += "### $firstLetter"
        $currentLetter = $firstLetter
    }

    $sourceFile = $allClasses[$class]
    $output += "  .$class  ($sourceFile)"
}

# Write output file
$output | Out-File -FilePath $outputFile -Encoding UTF8

Write-Host ""
Write-Host "=" * 50 -ForegroundColor Green
Write-Host "Class list generated successfully!" -ForegroundColor Green
Write-Host "  Output: $outputFile" -ForegroundColor White
Write-Host "  Total files scanned: $($cssFiles.Count)" -ForegroundColor White
Write-Host "  Total unique classes: $($allClasses.Count)" -ForegroundColor White
Write-Host "=" * 50 -ForegroundColor Green
