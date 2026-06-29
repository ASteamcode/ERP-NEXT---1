# Copyright (c) 2026, ASteamcode and contributors
# For license information, please see license.txt

import json
import re
from urllib.parse import urlparse

import frappe
from frappe import _
from frappe.model.document import Document

# ── Optional SDK import (fails gracefully so Frappe still boots) ──────────────
try:
    from google import genai
    from google.genai import types as genai_types

    _SDK_AVAILABLE = True
except ImportError:
    genai = None
    genai_types = None
    _SDK_AVAILABLE = False

# ── Module constants ──────────────────────────────────────────────────────────
_DEFAULT_MODEL = "gemini-2.5-flash-lite"

# Free-tier quota is per-model, so on a 429 we roll to the next bucket.
_MODEL_FALLBACK_CHAIN = [
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash",
    "gemini-2.5-flash",
]
_BATCH_SIZE = 5          # max URLs per Gemini call (url_context has a per-request cap)
_MIN_URL_LEN = 10        # sanity floor — anything shorter is almost certainly garbage
_VALID_SCHEMES = frozenset(("http", "https"))

_DEFAULT_PROMPT = """\
You are a precision data-extraction agent. For each URL provided, visit the page \
using the url_context tool and extract every product listing with a clearly visible price.

Return a JSON array — one object per product — using exactly these field names:
  • item_code  — the product SKU, model number, or a URL-safe slug derived from the \
product name (lowercase-hyphenated, e.g. "blue-widget-xl")
  • price      — numeric price as a float, no currency symbols or commas (e.g. 29.99)
  • currency   — ISO 4217 code inferred from the page locale (e.g. USD, EUR, GBP)
  • price_list — always the string "Standard Selling"
  • source_url — the exact URL you fetched this product from

Rules:
  • Only include products with a clear, unambiguous price
  • For price ranges, use the lower bound
  • Skip items marked "Out of Stock", "Call for Price", or with no price visible
  • Never guess or estimate — omit the record entirely if data is uncertain\
"""

_DEFAULT_SCHEMA = """\
{
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "item_code":  { "type": "string",  "description": "SKU or URL-safe product slug" },
      "price":      { "type": "number",  "description": "Numeric price, no symbols"    },
      "currency":   { "type": "string",  "description": "ISO 4217 code e.g. USD"       },
      "price_list": { "type": "string",  "description": "Always: Standard Selling"     },
      "source_url": { "type": "string",  "description": "URL this was extracted from"  }
    },
    "required": ["item_code", "price", "currency", "price_list", "source_url"]
  }
}\
"""


# ─────────────────────────────────────────────────────────────────────────────
# DocType controller
# ─────────────────────────────────────────────────────────────────────────────

