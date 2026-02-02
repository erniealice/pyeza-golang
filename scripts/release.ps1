<#
.SYNOPSIS
    Tags and publishes a new version of the Go module.

.DESCRIPTION
    Creates a git tag for the given version and requests the Go module proxy
    to fetch it, effectively publishing the module.

.PARAMETER Version
    Semantic version to release (e.g. 0.0.1 or v0.0.1). A leading "v" is stripped automatically.

.EXAMPLE
    .\release.ps1 0.0.1
    .\release.ps1 v0.0.2
#>

param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Version
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Strip leading 'v' if present
$Version = $Version -replace '^v', ''

# Validate semver format
if ($Version -notmatch '^\d+\.\d+\.\d+(-[\w.]+)?$') {
    Write-Host "ERROR: Invalid version '$Version'. Expected format: MAJOR.MINOR.PATCH (e.g. 0.0.1)" -ForegroundColor Red
    exit 1
}

$tag = "v$Version"

Write-Host ""
Write-Host "Releasing module: github.com/erniealice/pyeza-golang@$tag" -ForegroundColor Cyan
Write-Host ""

# Ensure working tree is clean
$status = git status --porcelain
if ($status) {
    Write-Host "ERROR: Working tree is not clean. Commit or stash changes first." -ForegroundColor Red
    git status --short
    exit 1
}

# Check if tag already exists
$existingTag = git tag -l $tag
if ($existingTag) {
    Write-Host "ERROR: Tag '$tag' already exists." -ForegroundColor Red
    exit 1
}

# Create and push the tag
Write-Host "  Creating tag: $tag" -ForegroundColor Gray
git tag $tag
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "  Pushing tag to origin..." -ForegroundColor Gray
git push origin $tag
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# Request the Go module proxy to fetch the new version
Write-Host "  Publishing to Go module proxy..." -ForegroundColor Gray
$proxyUrl = "https://proxy.golang.org/github.com/erniealice/pyeza-golang/@v/$tag.info"
try {
    $response = Invoke-WebRequest -Uri $proxyUrl -UseBasicParsing
    Write-Host "  Proxy response: $($response.StatusCode)" -ForegroundColor Gray
} catch {
    Write-Host "  WARNING: Proxy fetch returned an error. The module may take a moment to appear." -ForegroundColor Yellow
    Write-Host "  $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=" * 50 -ForegroundColor Green
Write-Host "Released github.com/erniealice/pyeza-golang@$tag" -ForegroundColor Green
Write-Host "  Verify: go list -m github.com/erniealice/pyeza-golang@$tag" -ForegroundColor White
Write-Host "=" * 50 -ForegroundColor Green
