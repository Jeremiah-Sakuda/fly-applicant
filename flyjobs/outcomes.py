"""The mock job market. Everything here is scripted comedy; the clicks are not."""
from __future__ import annotations

import random
from dataclasses import dataclass, field

COMPANIES = [
    "Drosophila Dynamics", "Mushroom Body Capital", "Optic Lobe Labs", "Vinegar & Sons",
    "Banana Peel Ventures", "Compost Heap Logistics", "Ommatidia Analytics", "Larval Stage",
    "Ripe Fruit Partners", "Petri Dish Systems", "Fermentation Co.", "Proboscis Health",
    "Haltere Aerospace", "Wing Disc Robotics", "Overripe Mango Group", "Kombucha Bros",
    "Windowsill Holdings", "Sticky Trap Security", "Pupa Pay", "Ethanol Institute",
]
ROLES = [
    "Junior Forward Locomotion Analyst", "Associate Wing Beat Engineer", "Growth Hacker (Fruit)",
    "Sensory Integration Intern", "Staff Grooming Specialist", "Head of Vinegar Detection",
    "Entry-level Chief of Staff", "Product Manager, Rotting", "Senior Hovering Consultant",
    "Founding Engineer (unpaid, equity in banana)", "Data Scientist, Courtship Song",
    "Customer Success, Windowsill", "Backend Engineer, Ventral Nerve Cord",
]
REQUIREMENTS = [
    "10+ years of experience", "Must be comfortable in a fast-paced, rotting environment",
    "Bachelor's degree or equivalent number of legs", "Excellent written communication (no proboscis)",
    "Ability to lift 0.2 mg", "Passion for synergy and overripe fruit",
    "Experience with Kubernetes, React, and walking", "Willing to relocate to a different banana",
    "Must not be attracted to light during business hours", "Self-starter, no larval supervision needed",
]
PERKS = ["Unlimited PTO (lifespan: 50 days)", "Free kombucha on tap", "Hybrid: 3 days in the jar",
         "Competitive equity in a single grape", "Dog-friendly office (please be careful)"]
REJECTIONS = [
    "We've decided to move forward with other flies.",
    "After careful consideration, we will not be moving forward with your application.",
    "Your profile is impressive, but it is not a fit for this larva.",
    "The position has been filled internally (by a wasp).",
    "Thank you for your interest in the compost. We received a high volume of applicants.",
    "We were impressed by your background, but",
    "Unfortunately we are looking for someone with more legs of experience.",
    "We have decided to pursue candidates whose experience more closely matches our needs (mammals).",
]
INMAILS = [
    ("Recruiter at Vinegar & Sons", "Exciting opportunity in vinegar. Are you open to a quick chat?"),
    ("Talent Partner, Pupa Pay", "Hi there, loved your profile! Are you open to a 9-stage interview loop?"),
    ("Headhunter", "I have a role that is perfect for you. It is in a sealed jar."),
]


@dataclass
class Posting:
    id: int
    company: str
    role: str
    salary: str
    location: str
    reqs: list[str]
    perk: str
    applicants: int
    posted: str
    workdaze: bool

    def as_dict(self):
        return self.__dict__.copy()


@dataclass
class Market:
    seed: int = 1000
    interview_at: int = 612        # exactly one callback, on this application number
    workdaze_every: int = 37       # every Nth posting routes through the retype-your-resume portal
    inmail_every: int = 173
    rng: random.Random = field(init=False)
    next_id: int = field(default=1, init=False)

    def __post_init__(self):
        self.rng = random.Random(self.seed)

    def posting(self) -> Posting:
        r = self.rng
        i = self.next_id
        self.next_id += 1
        lo = r.choice([0, 0, 1, 2, 3])
        return Posting(
            id=i, company=r.choice(COMPANIES), role=r.choice(ROLES),
            salary=f"${lo}.00–${lo + r.choice([0, 1, 2])}.{r.choice(['00', '50', '99'])}/hr + fruit",
            location=r.choice(["Remote (jar)", "Hybrid · Kitchen counter", "On-site · Compost bin", "Windowsill, NY"]),
            reqs=r.sample(REQUIREMENTS, 3), perk=r.choice(PERKS),
            applicants=r.choice([112, 340, 1204, 2981, 10000]), posted=r.choice(["2m", "14m", "1h", "3h", "Reposted 30d"]),
            workdaze=(i % self.workdaze_every == 0),
        )

    def outcome(self, app_number: int) -> tuple[str, float, str]:
        """Return (kind, delay_seconds, message) for an application."""
        r = self.rng
        if app_number == self.interview_at:
            return "interview", r.uniform(6, 10), "We'd love to schedule a quick chat about next steps!"
        # lognormal latency: median ~40 s, occasionally minutes, sometimes absurdly fast
        delay = min(240.0, max(4.0, r.lognormvariate(3.7, 0.7)))
        return "rejection", delay, r.choice(REJECTIONS)