class ScraperHunt(Document):

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    def before_insert(self):
        """Seed sensible defaults so a new Hunt is immediately runnable."""
        if not self.model:
            self.model = _DEFAULT_MODEL
        if not (self.hunt_prompt or "").strip():
            self.hunt_prompt = _DEFAULT_PROMPT
        if not (self.response_schema or "").strip():
            self.response_schema = _DEFAULT_SCHEMA

    def validate(self):
        _validate_prompt(self.hunt_prompt)
        _validate_url_rows(self.target_urls or [])

    def before_save(self):
        if not self.model:
            self.model = _DEFAULT_MODEL

    # ── Main action (called by the 'Run Hunt' button via frm.call) ────────────

    @frappe.whitelist()
    def run_filtered_hunt(self):
        """
        Dual-mode pipeline:
          Person Intelligence → Google Search grounding (fast, no URL fetching)
          Item Prices         → url_context per URL batch → upsert Item Price records
        """
        _assert_sdk()

        api_key = _resolve_api_key(self.api_key)
        client  = genai.Client(api_key=api_key)
        api_errors: list[str] = []

        if self.hunt_mode == "Person Intelligence":
            # ── Google Search path: single call, seconds not minutes ──────────
            try:
                record = self._call_gemini_person(client)
            except Exception as exc:
                frappe.log_error(message=str(exc), title="ScraperHunt – Person Hunt Error")
                frappe.throw(_(f"Hunt failed: {exc}"))
                return

            stats = _save_person_result(self, [record] if record else [])
            self._finalise([record] if record else [], stats, api_errors)

        else:
            # ── URL-context path: item price extraction ───────────────────────
            urls = self._run_filter_pipeline()
            if not urls:
                frappe.msgprint(
                    _("No URLs passed the pre-filter. Check your URL list, Active flags, and filter settings."),
                    title=_("Nothing to Hunt"),
                    indicator="orange",
                )
                return

            all_records: list[dict] = []
            for batch in _chunks(urls, _BATCH_SIZE):
                try:
                    all_records.extend(self._call_gemini(client, batch))
                except Exception as exc:
                    msg = f"Gemini batch failed — URLs: {batch}\n{exc}"
                    frappe.log_error(message=msg, title="ScraperHunt – Gemini Error")
                    api_errors.append(str(exc))

            stats = _upsert_item_prices(all_records, hunt_name=self.name)
            self._finalise(all_records, stats, api_errors)

    # ── URL pre-filter pipeline ───────────────────────────────────────────────

    def _run_filter_pipeline(self) -> list[str]:
        """
        Three cheap Python gates applied in order before any API call:
          Gate 1 – is_active flag
          Gate 2 – optional allow-list regex  (self.url_filter_pattern)
          Gate 3 – optional domain block-list (self.blocked_domains, newline-separated)

        Mutates each row's last_status in memory (saved implicitly on next save).
        Logs a structured filter report to frappe.logger at INFO level.
        """
        allow_re = _compile_pattern(self.url_filter_pattern)
        blocked = _parse_blocked_domains(self.blocked_domains)

        accepted: list[str] = []
        log_lines: list[str] = []

        for row in self.target_urls or []:
            url = (row.url or "").strip()

            # Gate 1 – active flag
            if not row.is_active:
                continue

            # Gate 2 – minimum length sanity check
            if len(url) < _MIN_URL_LEN:
                row.last_status = "Filtered: too short"
                log_lines.append(f"  SKIP  {url!r}  → too short")
                continue

            # Gate 3 – regex allow-list
            if allow_re and not allow_re.search(url):
                row.last_status = "Filtered: pattern mismatch"
                log_lines.append(f"  SKIP  {url}  → pattern mismatch")
                continue

            # Gate 4 – domain block-list
            host = urlparse(url).netloc.lower().lstrip("www.")
            if host in blocked:
                row.last_status = "Filtered: blocked domain"
                log_lines.append(f"  SKIP  {url}  → blocked domain ({host})")
                continue

            row.last_status = "Queued"
            accepted.append(url)

        frappe.logger().info(
            "[ScraperHunt] %s — %d/%d URLs passed filter.\n%s",
            self.name,
            len(accepted),
            len(self.target_urls or []),
            "\n".join(log_lines) or "  (all passed)",
        )

        return accepted

    # ── Gemini integration ────────────────────────────────────────────────────

    def _build_config(self) -> "genai_types.GenerateContentConfig":
        """
        Constructs GenerateContentConfig with:
          • url_context tool  → Gemini fetches live page content for each URL
          • response_mime_type = application/json → forces parseable output
          • temperature = 0   → deterministic extraction, no creative hallucination
          • response_schema   → strict field enforcement (optional, schema from field)

        NOTE: response_schema + url_context works on Gemini 2.5 Flash but may raise
        an error on older models. The try/except below degrades gracefully by retrying
        without the schema if the initial config is rejected by the API.
        """
        config_kwargs: dict = {
            "tools": [genai_types.Tool(url_context=genai_types.UrlContext())],
            "response_mime_type": "application/json",
            "temperature": 0.0,
        }

        # Person Intelligence returns a flat object; skip any Item Price schema
        raw_schema = (self.response_schema or "").strip()
        if raw_schema and self.hunt_mode != "Person Intelligence":
            try:
                config_kwargs["response_schema"] = json.loads(raw_schema)
            except json.JSONDecodeError as exc:
                frappe.log_error(
                    f"response_schema field contains invalid JSON — proceeding without schema.\n{exc}",
                    "ScraperHunt – Schema Warning",
                )

        return genai_types.GenerateContentConfig(**config_kwargs)

    def _build_prompt(self, urls: list[str]) -> str:
        url_block = "\n".join(f"  - {u}" for u in urls)
        return (
            f"{self.hunt_prompt.strip()}\n\n"
            "Target URLs to fetch and analyse:\n"
            f"{url_block}\n\n"
            "Instructions:\n"
            "  1. Use the url_context tool to fetch each URL above.\n"
            "  2. Extract the requested data from the fetched content.\n"
            "  3. Return ONLY a valid JSON array of objects — one object per URL.\n"
            "  4. Each object must include a 'source_url' key containing the URL it came from.\n"
            "  5. Do NOT include markdown fences, prose, or any text outside the JSON array."
        )

    def _call_gemini_person(self, client) -> dict:
        """
        Person Intelligence — single focused Google Search call.
        Priority-ordered so Gemini anchors on the most reliable signal first
        (LinkedIn), then derives contact / socials / description from there.
        Rolls through the model fallback chain on quota errors.
        """
        text    = _search_generate(client, self.model, self.hunt_prompt.strip())
        records = _parse_json_response(text, context_urls=[])
        return next((r for r in records if isinstance(r, dict)), {})

    @frappe.whitelist()
    def run_deep_hunt(self):
        """
        Phase 2: Google Search grounding pass.
        Reads the existing hunt_result, targets the missing fields,
        merges new data in, and returns {result, new_fields}.
        """
        _assert_sdk()
        api_key = _resolve_api_key(self.api_key)
        client  = genai.Client(api_key=api_key)

        existing: dict = {}
        if self.hunt_result:
            try:
                existing = json.loads(self.hunt_result)
            except Exception:
                pass

        known_name = (
            existing.get("full_name")
            or (self.target_name or "").strip()
            or "this person"
        )

        _PERSON_FIELDS = [
            "emails", "phones", "instagram_url", "linkedin_url",
            "facebook_url", "twitter_url", "websites", "company", "job_title",
        ]
        missing = [f for f in _PERSON_FIELDS if not existing.get(f)]

        known_summary = ", ".join(
            f"{k}: {v}" for k, v in existing.items()
            if v and k not in ("source_urls",)
        )

        prompt = (
            f"Search Google for: {known_name}\n\n"
            f"Already known — {known_summary}\n\n"
            f"Find what is still missing: {', '.join(missing) if missing else 'verify and fill any gaps'}.\n\n"
            "Return a single JSON object. Two tiers:\n"
            "CONFIRMED (certain): full_name, emails, phones, usernames, "
            "instagram_url, linkedin_url, facebook_url, twitter_url, websites, company, job_title\n"
            "POSSIBLE (leads, not confirmed — up to 3 URLs each): "
            "possible_instagram, possible_twitter, possible_linkedin, possible_facebook\n\n"
            "Raw JSON only. No markdown."
        )

        try:
            text = _search_generate(client, self.model, prompt)
        except Exception as exc:
            frappe.throw(_(str(exc)))

        records  = _parse_json_response(text, context_urls=[])
        new_data = next((r for r in records if isinstance(r, dict)), {})

        # Merge: fill gaps, extend arrays, never overwrite existing values
        merged     = dict(existing)
        new_fields: list[str] = []
        for k, v in new_data.items():
            if not v:
                continue
            if isinstance(v, list):
                prev = merged.get(k) if isinstance(merged.get(k), list) else []
                added = [x for x in v if x not in prev]
                if added:
                    merged[k] = prev + added
                    new_fields.append(k)
            elif not merged.get(k):
                merged[k] = v
                new_fields.append(k)

        self.db_set("hunt_result", json.dumps(merged, indent=2, ensure_ascii=False))
        frappe.db.commit()

        return {"result": merged, "new_fields": new_fields}

    @frappe.whitelist()
    def run_platform_hunt(self, platform: str):
        """
        Targeted single-platform search.
        platform: one of instagram | twitter | linkedin | facebook
        Returns {result, new_fields} same shape as run_deep_hunt.
        """
        _assert_sdk()
        _PLATFORMS = {
            "instagram": ("Instagram",  "instagram_url", "possible_instagram"),
            "twitter":   ("X/Twitter",  "twitter_url",   "possible_twitter"),
            "linkedin":  ("LinkedIn",   "linkedin_url",  "possible_linkedin"),
            "facebook":  ("Facebook",   "facebook_url",  "possible_facebook"),
        }
        if platform not in _PLATFORMS:
            frappe.throw(_(f"Unknown platform: {platform}"))

        label, confirmed_key, possible_key = _PLATFORMS[platform]

        existing: dict = {}
        if self.hunt_result:
            try:
                existing = json.loads(self.hunt_result)
            except Exception:
                pass

        known_name = (
            existing.get("full_name")
            or (self.target_name or "").strip()
            or "this person"
        )
        known_summary = ", ".join(
            f"{k}: {v}" for k, v in existing.items()
            if v and k not in ("source_urls", possible_key, confirmed_key)
        )

        prompt = (
            f"Search Google for: {known_name} {label} profile\n\n"
            f"Known about this person: {known_summary}\n\n"
            f"Find their {label} account. "
            f"If you are certain, return {{ \"{confirmed_key}\": \"url\" }}. "
            f"If you only have candidates, return {{ \"{possible_key}\": [\"url1\", \"url2\"] }} with up to 5 URLs.\n\n"
            "Raw JSON only. No markdown."
        )

        api_key = _resolve_api_key(self.api_key)
        client  = genai.Client(api_key=api_key)

        try:
            text = _search_generate(client, self.model, prompt)
        except Exception as exc:
            frappe.throw(_(str(exc)))

        records  = _parse_json_response(text, context_urls=[])
        new_data = next((r for r in records if isinstance(r, dict)), {})

        merged     = dict(existing)
        new_fields: list[str] = []
        for k, v in new_data.items():
            if not v:
                continue
            if isinstance(v, list):
                prev  = merged.get(k) if isinstance(merged.get(k), list) else []
                added = [x for x in v if x not in prev]
                if added:
                    merged[k] = prev + added
                    new_fields.append(k)
            elif not merged.get(k):
                merged[k] = v
                new_fields.append(k)

        self.db_set("hunt_result", json.dumps(merged, indent=2, ensure_ascii=False))
        frappe.db.commit()

        return {"result": merged, "new_fields": new_fields}

    def _call_gemini(self, client, urls: list[str]) -> list[dict]:
        """Single Gemini round-trip for one batch of URLs. Returns parsed records."""
        config = self._build_config()
        prompt = self._build_prompt(urls)

        try:
            response = client.models.generate_content(
                model=self.model or _DEFAULT_MODEL,
                contents=prompt,
                config=config,
            )
        except Exception as exc:
            # Catch API-level errors: quota exceeded, network failure, invalid config
            raise RuntimeError(f"Gemini API error: {exc}") from exc

        return _parse_json_response(response.text or "", context_urls=urls)

    # ── Finalisation ──────────────────────────────────────────────────────────

    def _finalise(self, records: list[dict], stats: dict, api_errors: list[str]):
        lines = [
            f"Records extracted : {len(records)}",
            f"Item Prices — Inserted: {stats['inserted']} | Updated: {stats['updated']} | Skipped: {stats['skipped']}",
        ]
        if api_errors:
            lines.append(f"API errors: {len(api_errors)} — see Error Log for details.")

        summary = "\n".join(lines)

        # db_set writes directly to DB without a full doc save, preserving audit trail
        self.db_set("hunt_log", summary)
        self.db_set("last_run", frappe.utils.now_datetime(), update_modified=False)

        indicator = "green" if not api_errors else "orange"
        frappe.msgprint(summary, title=_("Hunt Complete"), indicator=indicator)


