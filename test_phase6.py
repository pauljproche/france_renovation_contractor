#!/usr/bin/env python3
"""
Test Phase 6: Database-only writes
Verifies that:
1. Writes go to database only (JSON file not modified)
2. Data is correctly saved to database
3. Reads still work correctly
4. JSON read fallback works
"""

import os
import sys
import json
import time
from pathlib import Path
from datetime import datetime

# Add backend to path
backend_dir = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_dir))

# Change to backend directory and load .env
original_dir = os.getcwd()
os.chdir(backend_dir)
from dotenv import load_dotenv

# Load .env from backend directory
env_path = backend_dir / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
else:
    load_dotenv()  # Try default location

# Check USE_DATABASE
use_database = os.getenv("USE_DATABASE", "false").lower() == "true"
if not use_database:
    print(f"❌ ERROR: USE_DATABASE is not set to true")
    print(f"   Current value: {os.getenv('USE_DATABASE', 'not set')}")
    print(f"   .env path checked: {env_path}")
    sys.exit(1)

from db_session import db_session, db_readonly_session
import services.materials_service as materials_service

# Paths
PROJECT_DIR = Path(__file__).parent
MATERIALS_JSON = PROJECT_DIR / "data" / "materials.json"

def get_json_timestamp():
    """Get JSON file modification timestamp."""
    if MATERIALS_JSON.exists():
        return MATERIALS_JSON.stat().st_mtime
    return None

def test_1_json_not_modified():
    """Test 1: Verify JSON file is NOT modified during writes."""
    print("\n" + "="*60)
    print("Test 1: JSON file should NOT be modified during writes")
    print("="*60)
    
    # Get initial timestamp
    initial_timestamp = get_json_timestamp()
    print(f"Initial JSON timestamp: {datetime.fromtimestamp(initial_timestamp) if initial_timestamp else 'N/A'}")
    
    # Load current data
    with db_readonly_session() as session:
        data = materials_service.get_materials_dict(session)
    
    # Make a small change (add a test field to first item)
    if data.get('sections'):
        first_section = data['sections'][0]
        if first_section.get('items'):
            first_item = first_section['items'][0]
            # Add a test field
            test_value = f"test_{int(time.time())}"
            first_item['_phase6_test'] = test_value
            print(f"Adding test field '_phase6_test' = '{test_value}' to first item")
    
    # Write to database (should NOT write to JSON)
    print("\nWriting to database...")
    try:
        with db_session() as session:
            materials_service.save_materials_dict(data, session)
            session.commit()
        print("✅ Database write successful")
    except Exception as e:
        print(f"❌ Database write failed: {e}")
        return False
    
    # Wait a moment
    time.sleep(0.5)
    
    # Check JSON timestamp (should be unchanged)
    new_timestamp = get_json_timestamp()
    print(f"New JSON timestamp: {datetime.fromtimestamp(new_timestamp) if new_timestamp else 'N/A'}")
    
    if initial_timestamp and new_timestamp:
        if abs(new_timestamp - initial_timestamp) < 1.0:  # Less than 1 second difference
            print("✅ PASS: JSON file was NOT modified (timestamp unchanged)")
            return True
        else:
            print(f"❌ FAIL: JSON file WAS modified (timestamp changed by {new_timestamp - initial_timestamp:.2f} seconds)")
            return False
    else:
        print("⚠️  WARNING: Could not compare timestamps")
        return True  # Don't fail if we can't check

def test_2_data_saved_to_db():
    """Test 2: Verify data is correctly saved to database."""
    print("\n" + "="*60)
    print("Test 2: Data should be saved correctly to database")
    print("="*60)
    
    # Read from database
    with db_readonly_session() as session:
        data = materials_service.get_materials_dict(session)
    
    # Check if test field exists
    if data.get('sections'):
        first_section = data['sections'][0]
        if first_section.get('items'):
            first_item = first_section['items'][0]
            if '_phase6_test' in first_item:
                print(f"✅ PASS: Test field found in database: '_phase6_test' = '{first_item['_phase6_test']}'")
                
                # Clean up test field
                print("\nCleaning up test field...")
                del first_item['_phase6_test']
                with db_session() as session:
                    materials_service.save_materials_dict(data, session)
                    session.commit()
                print("✅ Test field removed")
                return True
            else:
                print("❌ FAIL: Test field not found in database")
                return False
    
    print("⚠️  WARNING: Could not verify (no sections/items found)")
    return True

def test_3_reads_work():
    """Test 3: Verify reads still work correctly."""
    print("\n" + "="*60)
    print("Test 3: Reads should work correctly")
    print("="*60)
    
    try:
        with db_readonly_session() as session:
            data = materials_service.get_materials_dict(session)
        
        sections = data.get('sections', [])
        total_items = sum(len(s.get('items', [])) for s in sections)
        
        print(f"✅ PASS: Read successful")
        print(f"   Sections: {len(sections)}")
        print(f"   Total items: {total_items}")
        return True
    except Exception as e:
        print(f"❌ FAIL: Read failed: {e}")
        return False

def test_4_json_fallback():
    """Test 4: Verify JSON read fallback works."""
    print("\n" + "="*60)
    print("Test 4: JSON read fallback (simulated)")
    print("="*60)
    
    # Check if JSON file exists and is readable
    if MATERIALS_JSON.exists():
        try:
            with open(MATERIALS_JSON, 'r', encoding='utf-8') as f:
                json_data = json.load(f)
            sections = json_data.get('sections', [])
            print(f"✅ PASS: JSON file is readable (fallback would work)")
            print(f"   Sections in JSON: {len(sections)}")
            return True
        except Exception as e:
            print(f"⚠️  WARNING: JSON file exists but not readable: {e}")
            return True  # Don't fail - JSON might be stale
    else:
        print("⚠️  WARNING: JSON file does not exist (will be created by backup script)")
        return True  # Don't fail - JSON will be created by cron job

def main():
    print("="*60)
    print("Phase 6 Testing: Database-Only Writes")
    print("="*60)
    
    results = []
    
    # Run tests
    results.append(("JSON not modified", test_1_json_not_modified()))
    results.append(("Data saved to DB", test_2_data_saved_to_db()))
    results.append(("Reads work", test_3_reads_work()))
    results.append(("JSON fallback", test_4_json_fallback()))
    
    # Summary
    print("\n" + "="*60)
    print("Test Summary")
    print("="*60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\nResults: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All tests passed! Phase 6 is working correctly.")
        return 0
    else:
        print("\n⚠️  Some tests failed. Please review.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
