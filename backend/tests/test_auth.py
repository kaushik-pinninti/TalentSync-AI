import pytest

def test_user_registration(client):
    # Test valid registration
    res = client.post("/api/auth/register", json={
        "email": "new_recruiter@enterprise.com",
        "password": "StrongPassword123!",
        "full_name": "New Recruiter",
        "company_name": "Talent Sync Inc"
    })
    assert res.status_code == 201
    data = res.json()
    assert data["email"] == "new_recruiter@enterprise.com"
    assert "id" in data
    assert data["full_name"] == "New Recruiter"

    # Test registering a duplicate email (should fail with 400)
    res_duplicate = client.post("/api/auth/register", json={
        "email": "new_recruiter@enterprise.com",
        "password": "AnotherPassword1!",
        "full_name": "Another Recruiter"
    })
    assert res_duplicate.status_code == 400
    assert "already registered" in res_duplicate.json()["detail"].lower()

def test_user_login(client):
    # Setup - Register a user first
    client.post("/api/auth/register", json={
        "email": "auth_tester@enterprise.com",
        "password": "Password99!",
        "full_name": "Auth Tester"
    })

    # Test successful login
    res_success = client.post("/api/auth/login", json={
        "email": "auth_tester@enterprise.com",
        "password": "Password99!"
    })
    assert res_success.status_code == 200
    data = res_success.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"

    # Test login failure - invalid password
    res_fail_pwd = client.post("/api/auth/login", json={
        "email": "auth_tester@enterprise.com",
        "password": "WrongPassword!"
    })
    assert res_fail_pwd.status_code == 401
    assert "incorrect email or password" in res_fail_pwd.json()["detail"].lower()

    # Test login failure - non-existent user
    res_fail_user = client.post("/api/auth/login", json={
        "email": "doesnotexist@enterprise.com",
        "password": "Password99!"
    })
    assert res_fail_user.status_code == 401

def test_token_refresh(client):
    # Setup - Register and Login to get a refresh token
    client.post("/api/auth/register", json={
        "email": "refresh_tester@enterprise.com",
        "password": "Password123!",
        "full_name": "Refresh Tester"
    })
    login_res = client.post("/api/auth/login", json={
        "email": "refresh_tester@enterprise.com",
        "password": "Password123!"
    })
    tokens = login_res.json()
    refresh_token = tokens["refresh_token"]

    # Refresh access token
    res_refresh = client.post("/api/auth/refresh", json={
        "access_token": "",
        "refresh_token": refresh_token,
        "token_type": "bearer"
    })
    assert res_refresh.status_code == 200
    data = res_refresh.json()
    assert "access_token" in data
    assert "refresh_token" in data

    # Refresh with invalid token
    res_invalid_refresh = client.post("/api/auth/refresh", json={
        "access_token": "",
        "refresh_token": "invalid_refresh_token_string",
        "token_type": "bearer"
    })
    assert res_invalid_refresh.status_code == 401
