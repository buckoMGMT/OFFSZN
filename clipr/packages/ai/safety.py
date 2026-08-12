"""Pre-publish safety and rights screening.

Runs on every plan. The earlier design gated rights detection behind the top
tier, which has it backwards: the customer most likely to publish a copyright
claim unattended is the solo streamer on the cheapest plan with autopilot on,
and the legal exposure of automatically republishing other people's music lands
on us either way. What upper tiers buy is bulk tooling -- roster dashboards,
policy defaults, audit export -- not the detection itself.

The screener never edits content. A `block` flag stops *autopilot* and routes
the clip to human review; the decision to publish anyway stays with the
creator, because we are not in a position to adjudicate fair use.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from enum import Enum
from typing import Optional, Sequence


class Severity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    BLOCK = "block"


_ORDER = {Severity.LOW: 0, Severity.MEDIUM: 1, Severity.HIGH: 2, Severity.BLOCK: 3}


@dataclass(frozen=True)
class Flag:
    flag_type: str
    severity: Severity
    message: str
    matched_text: Optional[str] = None
    detail: Optional[dict] = None


@dataclass(frozen=True)
class Screening:
    flags: list[Flag]

    @property
    def blocks_autopilot(self) -> bool:
        return any(f.severity is Severity.BLOCK for f in self.flags)

    @property
    def worst(self) -> Optional[Severity]:
        return max((f.severity for f in self.flags), key=_ORDER.get, default=None)

    def of_type(self, flag_type: str) -> list[Flag]:
        return [f for f in self.flags if f.flag_type == flag_type]


# ---------------------------------------------------------------------------
# Detectors
# ---------------------------------------------------------------------------

# Deliberately conservative. A false profanity flag costs a glance in the review
# queue; a false negative costs a platform strike.
_SLURS_PLACEHOLDER: tuple[str, ...] = ()   # sourced from a maintained list at deploy time
_STRONG_PROFANITY = re.compile(r"\b(fuck|shit|cunt|bitch)\w*\b", re.I)

_EMAIL = re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.]{2,}\b")
_PHONE = re.compile(r"(?<!\d)(?:\+?\d{1,2}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)")
# Card-shaped digit runs. Luhn-checked below so order numbers do not trip it.
_CARDISH = re.compile(r"(?<!\d)(?:\d[ -]?){13,19}(?!\d)")
_STREET = re.compile(
    r"\b\d{1,5}\s+[A-Z][a-z]+(?:\s[A-Z][a-z]+)*\s"
    r"(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr"
    r"|Terrace|Ter|Court|Ct|Place|Pl|Circle|Cir|Way|Parkway|Pkwy)\b"
)

_SPONSOR = re.compile(
    r"\b(sponsored by|use code|promo code|paid partnership|#ad\b|brought to you by)", re.I
)

_INJECTION = re.compile(
    r"(ignore (all |any |the )?(previous|prior|above)\s+instructions?"
    r"|disregard (all |the )?(previous|prior|above)"
    r"|\bsystem prompt\b|\byou are now\b|\bnew instructions?\b)",
    re.I,
)


def _luhn(digits: str) -> bool:
    nums = [int(c) for c in digits if c.isdigit()]
    if not 13 <= len(nums) <= 19:
        return False
    total, parity = 0, len(nums) % 2
    for i, n in enumerate(nums):
        if i % 2 == parity:
            n *= 2
            if n > 9:
                n -= 9
        total += n
    return total % 10 == 0


def screen_transcript(text: str) -> list[Flag]:
    flags: list[Flag] = []
    if not text:
        return flags

    for m in _EMAIL.finditer(text):
        flags.append(Flag("pii", Severity.HIGH, "Email address spoken or on screen", m.group()))
    for m in _PHONE.finditer(text):
        flags.append(Flag("pii", Severity.HIGH, "Phone number detected", m.group()))
    for m in _STREET.finditer(text):
        flags.append(Flag("pii", Severity.HIGH, "Street address detected", m.group()))
    for m in _CARDISH.finditer(text):
        if _luhn(m.group()):
            # The only thing in this module that blocks outright: publishing a
            # live-read card number is unrecoverable within seconds.
            flags.append(Flag("pii", Severity.BLOCK, "Payment card number detected", "[redacted]"))

    if _STRONG_PROFANITY.search(text):
        flags.append(Flag(
            "profanity", Severity.LOW,
            "Strong language — some platforms suppress reach on this",
        ))
    for word in _SLURS_PLACEHOLDER:
        if re.search(rf"\b{re.escape(word)}\b", text, re.I):
            flags.append(Flag("unsafe", Severity.BLOCK, "Slur detected", "[redacted]"))

    if (m := _SPONSOR.search(text)):
        flags.append(Flag(
            "sponsor", Severity.MEDIUM,
            "Sponsor read detected — disclosure rules differ per platform", m.group(),
        ))

    if (m := _INJECTION.search(text)):
        flags.append(Flag(
            "prompt_injection", Severity.MEDIUM,
            "Text appears to target the ranking model; scored as content only", m.group(),
        ))
    return flags


def screen_audio_rights(
    music_matches: Sequence[dict] = (), *, min_confidence: float = 0.6
) -> list[Flag]:
    """Flags from an acoustic fingerprint provider.

    Takes matches rather than calling a provider so the policy is testable and
    the provider is swappable. Licensed-catalogue tracks are still surfaced,
    because a licence that covers a livestream frequently does not cover a
    repost to TikTok.
    """
    flags = []
    for match in music_matches:
        if match.get("confidence", 0) < min_confidence:
            continue
        title = match.get("title", "unknown track")
        flags.append(Flag(
            "copyright_music",
            Severity.BLOCK if match.get("policy") == "block" else Severity.HIGH,
            f"Recognised music: {title} ({match.get('rights_holder', 'unknown holder')})",
            title,
            {"start": match.get("start"), "end": match.get("end"),
             "confidence": match.get("confidence")},
        ))
    return flags


def screen_third_party_video(scene_matches: Sequence[dict] = ()) -> list[Flag]:
    flags = []
    for match in scene_matches:
        flags.append(Flag(
            "third_party_video", Severity.HIGH,
            f"Reacted-to footage detected: {match.get('source', 'unknown source')}",
            detail=match,
        ))
    return flags


def screen_duplicate(similarity: Optional[float], *, threshold: float = 0.92) -> list[Flag]:
    if similarity is not None and similarity >= threshold:
        return [Flag(
            "duplicate", Severity.MEDIUM,
            f"{similarity:.0%} similar to a clip already published from this channel",
            detail={"similarity": similarity},
        )]
    return []


def screen(
    *,
    transcript_text: str = "",
    music_matches: Sequence[dict] = (),
    scene_matches: Sequence[dict] = (),
    duplicate_similarity: Optional[float] = None,
) -> Screening:
    return Screening(
        screen_transcript(transcript_text)
        + screen_audio_rights(music_matches)
        + screen_third_party_video(scene_matches)
        + screen_duplicate(duplicate_similarity)
    )
