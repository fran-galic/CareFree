#!/usr/bin/env python
"""
Post-deployment script for Railway
Runs database setup commands and continues even if some fail
"""
import subprocess
import sys


def run_command(description, command):
    """Run a command and print status, but don't fail the entire script"""
    print(f"\n{'='*60}")
    print(f"Running: {description}")
    print(f"Command: {command}")
    print(f"{'='*60}")
    
    try:
        result = subprocess.run(
            command,
            shell=True,
            check=False,
            capture_output=True,
            text=True
        )
        
        if result.stdout:
            print(result.stdout)
        if result.stderr:
            print(result.stderr, file=sys.stderr)
            
        if result.returncode == 0:
            print(f"✓ {description} completed successfully")
            return True
        else:
            print(f"✗ {description} failed with exit code {result.returncode}")
            print("Continuing with next command...")
            return False
    except Exception as e:
        print(f"✗ {description} failed with exception: {e}")
        print("Continuing with next command...")
        return False


def main():
    print("\n" + "="*60)
    print("RAILWAY POST-DEPLOYMENT SETUP")
    print("="*60)
    
    # Add error handling for Railway environment
    import os
    print(f"Current directory: {os.getcwd()}")
    print(f"Python executable: {sys.executable}")
    print(f"Environment: {os.environ.get('RAILWAY_ENVIRONMENT', 'development')}")
    
    commands = [
        ("Database migrations", "python manage.py migrate --noinput"),
        ("Create superuser", "python manage.py create_superuser"),
        ("Seed help categories", "python manage.py seed_help_categories"),
        ("Generate dummy caretakers", "python manage.py generate_dummy_caretakers --count 45"),
    ]
    
    results = []
    for description, command in commands:
        success = run_command(description, command)
        results.append((description, success))
    
    print("\n" + "="*60)
    print("SETUP SUMMARY")
    print("="*60)
    for description, success in results:
        status = "✓ SUCCESS" if success else "✗ FAILED"
        print(f"{status}: {description}")
    
    print("="*60)
    print("Setup script completed. Starting application...")
    print("="*60 + "\n")
    
    # Exit with 0 even if some commands failed
    # The app should still start
    sys.exit(0)


if __name__ == "__main__":
    main()
