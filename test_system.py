#!/usr/bin/env python3
"""
Test script for Glioma AI Workstation
This script tests the basic functionality of the system
"""

import asyncio
import aiohttp
import json
import os
import sys
from pathlib import Path

# Configuration
BASE_URL = "http://localhost:8000"
TEST_PATIENT_DATA = {
    "patient_id": "TEST_001",
    "name": "Test Patient",
    "age": 45,
    "sex": "M",
    "email": "test@example.com",
    "phone": "+1234567890",
    "medical_record_number": "MRN001",
    "attending_physician": "Dr. Test"
}

async def test_server_health():
    """Test if the server is running"""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{BASE_URL}/health") as response:
                if response.status == 200:
                    data = await response.json()
                    print("✓ Server is healthy")
                    return True
                else:
                    print(f"✗ Server health check failed: {response.status}")
                    return False
    except Exception as e:
        print(f"✗ Cannot connect to server: {e}")
        return False

async def test_patient_registration():
    """Test patient registration"""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{BASE_URL}/patients/register",
                json=TEST_PATIENT_DATA,
                headers={"Content-Type": "application/json"}
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    print("✓ Patient registration successful")
                    return True
                else:
                    error_data = await response.json()
                    if "already exists" in error_data.get("detail", ""):
                        print("✓ Patient already exists (expected)")
                        return True
                    print(f"✗ Patient registration failed: {response.status}")
                    return False
    except Exception as e:
        print(f"✗ Patient registration error: {e}")
        return False

async def test_patient_search():
    """Test patient search functionality"""
    try:
        async with aiohttp.ClientSession() as session:
            search_data = {
                "query": "Test Patient",
                "search_type": "name"
            }
            async with session.post(
                f"{BASE_URL}/patients/search",
                json=search_data,
                headers={"Content-Type": "application/json"}
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    if len(data["patients"]) > 0:
                        print("✓ Patient search working")
                        return True
                    else:
                        print("✗ No patients found in search")
                        return False
                else:
                    print(f"✗ Patient search failed: {response.status}")
                    return False
    except Exception as e:
        print(f"✗ Patient search error: {e}")
        return False

async def test_patient_list():
    """Test patient listing"""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{BASE_URL}/patients") as response:
                if response.status == 200:
                    data = await response.json()
                    print(f"✓ Patient list working ({data['total']} patients)")
                    return True
                else:
                    print(f"✗ Patient list failed: {response.status}")
                    return False
    except Exception as e:
        print(f"✗ Patient list error: {e}")
        return False

async def test_frontend():
    """Test if frontend is accessible"""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(BASE_URL) as response:
                if response.status == 200:
                    print("✓ Frontend accessible")
                    return True
                else:
                    print(f"✗ Frontend not accessible: {response.status}")
                    return False
    except Exception as e:
        print(f"✗ Frontend error: {e}")
        return False

def check_file_structure():
    """Check if required files exist"""
    required_files = [
        "backend/main.py",
        "backend/segmentation.py", 
        "backend/best_model_inference.pth",
        "backend/index.html",
        "backend/static/js/script.js",
        "backend/static/css/style.css",
        "requirements.txt"
    ]
    
    missing_files = []
    for file_path in required_files:
        if not os.path.exists(file_path):
            missing_files.append(file_path)
    
    if missing_files:
        print("✗ Missing required files:")
        for file in missing_files:
            print(f"  - {file}")
        return False
    else:
        print("✓ All required files present")
        return True

def check_directories():
    """Check if required directories exist"""
    required_dirs = [
        "backend/uploads",
        "backend/static/outputs",
        "backend/static/reports",
        "backend/templates"
    ]
    
    for dir_path in required_dirs:
        if not os.path.exists(dir_path):
            print(f"Creating directory: {dir_path}")
            os.makedirs(dir_path, exist_ok=True)
    
    print("✓ All required directories present")
    return True

async def main():
    """Main test function"""
    print("🧠 Glioma AI Workstation Test Suite")
    print("=" * 40)
    
    # Check file structure
    print("\n📁 Checking file structure...")
    if not check_file_structure():
        print("\n❌ File structure check failed. Please ensure all files are present.")
        return False
    
    # Check directories
    print("\n📂 Checking directories...")
    check_directories()
    
    # Test server connection
    print("\n🌐 Testing server connection...")
    if not await test_server_health():
        print("\n❌ Server is not running or not responding.")
        print("Please start the server with: uvicorn main:app --reload")
        return False
    
    # Test frontend
    print("\n🖥️  Testing frontend...")
    await test_frontend()
    
    # Test patient registration
    print("\n👤 Testing patient registration...")
    await test_patient_registration()
    
    # Test patient search
    print("\n🔍 Testing patient search...")
    await test_patient_search()
    
    # Test patient list
    print("\n📋 Testing patient list...")
    await test_patient_list()
    
    print("\n" + "=" * 40)
    print("✅ Basic tests completed!")
    print("\n📖 Next steps:")
    print("1. Open http://localhost:8000 in your browser")
    print("2. Register a new patient")
    print("3. Upload MRI files (4 modalities or ZIP)")
    print("4. Run segmentation")
    print("5. View results and test export features")
    
    return True

if __name__ == "__main__":
    # Change to project directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
    except Exception as e:
        print(f"\n\nTest failed with error: {e}")
        sys.exit(1)