# ─────────────────────────────────────────────────────────────────────────────
# Person Intelligence helpers
# ─────────────────────────────────────────────────────────────────────────────

def _build_person_urls(doc) -> list[str]:
    """Derive target URLs from the person's social handle fields + extra URL rows."""
    def clean(s):
        return (s or "").lstrip("@").strip()

    urls: list[str] = []
    if clean(doc.target_instagram):
        urls.append(f"https://www.instagram.com/{clean(doc.target_instagram)}/")
    if clean(doc.target_linkedin):
        urls.append(f"https://www.linkedin.com/in/{clean(doc.target_linkedin)}/")
    if clean(doc.target_facebook):
        urls.append(f"https://www.facebook.com/{clean(doc.target_facebook)}")
    if clean(doc.target_twitter):
        urls.append(f"https://x.com/{clean(doc.target_twitter)}")
    if doc.target_website:
        w = doc.target_website.strip()
        urls.append(w if w.startswith("http") else f"https://{w}")

    # Also include manually added rows from the child table
    for row in doc.target_urls or []:
        if row.is_active and (row.url or "").strip():
            urls.append(row.url.strip())

    # Deduplicate preserving order
    seen: set[str] = set()
    result: list[str] = []
    for u in urls:
        if u not in seen:
            seen.add(u)
            result.append(u)
    return result


