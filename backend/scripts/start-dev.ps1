Param(
    [int]$Port = 8000
)

# Move to backend folder (script lives in backend/scripts)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Push-Location $scriptDir\..

Write-Host "Running migrations..."
python manage.py migrate
if ($LASTEXITCODE -ne 0) {
    Write-Error "'manage.py migrate' failed with exit code $LASTEXITCODE"
    Pop-Location
    exit $LASTEXITCODE
}

Write-Host "Starting development server on port $Port..."
python manage.py runserver 0.0.0.0:$Port

Pop-Location
