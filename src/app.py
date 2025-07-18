"""
High School Management System API

A super simple FastAPI application that allows students to view and sign up
for extracurricular activities at Mergington High School.
"""

from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import os
import json
import hashlib
from pathlib import Path
from typing import Optional

app = FastAPI(title="Mergington High School API",
              description="API for viewing and signing up for extracurricular activities")

# Security
security = HTTPBearer(auto_error=False)

# In-memory session store (for demo purposes)
active_sessions = {}

# Load teacher credentials
def load_teachers():
    try:
        with open(os.path.join(Path(__file__).parent, "teachers.json"), "r") as f:
            return json.load(f)
    except FileNotFoundError:
        return {"teachers": {}}

teachers_db = load_teachers()

# Mount the static files directory
current_dir = Path(__file__).parent
app.mount("/static", StaticFiles(directory=os.path.join(Path(__file__).parent,
          "static")), name="static")

# In-memory activity database
activities = {
    "Chess Club": {
        "description": "Learn strategies and compete in chess tournaments",
        "schedule": "Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 12,
        "participants": ["michael@mergington.edu", "daniel@mergington.edu"]
    },
    "Programming Class": {
        "description": "Learn programming fundamentals and build software projects",
        "schedule": "Tuesdays and Thursdays, 3:30 PM - 4:30 PM",
        "max_participants": 20,
        "participants": ["emma@mergington.edu", "sophia@mergington.edu"]
    },
    "Gym Class": {
        "description": "Physical education and sports activities",
        "schedule": "Mondays, Wednesdays, Fridays, 2:00 PM - 3:00 PM",
        "max_participants": 30,
        "participants": ["john@mergington.edu", "olivia@mergington.edu"]
    },
    "Soccer Team": {
        "description": "Join the school soccer team and compete in matches",
        "schedule": "Tuesdays and Thursdays, 4:00 PM - 5:30 PM",
        "max_participants": 22,
        "participants": ["liam@mergington.edu", "noah@mergington.edu"]
    },
    "Basketball Team": {
        "description": "Practice and play basketball with the school team",
        "schedule": "Wednesdays and Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["ava@mergington.edu", "mia@mergington.edu"]
    },
    "Art Club": {
        "description": "Explore your creativity through painting and drawing",
        "schedule": "Thursdays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["amelia@mergington.edu", "harper@mergington.edu"]
    },
    "Drama Club": {
        "description": "Act, direct, and produce plays and performances",
        "schedule": "Mondays and Wednesdays, 4:00 PM - 5:30 PM",
        "max_participants": 20,
        "participants": ["ella@mergington.edu", "scarlett@mergington.edu"]
    },
    "Math Club": {
        "description": "Solve challenging problems and participate in math competitions",
        "schedule": "Tuesdays, 3:30 PM - 4:30 PM",
        "max_participants": 10,
        "participants": ["james@mergington.edu", "benjamin@mergington.edu"]
    },
    "Debate Team": {
        "description": "Develop public speaking and argumentation skills",
        "schedule": "Fridays, 4:00 PM - 5:30 PM",
        "max_participants": 12,
        "participants": ["charlotte@mergington.edu", "henry@mergington.edu"]
    }
}


# Authentication helper functions
def create_session_token(username: str) -> str:
    """Create a simple session token"""
    import time
    import random
    token = hashlib.sha256(f"{username}:{time.time()}:{random.random()}".encode()).hexdigest()
    active_sessions[token] = {"username": username, "created_at": time.time()}
    return token

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Optional[str]:
    """Get current authenticated user from session token"""
    if not credentials:
        return None
    
    token = credentials.credentials
    if token in active_sessions:
        return active_sessions[token]["username"]
    return None

def require_teacher_auth(current_user: str = Depends(get_current_user)) -> str:
    """Require teacher authentication"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return current_user


# API Endpoints
@app.post("/auth/login")
def login(request: dict):
    """Login endpoint for teachers"""
    username = request.get("username")
    password = request.get("password")
    
    if not username or not password:
        raise HTTPException(status_code=400, detail="Username and password required")
    
    # Check credentials
    if username in teachers_db["teachers"]:
        if teachers_db["teachers"][username]["password"] == password:
            token = create_session_token(username)
            return {
                "message": "Login successful",
                "token": token,
                "user": {
                    "username": username,
                    "name": teachers_db["teachers"][username]["name"]
                }
            }
    
    raise HTTPException(status_code=401, detail="Invalid credentials")

@app.post("/auth/logout")
def logout(current_user: str = Depends(get_current_user)):
    """Logout endpoint"""
    if current_user:
        # Remove all sessions for this user
        tokens_to_remove = [token for token, data in active_sessions.items() 
                           if data["username"] == current_user]
        for token in tokens_to_remove:
            del active_sessions[token]
    
    return {"message": "Logged out successfully"}

@app.get("/auth/me")
def get_current_user_info(current_user: str = Depends(get_current_user)):
    """Get current user info"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    return {
        "username": current_user,
        "name": teachers_db["teachers"][current_user]["name"]
    }


@app.get("/")
def root():
    return RedirectResponse(url="/static/index.html")


@app.get("/activities")
def get_activities():
    return activities


@app.post("/activities/{activity_name}/signup")
def signup_for_activity(activity_name: str, email: str, current_user: str = Depends(require_teacher_auth)):
    """Sign up a student for an activity (teacher only)"""
    # Validate activity exists
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Get the specific activity
    activity = activities[activity_name]

    # Validate student is not already signed up
    if email in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is already signed up"
        )

    # Add student
    activity["participants"].append(email)
    return {"message": f"Signed up {email} for {activity_name}"}


@app.delete("/activities/{activity_name}/unregister")
def unregister_from_activity(activity_name: str, email: str, current_user: str = Depends(require_teacher_auth)):
    """Unregister a student from an activity (teacher only)"""
    # Validate activity exists
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Get the specific activity
    activity = activities[activity_name]

    # Validate student is signed up
    if email not in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is not signed up for this activity"
        )

    # Remove student
    activity["participants"].remove(email)
    return {"message": f"Unregistered {email} from {activity_name}"}