def _save_person_result(doc, records: list[dict]) -> dict:
    """
    Merge all returned records into one profile object and save to hunt_result.
    Optionally creates an ERPNext Contact from the extracted data.
    """
    if not records:
        return {"inserted": 0, "updated": 0, "skipped": 0}

    merged: dict = {}
    for rec in records:
        for k, v in rec.items():
            if v in (None, "", [], {}):
                continue
            if k not in merged:
                merged[k] = v
            elif isinstance(v, list) and isinstance(merged[k], list):
                combined = merged[k] + [x for x in v if x not in merged[k]]
                merged[k] = combined

    result_json = json.dumps(merged, indent=2, ensure_ascii=False)
    doc.db_set("hunt_result", result_json)
    frappe.db.commit()

    _maybe_create_contact(merged)
    return {"inserted": 1, "updated": 0, "skipped": 0}


def _maybe_create_contact(data: dict):
    """Best-effort: upsert an ERPNext Contact from the extracted person profile."""
    full_name = (data.get("full_name") or "").strip()
    if not full_name:
        return

    try:
        emails = data.get("emails") or []
        phones = data.get("phones") or []
        company = (data.get("company") or "").strip()

        parts = full_name.split(" ", 1)
        first = parts[0]
        last  = parts[1] if len(parts) > 1 else ""

        # Skip if contact already exists (match on first email)
        if emails and frappe.db.exists("Contact Email", {"email_id": emails[0]}):
            return

        contact = frappe.new_doc("Contact")
        contact.first_name   = first
        contact.last_name    = last
        contact.company_name = company

        for email in emails[:3]:
            contact.append("email_ids", {"email_id": email, "is_primary": 1 if email == emails[0] else 0})
        for phone in phones[:2]:
            contact.append("phone_nos", {"phone": phone, "is_primary_mobile_no": 1 if phone == phones[0] else 0})

        contact.insert(ignore_permissions=True)
        frappe.db.commit()
    except Exception as exc:
        frappe.log_error(f"Auto-contact creation failed: {exc}", "ScraperHunt – Contact")


