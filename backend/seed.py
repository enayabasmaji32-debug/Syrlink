"""SyrLink — Seed script. Populates the DB with realistic Syrian-flavoured data.

Run automatically on first server startup, or manually:  python seed.py
"""
import asyncio
import os
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path

import bcrypt
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv(Path(__file__).parent / ".env")


def uid() -> str:
    return str(uuid.uuid4())


def hash_pwd(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


SYRIAN_USERS = [
    {"name": "Ahmad Al-Halabi", "headline": "Senior Software Engineer | React & Node.js | Damascus", "location": "Damascus, Syria", "avatar": "https://images.unsplash.com/photo-1560250097-0b93528c311a", "cover": "https://images.unsplash.com/photo-1497215728101-856f4ea42174", "verified": True, "skills": ["React", "Node.js", "TypeScript", "AWS", "MongoDB"], "languages": ["Arabic (Native)", "English (Fluent)", "French (Conversational)"]},
    {"name": "Layla Al-Damashqi", "headline": "Product Manager @ SyrTech | Ex-Google", "location": "Aleppo, Syria", "avatar": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2", "cover": "https://images.unsplash.com/photo-1497366811353-6870744d04b2", "verified": True, "skills": ["Product Strategy", "Roadmapping", "Analytics", "Agile"], "languages": ["Arabic (Native)", "English (Fluent)"]},
    {"name": "Omar Al-Shami", "headline": "Staff Engineer @ Levant Pay · Distributed Systems", "location": "Damascus, Syria", "avatar": "https://images.unsplash.com/photo-1629425733761-caae3b5f2e50", "cover": "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab", "verified": False, "skills": ["Go", "Kubernetes", "Postgres", "Distributed Systems"], "languages": ["Arabic (Native)", "English (Fluent)"]},
    {"name": "Rama Khaddour", "headline": "UX Designer | Crafting human-centered experiences", "location": "Latakia, Syria", "avatar": "https://images.pexels.com/photos/37148308/pexels-photo-37148308.jpeg", "cover": "https://images.unsplash.com/photo-1497366754035-f200968a6e72", "verified": False, "skills": ["Figma", "Prototyping", "Design Systems", "User Research"], "languages": ["Arabic (Native)", "English (Fluent)"]},
    {"name": "Marwan Al-Hourani", "headline": "Engineering Manager · Hiring across the team", "location": "Damascus, Syria", "avatar": "https://images.unsplash.com/photo-1627161683077-e34782c24d81", "cover": "https://images.unsplash.com/photo-1522071820081-009f0129c71c", "verified": True, "skills": ["Leadership", "Hiring", "System Design", "Mentoring"], "languages": ["Arabic (Native)", "English (Fluent)"]},
    {"name": "Nour Al-Aleppi", "headline": "Data Scientist @ Cham Analytics | ML, A/B testing", "location": "Aleppo, Syria", "avatar": "https://images.pexels.com/photos/29852895/pexels-photo-29852895.jpeg", "cover": "https://images.unsplash.com/photo-1497215728101-856f4ea42174", "verified": False, "skills": ["Python", "ML", "SQL", "Statistics"], "languages": ["Arabic (Native)", "English (Fluent)"]},
    {"name": "Bassel Khoury", "headline": "Founder & CEO at LevantLabs | YC W24", "location": "Damascus, Syria", "avatar": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e", "cover": "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab", "verified": True, "skills": ["Fundraising", "Product", "Strategy"], "languages": ["Arabic (Native)", "English (Fluent)"]},
    {"name": "Yasmin Al-Sayed", "headline": "Marketing Lead · Storyteller · Growth Hacker", "location": "Homs, Syria", "avatar": "https://images.unsplash.com/photo-1580489944761-15a19d654956", "cover": "https://images.unsplash.com/photo-1497366754035-f200968a6e72", "verified": False, "skills": ["Content", "SEO", "Growth", "Branding"], "languages": ["Arabic (Native)", "English (Fluent)"]},
    {"name": "Hadi Al-Najjar", "headline": "Cybersecurity Specialist | CISSP | OSCP", "location": "Damascus, Syria", "avatar": "https://images.unsplash.com/photo-1506863530036-1efeddceb993", "cover": "https://images.unsplash.com/photo-1497366811353-6870744d04b2", "verified": False, "skills": ["Pentesting", "Cloud Security", "Incident Response"], "languages": ["Arabic (Native)", "English (Fluent)"]},
    {"name": "Salma Al-Idlibi", "headline": "iOS Developer | Swift, SwiftUI enthusiast", "location": "Idlib, Syria", "avatar": "https://images.pexels.com/photos/28442317/pexels-photo-28442317.jpeg", "cover": "https://images.unsplash.com/photo-1522071820081-009f0129c71c", "verified": False, "skills": ["Swift", "SwiftUI", "iOS", "Combine"], "languages": ["Arabic (Native)", "English (Fluent)"]},
    {"name": "Karim Al-Tartousi", "headline": "Talent Acquisition · Tech Recruiting · Hiring!", "location": "Tartous, Syria", "avatar": "https://images.pexels.com/photos/28513051/pexels-photo-28513051.jpeg", "cover": "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab", "verified": False, "skills": ["Recruiting", "Sourcing", "Employer Branding"], "languages": ["Arabic (Native)", "English (Fluent)"]},
]


JOBS = [
    {"title": "Senior Frontend Engineer", "company": "Cham Wings Digital", "logo": "https://logo.clearbit.com/chamwings.com", "location": "Damascus, Syria (Hybrid)", "salary": "$2,500 - $4,000 /mo", "type": "Full-time", "easy_apply": True, "promoted": True, "description": "Build delightful travel-tech experiences for the Levant region. Stack: React, TypeScript, Next.js.", "skills": ["React", "TypeScript", "Next.js", "CSS"]},
    {"title": "Backend Engineer, Platform", "company": "Levant Pay", "logo": "https://logo.clearbit.com/stripe.com", "location": "Remote", "salary": "$3,000 - $5,000 /mo", "type": "Full-time", "easy_apply": True, "promoted": False, "description": "Build the payments rails for a new generation of Syrian fintech. Go + Postgres + Kubernetes.", "skills": ["Go", "Postgres", "Kubernetes", "System Design"]},
    {"title": "Product Designer", "company": "SyrTech", "logo": "https://logo.clearbit.com/figma.com", "location": "Aleppo, Syria", "salary": "$1,800 - $3,000 /mo", "type": "Full-time", "easy_apply": False, "promoted": True, "description": "Shape the future of B2B SaaS in the MENA region. Strong systems thinker required.", "skills": ["Figma", "Prototyping", "Design Systems"]},
    {"title": "Engineering Manager", "company": "LevantLabs", "logo": "https://logo.clearbit.com/notion.so", "location": "Damascus, Syria", "salary": "$4,000 - $6,500 /mo", "type": "Full-time", "easy_apply": True, "promoted": False, "description": "Lead a team of 6 engineers building AI-powered productivity tools for Arabic-speaking professionals.", "skills": ["Leadership", "React", "Mentoring", "Hiring"]},
    {"title": "DevOps / SRE", "company": "Damascus Cloud", "logo": "https://logo.clearbit.com/vercel.com", "location": "Remote", "salary": "$2,800 - $4,500 /mo", "type": "Full-time", "easy_apply": True, "promoted": False, "description": "Run the infrastructure powering the largest Syrian-built SaaS. K8s, Terraform, the works.", "skills": ["Kubernetes", "Terraform", "AWS", "Linux"]},
    {"title": "Data Scientist", "company": "Cham Analytics", "logo": "https://logo.clearbit.com/openai.com", "location": "Damascus, Syria", "salary": "$2,500 - $4,500 /mo", "type": "Full-time", "easy_apply": False, "promoted": True, "description": "Build the data foundations powering retail analytics across the MENA region.", "skills": ["Python", "ML", "SQL", "Statistics"]},
    {"title": "iOS Engineer", "company": "Aleppo Apps", "logo": "https://logo.clearbit.com/apple.com", "location": "Aleppo, Syria", "salary": "$2,000 - $3,500 /mo", "type": "Full-time", "easy_apply": False, "promoted": False, "description": "Ship beautiful Arabic-first iOS apps to millions of users across the region.", "skills": ["Swift", "SwiftUI", "iOS"]},
    {"title": "Developer Advocate", "company": "Homs Hub", "logo": "https://logo.clearbit.com/github.com", "location": "Remote", "salary": "$2,200 - $3,800 /mo", "type": "Full-time", "easy_apply": True, "promoted": False, "description": "Be the voice of the Syrian developer community. Write, speak, code, repeat.", "skills": ["Writing", "Public Speaking", "Open Source"]},
]


POSTS_CONTENT = [
    ("Just shipped real-time collaboration on our platform — 6 months of intense work with an amazing team in Damascus and Aleppo. Proud of what we built! 🚀\n\nLessons:\n• Ship small, iterate fast\n• Talk to users weekly\n• Engineering excellence compounds", "https://images.unsplash.com/photo-1517048676732-d65bc937f952", 0),
    ("We're hiring! 🚀 LevantLabs is opening 12 new roles across engineering, design, and growth. Fully remote (Syria-friendly), competitive equity, real ownership.\n\nIf you want to build the future of Arabic-first AI tools, DM me. Referrals welcomed.", None, 6),
    ("Unpopular opinion: most design systems fail not because of bad components, but because nobody documents the WHY.\n\nPrinciples > Components.", "https://images.unsplash.com/photo-1606857521015-7f9fcf423740", 3),
    ("After 4 years building payment infra, here are 5 things I learned about distributed systems:\n\n1. Idempotency is your best friend\n2. Observability > Monitoring\n3. Async is the default, not the exception\n4. Backpressure saves lives\n5. Test in production (responsibly)\n\nSave this for later.", None, 2),
    ("Speaking at the MENA AI Summit next week about how we use ML to personalize recommendations across the Levant. If you're attending, let's grab coffee in Damascus! ☕", "https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04", 5),
    ("Hot take: the best engineers I've ever managed are the ones who write the most boring code. Boring = predictable = maintainable = scalable. Stop trying to be clever.", None, 4),
]


async def run_seed(db):
    # users
    users = []
    me_id = uid()
    me_doc = {
        "id": me_id,
        "name": "Demo User",
        "email": "demo@syrlink.com",
        "password_hash": hash_pwd("demo1234"),
        "avatar": "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde",
        "cover": "https://images.unsplash.com/photo-1497215728101-856f4ea42174",
        "headline": "Software Engineer | Open to opportunities in the Levant",
        "location": "Damascus, Syria",
        "about": "Passionate engineer with 6+ years building products for the MENA region. Love mentoring & open source. Looking to connect with builders across Syria and beyond.",
        "verified": True,
        "experience": [
            {"id": uid(), "title": "Software Engineer", "company": "SyrTech", "logo": "https://logo.clearbit.com/google.com", "type": "Full-time", "duration": "Jan 2023 - Present · 2 yrs", "location": "Damascus, Syria", "description": "Leading the migration to a React 19 + Next.js architecture."},
            {"id": uid(), "title": "Junior Developer", "company": "Cham Code", "logo": "https://logo.clearbit.com/meta.com", "type": "Full-time", "duration": "Aug 2019 - Dec 2022", "location": "Damascus, Syria", "description": "Full-stack development with React and Node.js."},
        ],
        "education": [
            {"id": uid(), "school": "Damascus University", "logo": "https://logo.clearbit.com/damascusuniversity.edu.sy", "degree": "Bachelor's degree, Computer Engineering", "duration": "2015 - 2020"},
        ],
        "skills": ["React.js", "Node.js", "TypeScript", "Python", "MongoDB", "AWS", "System Design"],
        "languages": ["Arabic (Native)", "English (Fluent)", "French (Conversational)"],
        "connections": 487,
        "created_at": iso(datetime.now(timezone.utc) - timedelta(days=180)),
    }
    users.append(me_doc)

    for u in SYRIAN_USERS:
        users.append({
            "id": uid(),
            "name": u["name"],
            "email": f"{u['name'].lower().replace(' ', '.').replace('-', '')}@syrlink.com",
            "password_hash": hash_pwd("demo1234"),
            "avatar": u["avatar"],
            "cover": u["cover"],
            "headline": u["headline"],
            "location": u["location"],
            "about": f"Building cool things from {u['location'].split(',')[0]}. Open to interesting conversations.",
            "verified": u["verified"],
            "experience": [],
            "education": [],
            "skills": u["skills"],
            "languages": u["languages"],
            "connections": 100 + (hash(u["name"]) % 500),
            "created_at": iso(datetime.now(timezone.utc) - timedelta(days=120 + (hash(u["name"]) % 200))),
        })

    await db.users.insert_many(users)

    # posts
    now = datetime.now(timezone.utc)
    posts = []
    for i, (content, image, author_idx) in enumerate(POSTS_CONTENT):
        author = users[author_idx + 1]  # +1 to skip me
        posts.append({
            "id": uid(),
            "author_id": author["id"],
            "content": content,
            "image": image,
            "visibility": "Anyone",
            "likes_count": 200 + (i * 137) % 2000,
            "comments_count": 20 + (i * 23) % 200,
            "reposts_count": 5 + (i * 11) % 100,
            "created_at": iso(now - timedelta(hours=2 + i * 6)),
        })
    await db.posts.insert_many(posts)

    # jobs
    jobs = []
    for i, j in enumerate(JOBS):
        jobs.append({
            "id": uid(),
            **j,
            "applicants_count": 20 + (i * 31) % 300,
            "posted_at": iso(now - timedelta(days=i + 1, hours=2)),
        })
    await db.jobs.insert_many(jobs)

    # invitations (3 pending TO me_doc)
    invs = []
    for u in users[1:4]:
        invs.append({
            "id": uid(),
            "requester_id": u["id"],
            "receiver_id": me_id,
            "status": "pending",
            "note": f"Hi! Would love to connect — fellow {u['location'].split(',')[0]} builder.",
            "created_at": iso(now - timedelta(hours=3)),
        })
    if invs:
        await db.connections.insert_many(invs)

    # conversations (5)
    convs = []
    msgs = []
    for u in users[1:6]:
        cid = uid()
        last_msg = "بدنا نتقابل؟ Let's grab coffee in Damascus this week."
        convs.append({
            "id": cid,
            "participants": [me_id, u["id"]],
            "last_message": last_msg,
            "last_message_at": iso(now - timedelta(minutes=12)),
            "created_at": iso(now - timedelta(days=1)),
        })
        msgs.append({
            "id": uid(), "conversation_id": cid, "sender_id": u["id"],
            "text": f"أهلا! Saw your profile — really impressed.",
            "created_at": iso(now - timedelta(hours=2)), "read_at": None,
        })
        msgs.append({
            "id": uid(), "conversation_id": cid, "sender_id": u["id"],
            "text": last_msg,
            "created_at": iso(now - timedelta(minutes=12)), "read_at": None,
        })
    await db.conversations.insert_many(convs)
    await db.messages.insert_many(msgs)

    # notifications
    notif_types = [
        ("like", "liked your post about scaling React applications"),
        ("connection", "accepted your connection request"),
        ("mention", "mentioned you in a post"),
        ("comment", 'commented on your post: "This is brilliant work!"'),
        ("birthday", "is celebrating a work anniversary today"),
        ("job", "shared a job that matches your profile"),
        ("like", "and 12 others liked your comment"),
    ]
    notifs = []
    for i, (t, txt) in enumerate(notif_types):
        actor = users[(i + 1) % len(users)]
        notifs.append({
            "id": uid(),
            "user_id": me_id,
            "actor_id": actor["id"],
            "type": t,
            "text": txt,
            "target_id": None,
            "read": i >= 3,
            "created_at": iso(now - timedelta(hours=i * 2 + 1)),
        })
    await db.notifications.insert_many(notifs)


async def main():
    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ["DB_NAME"]
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    # wipe (only when run manually)
    for c in ["users", "posts", "post_likes", "comments", "connections", "jobs", "job_applications", "conversations", "messages", "notifications"]:
        await db[c].delete_many({})
    await run_seed(db)
    print("Seed complete.")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
