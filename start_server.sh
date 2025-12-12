#!/bin/bash
echo "Starting Glioma AI Workstation..."
echo

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 is not installed or not in PATH"
    echo "Please install Python 3.8 or higher"
    exit 1
fi

# Check if MongoDB is running
echo "Checking MongoDB connection..."
sleep 2

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "WARNING: .env file not found!"
    echo "Please copy .env.example to .env and configure email settings"
    echo
    read -p "Press enter to continue..."
fi

# Change to backend directory and start server
cd backend
echo
echo "Starting FastAPI server..."
echo "Open your browser and go to: http://localhost:8000"
echo
echo "Press Ctrl+C to stop the server"
echo

uvicorn main:app --reload --host 0.0.0.0 --port 8000