# ─────────────────────────────────────────────────────────────────────────────
# ERPNext persistence helpers
# ─────────────────────────────────────────────────────────────────────────────

def _upsert_item_prices(records: list[dict], hunt_name: str) -> dict:
    """
    Loops over extracted records and upserts ERPNext Item Price documents.

    Expected keys per record (adapt field names to match your hunt_prompt schema):
      item_code   str   required
      price       float required
      price_list  str   optional (defaults to "Standard Selling")
      currency    str   optional (defaults to site global default)
      source_url  str   optional (logged for audit)

    Returns a stats dict: {inserted, updated, skipped}.
    """
    inserted = updated = skipped = 0
    default_currency = frappe.defaults.get_global_default("currency") or "USD"

    for rec in records:
        try:
            item_code = (rec.get("item_code") or "").strip()
            price_list = (rec.get("price_list") or "Standard Selling").strip()
            raw_price = rec.get("price")
            currency = (rec.get("currency") or default_currency).strip()
            source_url = (rec.get("source_url") or "").strip()

            # ── Guard: required fields ────────────────────────────────────────
            if not item_code:
                frappe.log_error(
                    f"Record skipped — missing item_code:\n{json.dumps(rec, indent=2)}",
                    "ScraperHunt – Upsert Warning",
                )
                skipped += 1
                continue

            if raw_price is None:
                frappe.log_error(
                    f"Record skipped — price is null for '{item_code}':\n{json.dumps(rec, indent=2)}",
                    "ScraperHunt – Upsert Warning",
                )
                skipped += 1
                continue

            price = float(raw_price)

            # ── Upsert Item Price ─────────────────────────────────────────────
            existing_name = frappe.db.get_value(
                "Item Price",
                filters={"item_code": item_code, "price_list": price_list},
                fieldname="name",
            )

            if existing_name:
                # Use db.set_value for a lightweight update that skips validation hooks.
                # Switch to get_doc/save() if you need before_save/on_update to fire.
                frappe.db.set_value(
                    "Item Price",
                    existing_name,
                    {"price_list_rate": price, "currency": currency},
                )
                updated += 1
                action = "Updated"
            else:
                frappe.get_doc({
                    "doctype": "Item Price",
                    "item_code": item_code,
                    "price_list": price_list,
                    "price_list_rate": price,
                    "currency": currency,
                }).insert(ignore_permissions=True)
                inserted += 1
                action = "Inserted"

            # ── Write audit log ───────────────────────────────────────────────
            _write_hunt_log(
                hunt_name=hunt_name,
                item_code=item_code,
                price=price,
                currency=currency,
                source_url=source_url,
                action=action,
            )

        except Exception as exc:
            frappe.log_error(
                f"Upsert failed for record:\n{json.dumps(rec, indent=2)}\n\nError:\n{exc}",
                "ScraperHunt – Upsert Error",
            )
            skipped += 1

    frappe.db.commit()
    return {"inserted": inserted, "updated": updated, "skipped": skipped}


