<#
PowerShell helper to prepare and perform commit for calendar_integration changes.
This script will show the files to be added and ask for confirmation before
running `git add` and `git commit`.

Run from repository root:
  powershell -ExecutionPolicy Bypass -File backend\scripts\prepare_commit.ps1
#>

$files = @(
    '.gitignore',
    'backend/backend/settings.py',
    'backend/backend/urls.py',
    'backend/requirements.txt',
    'backend/calendar_integration/'
)

Write-Host "Files to stage:`n" -ForegroundColor Cyan
$files | ForEach-Object { Write-Host " - $_" }

$ok = Read-Host "Stage and commit these files? (yes/NO)"
if ($ok -ne 'yes') {
    Write-Host "Aborting. No changes staged." -ForegroundColor Yellow
    exit 0
}

git add --verbose $files

$msg = Read-Host "Enter commit message"
if (-not $msg) { $msg = "Add calendar_integration scaffold and fixes" }

git commit -m $msg
Write-Host "Commit created (if there were staged changes)." -ForegroundColor Green
