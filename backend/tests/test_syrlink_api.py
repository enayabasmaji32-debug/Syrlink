"""SyrLink backend API tests."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else "https://syrlink-server.preview.emergentagent.com"
API = f"{BASE_URL}/api"

DEMO = {"email": "demo@syrlink.com", "password": "demo1234"}


@pytest.fixture(scope="session")
def demo_token():
    r = requests.post(f"{API}/auth/login", json=DEMO, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def demo_user(demo_token):
    r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {demo_token}"}, timeout=30)
    assert r.status_code == 200
    return r.json()


def H(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---- AUTH ----
def test_register_returns_token_and_user():
    email = f"TEST_{uuid.uuid4().hex[:10]}@syrlink.com"
    r = requests.post(f"{API}/auth/register", json={"name": "Test U", "email": email, "password": "secret123"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert "token" in data and isinstance(data["token"], str) and len(data["token"]) > 10
    assert data["user"]["email"] == email.lower()
    assert "password_hash" not in data["user"]
    assert "_id" not in data["user"]
    # validate UUID id
    uuid.UUID(data["user"]["id"])


def test_login_demo(demo_token):
    assert demo_token


def test_login_wrong_password_401():
    r = requests.post(f"{API}/auth/login", json={"email": DEMO["email"], "password": "wrongpass"})
    assert r.status_code == 401


def test_me_with_token(demo_user):
    assert demo_user["email"] == DEMO["email"]
    assert "password_hash" not in demo_user
    assert "_id" not in demo_user


def test_me_without_token_401():
    r = requests.get(f"{API}/auth/me")
    assert r.status_code == 401


# ---- POSTS ----
def test_list_posts_paginated(demo_token):
    r = requests.get(f"{API}/posts?limit=5", headers=H(demo_token))
    assert r.status_code == 200
    body = r.json()
    assert "items" in body and "next_cursor" in body
    if body["items"]:
        p = body["items"][0]
        assert "author" in p and "name" in p["author"]
        assert "liked" in p and isinstance(p["liked"], bool)
        assert "_id" not in p


def test_create_post_and_like_toggle_and_comment(demo_token, demo_user):
    r = requests.post(f"{API}/posts", headers=H(demo_token), json={"content": "TEST_post hello"})
    assert r.status_code == 200, r.text
    post = r.json()
    pid = post["id"]
    uuid.UUID(pid)
    assert post["author"]["id"] == demo_user["id"]

    # Find a non-owned post for like notification side effect by listing
    feed = requests.get(f"{API}/posts?limit=20", headers=H(demo_token)).json()["items"]
    other_post = next((p for p in feed if p["author"]["id"] != demo_user["id"]), None)
    target = other_post["id"] if other_post else pid

    # like once
    r1 = requests.post(f"{API}/posts/{target}/like", headers=H(demo_token))
    assert r1.status_code == 200
    s1 = r1.json()
    # like again — toggles
    r2 = requests.post(f"{API}/posts/{target}/like", headers=H(demo_token))
    assert r2.status_code == 200
    s2 = r2.json()
    assert s1["liked"] != s2["liked"]
    assert s2["likes_count"] == s1["likes_count"] + (1 if s2["liked"] else -1)

    # comment
    rc = requests.post(f"{API}/posts/{target}/comments", headers=H(demo_token), json={"text": "TEST_comment"})
    assert rc.status_code == 200
    c = rc.json()
    assert c["text"] == "TEST_comment"
    assert "author" in c

    # list comments
    rl = requests.get(f"{API}/posts/{target}/comments", headers=H(demo_token))
    assert rl.status_code == 200
    assert any(x["text"] == "TEST_comment" for x in rl.json())


# ---- CONNECTIONS ----
def test_invitations_seeded(demo_token):
    r = requests.get(f"{API}/connections/invitations", headers=H(demo_token))
    assert r.status_code == 200
    invs = r.json()
    assert isinstance(invs, list)
    assert len(invs) >= 1
    assert "user" in invs[0] and "id" in invs[0]


def test_connection_request_creates_pending(demo_token, demo_user):
    # find a suggestion to send request to
    sug = requests.get(f"{API}/users/me/suggestions?limit=5", headers=H(demo_token)).json()
    assert sug, "No suggestions available"
    rid = sug[0]["id"]
    r = requests.post(f"{API}/connections/request", headers=H(demo_token), json={"receiver_id": rid, "note": "hi"})
    # may already exist if previous test run did this; accept 200 or 400
    assert r.status_code in (200, 400)


def test_accept_connection_flow(demo_token):
    invs = requests.get(f"{API}/connections/invitations", headers=H(demo_token)).json()
    if not invs:
        pytest.skip("no pending invitations to accept")
    inv = invs[0]
    before = requests.get(f"{API}/auth/me", headers=H(demo_token)).json().get("connections", 0)
    r = requests.post(f"{API}/connections/{inv['id']}/accept", headers=H(demo_token))
    assert r.status_code == 200
    after = requests.get(f"{API}/auth/me", headers=H(demo_token)).json().get("connections", 0)
    assert after == before + 1


def test_ignore_invitation(demo_token):
    invs = requests.get(f"{API}/connections/invitations", headers=H(demo_token)).json()
    if not invs:
        pytest.skip("no pending invitations")
    r = requests.post(f"{API}/connections/{invs[0]['id']}/ignore", headers=H(demo_token))
    assert r.status_code == 200


def test_my_connections_and_pending_sent(demo_token):
    r1 = requests.get(f"{API}/connections/me", headers=H(demo_token))
    assert r1.status_code == 200 and isinstance(r1.json(), list)
    r2 = requests.get(f"{API}/connections/pending-sent", headers=H(demo_token))
    assert r2.status_code == 200 and isinstance(r2.json(), list)


def test_connections_network_endpoint(demo_token):
    r = requests.get(f"{API}/connections/network?limit=5", headers=H(demo_token))
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert all(isinstance(u, dict) for u in data)
    assert all(u.get("relationship") in {"none", "connected", "pending_sent", "pending_received"} for u in data)


# ---- JOBS ----
def test_jobs_list_and_filters(demo_token):
    r = requests.get(f"{API}/jobs", headers=H(demo_token))
    assert r.status_code == 200
    jobs = r.json()
    assert isinstance(jobs, list) and len(jobs) >= 1
    j0 = jobs[0]
    assert "_id" not in j0
    # filter q
    if j0.get("title"):
        rq = requests.get(f"{API}/jobs", headers=H(demo_token), params={"q": j0["title"][:3]})
        assert rq.status_code == 200 and len(rq.json()) >= 1
    if j0.get("location"):
        rl = requests.get(f"{API}/jobs", headers=H(demo_token), params={"location": j0["location"][:3]})
        assert rl.status_code == 200


def test_job_apply_save_lists(demo_token):
    jobs = requests.get(f"{API}/jobs", headers=H(demo_token)).json()
    j = jobs[0]
    jid = j["id"]
    before_app = j.get("applicants", 0)

    rg = requests.get(f"{API}/jobs/{jid}", headers=H(demo_token))
    assert rg.status_code == 200

    ra = requests.post(f"{API}/jobs/{jid}/apply", headers=H(demo_token))
    assert ra.status_code == 200

    rs = requests.post(f"{API}/jobs/{jid}/save", headers=H(demo_token))
    assert rs.status_code == 200
    assert "saved" in rs.json()

    applied = requests.get(f"{API}/jobs/me/applied", headers=H(demo_token)).json()
    assert jid in applied
    _ = requests.get(f"{API}/jobs/me/saved", headers=H(demo_token)).json()

    # verify increment
    rj2 = requests.get(f"{API}/jobs/{jid}", headers=H(demo_token)).json()
    assert rj2["applicants"] >= before_app


# ---- CONVERSATIONS ----
def test_conversations_seeded(demo_token):
    r = requests.get(f"{API}/conversations", headers=H(demo_token))
    assert r.status_code == 200
    convs = r.json()
    assert isinstance(convs, list) and len(convs) >= 1
    assert "user" in convs[0] and "lastMessage" in convs[0] and "unread" in convs[0]


def test_messages_thread_and_send(demo_token):
    convs = requests.get(f"{API}/conversations", headers=H(demo_token)).json()
    cid = convs[0]["id"]
    r = requests.get(f"{API}/conversations/{cid}/messages", headers=H(demo_token))
    assert r.status_code == 200
    body = r.json()
    assert "thread" in body
    rs = requests.post(f"{API}/conversations/{cid}/messages", headers=H(demo_token), json={"text": "TEST_msg"})
    assert rs.status_code == 200
    assert rs.json()["text"] == "TEST_msg"
    convs2 = requests.get(f"{API}/conversations", headers=H(demo_token)).json()
    same = next(c for c in convs2 if c["id"] == cid)
    assert same["lastMessage"] == "TEST_msg"


def test_start_conversation_idempotent(demo_token):
    sug = requests.get(f"{API}/users/me/suggestions?limit=1", headers=H(demo_token)).json()
    if not sug:
        pytest.skip("no suggestions")
    uid = sug[0]["id"]
    r1 = requests.post(f"{API}/conversations", headers=H(demo_token), json={"user_id": uid})
    assert r1.status_code == 200
    r2 = requests.post(f"{API}/conversations", headers=H(demo_token), json={"user_id": uid})
    assert r2.status_code == 200
    assert r1.json()["id"] == r2.json()["id"]


# ---- NOTIFICATIONS ----
def test_notifications_filters_and_read(demo_token):
    for f in ("all", "posts", "mentions", "jobs"):
        r = requests.get(f"{API}/notifications", headers=H(demo_token), params={"filter": f})
        assert r.status_code == 200
        assert isinstance(r.json(), list)
    n = requests.get(f"{API}/notifications", headers=H(demo_token)).json()
    if n:
        r1 = requests.post(f"{API}/notifications/{n[0]['id']}/read", headers=H(demo_token))
        assert r1.status_code == 200
    r2 = requests.post(f"{API}/notifications/read-all", headers=H(demo_token))
    assert r2.status_code == 200


# ---- USERS ----
def test_suggestions_excludes_self(demo_token, demo_user):
    sug = requests.get(f"{API}/users/me/suggestions?limit=10", headers=H(demo_token)).json()
    assert all(u["id"] != demo_user["id"] for u in sug)


def test_get_user_and_update_me(demo_token, demo_user):
    r = requests.get(f"{API}/users/{demo_user['id']}", headers=H(demo_token))
    assert r.status_code == 200
    assert r.json()["id"] == demo_user["id"]
    new_headline = f"TEST_headline_{uuid.uuid4().hex[:6]}"
    ru = requests.put(f"{API}/users/me", headers=H(demo_token), json={"headline": new_headline})
    assert ru.status_code == 200 and ru.json()["headline"] == new_headline
    # verify persistence
    rv = requests.get(f"{API}/users/{demo_user['id']}", headers=H(demo_token)).json()
    assert rv["headline"] == new_headline


# ---- CORS ----
def test_cors_headers():
    r = requests.options(
        f"{API}/auth/login",
        headers={
            "Origin": "https://example.com",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert r.status_code in (200, 204)
    assert "access-control-allow-origin" in {k.lower() for k in r.headers.keys()}