def _write_hunt_log(
    hunt_name: str,
    item_code: str,
    price: float,
    currency: str,
    source_url: str,
    action: str,
):
    """Insert a Scraper Hunt Log row. No-ops silently if the DocType doesn't exist yet."""
    if not frappe.db.exists("DocType", "Scraper Hunt Log"):
        return
    try:
        frappe.get_doc({
            "doctype": "Scraper Hunt Log",
            "scraper_hunt": hunt_name,
            "item_code": item_code,
            "price": price,
            "currency": currency,
            "source_url": source_url,
            "action": action,
            "logged_on": frappe.utils.now_datetime(),
        }).insert(ignore_permissions=True)
    except Exception as exc:
        frappe.log_error(f"Hunt log write failed: {exc}", "ScraperHunt – Log Error")


# ─────────────────────────────────────────────────────────────────────────────
# JSON parsing
# ─────────────────────────────────────────────────────────────────────────────

def _parse_json_response(raw: str, context_urls: list[str]) -> list[dict]:
    """
    Robust three-pass extractor:
      Pass 1 — direct json.loads (works when response_mime_type is honoured)
      Pass 2 — strip markdown fences, then parse (defensive for non-compliant output)
      Pass 3 — wrap bare dict in a list (handles single-item responses)

    Returns a list[dict]. Logs and returns [] on unrecoverable parse failure.
    """
    text = raw.strip()

    # Pass 2: strip markdown fences
    fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text, re.IGNORECASE)
    if fence_match:
        text = fence_match.group(1).strip()

    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        frappe.log_error(
            (
                f"JSON parse failed — context URLs: {context_urls}\n"
                f"Raw Gemini output:\n{raw}\n"
                f"Error: {exc}"
            ),
            "ScraperHunt – JSON Parse Error",
        )
        return []

    # Pass 3: normalise to list
    if isinstance(data, dict):
        data = [data]

    if not isinstance(data, list):
        frappe.log_error(
            f"Unexpected JSON root type '{type(data).__name__}' (expected list or dict). "
            f"Context URLs: {context_urls}",
            "ScraperHunt – JSON Structure Error",
        )
        return []

    # Drop non-dict elements defensively
    return [r for r in data if isinstance(r, dict)]


# ─────────────────────────────────────────────────────────────────────────────
# Validation helpers
# ─────────────────────────────────────────────────────────────────────────────

