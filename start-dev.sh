#!/bin/bash
set -e

echo "=========================================================="
echo "Starting Enterprise AI Resume Screening Platform Backend"
echo "=========================================================="

# 1. Non-interactively install pip and venv if missing
if ! command -v pip3 &> /dev/null; then
    echo "Python pip is missing. Installing python3-pip and python3-venv non-interactively..."
    # Clean up stale locks if any from previous attempts
    killall apt-get || true
    rm -f /var/lib/dpkg/lock-frontend
    rm -f /var/lib/dpkg/lock
    rm -f /var/lib/apt/lists/lock
    
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -y
    apt-get install -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" python3-pip python3-venv
else
    echo "Python pip and venv are already available."
fi

# 2. Setup python virtual environment
if [ ! -d "venv" ]; then
    echo "Creating python virtual environment..."
    python3 -m venv venv
else
    echo "Virtual environment already exists."
fi

# 3. Activate virtual environment and install packages
echo "Activating virtual environment..."
source venv/bin/activate

echo "Upgrading pip..."
pip install --upgrade pip

echo "Installing backend requirements from requirements.txt..."
pip install -r requirements.txt

# 4. Launch FastAPI server
echo "Starting FastAPI uvicorn server on port 3000..."
export PYTHONPATH=backend
uvicorn app.main:app --host 0.0.0.0 --port 3000
