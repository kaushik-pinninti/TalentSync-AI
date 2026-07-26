import pytest

def test_health_check(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert "project" in data

def test_unauthorized_get_jobs_blocks(client):
    # Try listing jobs without headers/token
    res = client.get("/api/jobs")
    assert res.status_code == 401
    assert "not authenticated" in res.json()["detail"].lower()

def test_jobs_crud_lifecycle(client, auth_headers):
    # 1. List jobs (should be empty initially)
    res_list_empty = client.get("/api/jobs", headers=auth_headers)
    assert res_list_empty.status_code == 200
    assert len(res_list_empty.json()) == 0

    # 2. Create a job
    job_payload = {
        "title": "Machine Learning Engineer",
        "description": "Develop LLM pipelines and training jobs",
        "experience": "3+ years",
        "skills": ["Python", "PyTorch", "Transformers", "FastAPI"],
        "education": "Master's or PhD",
        "salary": "$150,000 - $180,000",
        "location": "Remote",
        "employment_type": "Full-time",
        "status": "active"
    }
    res_create = client.post("/api/jobs", json=job_payload, headers=auth_headers)
    assert res_create.status_code == 201
    created_job = res_create.json()
    assert created_job["title"] == "Machine Learning Engineer"
    assert "id" in created_job
    job_id = created_job["id"]

    # 3. List jobs again (should have 1 job now)
    res_list_one = client.get("/api/jobs", headers=auth_headers)
    assert res_list_one.status_code == 200
    assert len(res_list_one.json()) == 1
    assert res_list_one.json()[0]["id"] == job_id

    # 4. Get specific job details
    res_get = client.get(f"/api/jobs/{job_id}", headers=auth_headers)
    assert res_get.status_code == 200
    assert res_get.json()["title"] == "Machine Learning Engineer"

    # 5. Get non-existent job (should be 404)
    res_get_missing = client.get("/api/jobs/9999", headers=auth_headers)
    assert res_get_missing.status_code == 404

    # 6. Update the job
    update_payload = {
        "title": "Senior ML Engineer",
        "salary": "$170,000 - $200,000"
    }
    res_update = client.put(f"/api/jobs/{job_id}", json=update_payload, headers=auth_headers)
    assert res_update.status_code == 200
    assert res_update.json()["title"] == "Senior ML Engineer"
    assert res_update.json()["salary"] == "$170,000 - $200,000"

    # 7. Delete the job
    res_delete = client.delete(f"/api/jobs/{job_id}", headers=auth_headers)
    assert res_delete.status_code == 200

    # 8. Get deleted job details (should be 404)
    res_get_deleted = client.get(f"/api/jobs/{job_id}", headers=auth_headers)
    assert res_get_deleted.status_code == 404