def _validate_prompt(prompt: str | None):
    if not (prompt or "").strip():
        frappe.throw(_("Hunt Prompt is required."), title=_("Validation Error"))


def _validate_url_rows(rows):
    seen: set[str] = set()
    for row in rows:
        url = (row.url or "").strip()
        if not url:
            frappe.throw(_("Row {0}: URL cannot be blank.").format(row.idx))
        if urlparse(url).scheme not in _VALID_SCHEMES:
            frappe.throw(
                _("Row {0}: URL must start with http:// or https://.").format(row.idx)
            )
        if url in seen:
            frappe.throw(_("Row {0}: Duplicate URL detected.").format(row.idx))
        seen.add(url)


# ─────────────────────────────────────────────────────────────────────────────
# SDK / API key helpers
# ─────────────────────────────────────────────────────────────────────────────

def _is_rate_limit(exc) -> bool:
    s = str(exc)
    return "429" in s or "RESOURCE_EXHAUSTED" in s


def _search_generate(client, preferred_model: str, prompt: str) -> str:
    """
    Google-Search-grounded generation with per-model quota fallback.

    Free-tier quota is counted per model, so a 429 on one model simply means
    we roll to the next bucket. Returns response.text, or raises a clear
    RuntimeError if every model in the chain is rate-limited.
    """
    config = genai_types.GenerateContentConfig(
        tools=[genai_types.Tool(google_search=genai_types.GoogleSearch())],
        temperature=0.0,
    )
    pref  = preferred_model or _DEFAULT_MODEL
    chain = [pref] + [m for m in _MODEL_FALLBACK_CHAIN if m != pref]

    last_exc = None
    for model in chain:
        try:
            resp = client.models.generate_content(model=model, contents=prompt, config=config)
            return resp.text or ""
        except Exception as exc:
            last_exc = exc
            if _is_rate_limit(exc):
                frappe.logger().info(f"ScraperHunt: {model} rate-limited, trying next model")
                continue
            raise RuntimeError(f"Gemini API error: {exc}") from exc

    raise RuntimeError(
        "Every Gemini model hit its free-tier daily limit. "
        "Wait a minute and retry, or add billing to your API key at "
        "https://aistudio.google.com/apikey"
    ) from last_exc


def _assert_sdk():
    if not _SDK_AVAILABLE:
        frappe.throw(
            _(
                "google-genai SDK is not installed.<br>"
                "Run: <code>pip install google-genai</code> inside your bench virtualenv."
            ),
            title=_("Missing Dependency"),
        )


def _resolve_api_key(field_value: str | None) -> str:
    """
    Resolution order (most-to-least specific):
      1. api_key field on the document (encrypted Password field)
      2. 'gemini_api_key' key in sites/<site>/site_config.json  ← recommended for prod
    """
    key = (field_value or "").strip() or frappe.conf.get("gemini_api_key", "")
    if not key:
        frappe.throw(
            _(
                "Gemini API key not found.<br>"
                "Either set it in the <b>Gemini API Key</b> field, or add "
                "<code>\"gemini_api_key\": \"AIza...\"</code> to "
                "<code>sites/dev.localhost/site_config.json</code>."
            ),
            title=_("Missing API Key"),
        )
    return key


# ─────────────────────────────────────────────────────────────────────────────
# General utilities
# ─────────────────────────────────────────────────────────────────────────────

def _chunks(lst: list, size: int):
    """Yield successive fixed-size slices from lst."""
    for i in range(0, len(lst), size):
        yield lst[i: i + size]


def _compile_pattern(pattern: str | None) -> re.Pattern | None:
    if not (pattern or "").strip():
        return None
    try:
        return re.compile(pattern)
    except re.error as exc:
        frappe.log_error(
            f"Invalid regex in url_filter_pattern: {pattern!r}\n{exc}",
            "ScraperHunt – Regex Warning",
        )
        return None


def _parse_blocked_domains(raw: str | None) -> frozenset[str]:
    if not raw:
        return frozenset()
    return frozenset(
        line.strip().lower().lstrip("www.")
        for line in raw.splitlines()
        if line.strip()
    )
