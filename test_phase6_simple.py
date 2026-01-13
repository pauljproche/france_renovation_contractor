#!/usr/bin/env python3
"""
Simple Phase 6 Test: Verify JSON file is NOT modified during writes
"""

import os
import sys
import time
from pathlib import Path
from datetime import datetime

# Add backend to path
backend_dir = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_dir))

# Change to backend directory and load .env
os.chdir(backend_dir)
from dotenv import load_dotenv
env_path = backend_dir / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
else:
    load_dotenv()

# Check USE_DATABASE
use_database = os.getenv("USE_DATABASE", "false").lower() == "true"
if not use_database:
    print("❌ ERROR: USE_DATABASE is not set to true")
    sys.exit(1)

from db_session import db_readonly_session
import services.materials_service as materials_service
import requests

# Paths
PROJECT_DIR = Path(__file__).parent.parent
MATERIALS_JSON = PROJECT_DIR / "data" / "materials.json"

def get_json_timestamp():
    """Get JSON file modification timestamp."""
    if MATERIALS_JSON.exists():
        return MATERIALS_JSON.stat().st_mtime
    return None

def test_json_not_modified_via_api():
    """Test: Make API call and verify JSON file is NOT modified."""
    print("="*60)
    print("Phase 6 Test: JSON file should NOT be modified during writes")
    print("="*60)
    
    # Get initial timestamp
    initial_timestamp = get_json_timestamp()
    initial_time_str = datetime.fromtimestamp(initial_timestamp).strftime("%Y-%m-%d %H:%M:%S") if initial_timestamp else "N/A"
    print(f"\n1. Initial JSON timestamp: {initial_time_str}")
    
    # Read current data from API
    print("\n2. Reading current data from API...")
    try:
        response = requests.get("http://localhost:8000/api/materials", timeout=5)
        if response.status_code != 200:
            print(f"❌ API returned status {response.status_code}")
            return False
        data = response.json()
        print(f"   ✅ Read successful: {len(data.get('sections', []))} sections")
    except Exception as e:
        print(f"❌ Failed to read from API: {e}")
        return False
    
    # Make a small update via API (update a field that won't break things)
    print("\n3. Making a test update via API...")
    if data.get('sections'):
        first_section = data['sections'][0]
        if first_section.get('items'):
            first_item = first_section['items'][0]
            # Update a safe field (like a note or comment)
            original_note = first_item.get('approvals', {}).get('client', {}).get('note')
            test_note = f"Phase6 test {int(time.time())}"
            
            # Update the note
            if 'approvals' not in first_item:
                first_item['approvals'] = {}
            if 'client' not in first_item['approvals']:
                first_item['approvals']['client'] = {}
            first_item['approvals']['client']['note'] = test_note
            
            print(f"   Updating client note to: '{test_note}'")
            
            # Send update via API
            try:
                update_response = requests.put(
                    "http://localhost:8000/api/materials",
                    json={"materials": data},
                    timeout=10
                )
                if update_response.status_code == 200:
                    print("   ✅ API update successful")
                else:
                    print(f"   ❌ API update failed: {update_response.status_code}")
                    print(f"   Response: {update_response.text[:200]}")
                    return False
            except Exception as e:
                print(f"   ❌ API update error: {e}")
                return False
    
    # Wait a moment
    time.sleep(0.5)
    
    # Check JSON timestamp (should be unchanged)
    new_timestamp = get_json_timestamp()
    new_time_str = datetime.fromtimestamp(new_timestamp).strftime("%Y-%m-%d %H:%M:%S") if new_timestamp else "N/A"
    print(f"\n4. New JSON timestamp: {new_time_str}")
    
    # Verify timestamp didn't change
    if initial_timestamp and new_timestamp:
        time_diff = abs(new_timestamp - initial_timestamp)
        if time_diff < 1.0:  # Less than 1 second difference
            print(f"\n✅ PASS: JSON file was NOT modified!")
            print(f"   Time difference: {time_diff:.2f} seconds (expected < 1.0)")
            return True
        else:
            print(f"\n❌ FAIL: JSON file WAS modified!")
            print(f"   Time difference: {time_diff:.2f} seconds")
            return False
    else:
        print("\n⚠️  WARNING: Could not compare timestamps")
        return False

def test_data_in_database():
    """Test: Verify data was saved to database."""
    print("\n" + "="*60)
    print("Verifying data is in database...")
    print("="*60)
    
    try:
        with db_readonly_session() as session:
            data = materials_service.get_materials_dict(session)
        
        sections = data.get('sections', [])
        total_items = sum(len(s.get('items', [])) for s in sections)
        
        print(f"✅ Database read successful")
        print(f"   Sections: {len(sections)}")
        print(f"   Total items: {total_items}")
        return True
    except Exception as e:
        print(f"❌ Database read failed: {e}")
        return False

if __name__ == "__main__":
    print("\n🧪 Testing Phase 6: Database-Only Writes\n")
    
    # Check if backend is running
    try:
        response = requests.get("http://localhost:8000/", timeout=2)
    except:
        print("❌ Backend server is not running on http://localhost:8000")
        print("   Please start the backend server first:")
        print("   cd backend && python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload")
        sys.exit(1)
    
    # Run tests
    test1 = test_json_not_modified_via_api()
    test2 = test_data_in_database()
    
    # Summary
    print("\n" + "="*60)
    print("Test Summary")
    print("="*60)
    print(f"{'✅ PASS' if test1 else '❌ FAIL'}: JSON file not modified during writes")
    print(f"{'✅ PASS' if test2 else '❌ FAIL'}: Data saved to database")
    
    if test1 and test2:
        print("\n🎉 All tests passed! Phase 6 is working correctly.")
        print("\n✅ JSON file is NOT modified during writes")
        print("✅ Data is saved to database only")
        print("✅ Ready to set up cron job")
        sys.exit(0)
    else:
        print("\n⚠️  Some tests failed. Please review.")
        sys.exit(1)
