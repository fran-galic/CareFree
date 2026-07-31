# AI Assistant

Julija is the CareFree AI assistant for initial student support and triage. Its purpose is to help a student describe what they are going through, identify the relevant support area and, when appropriate, move toward a psychologist recommendation or booking flow.

Julija is not a therapist, diagnostic tool or emergency service.

## Implementation

The assistant lives in `backend/assistant/` and is exposed through session endpoints:

- `POST /assistant/session/start`
- `POST /assistant/session/message`
- `POST /assistant/session/end`
- `GET /assistant/summaries`
- `GET /assistant/summaries/<id>`

The backend stores:

- `AssistantSession`: active session state, mode, status, category and crisis flag.
- `AssistantMessage`: ordered student and assistant messages.
- `AssistantSessionSummary`: stored summary, category data, recommendation metadata and optional transcript snapshot.

## Structured LLM Output

The OpenAI response is expected as JSON and validated through a Pydantic schema. Important fields include:

- `mode`
- `message`
- `summary`
- `main_category_code`
- `subcategory_codes`
- `danger_flag`
- `should_end_session`
- `should_show_recommendations`
- `should_store_summary`

This turns the LLM response into application state instead of treating it as plain chat text.

## Recommendation Flow

When Julija has enough context, the assistant can trigger psychologist recommendations. The recommendation layer:

1. resolves the model-provided category labels/codes into known help categories;
2. filters only approved psychologists;
3. prioritizes subcategory matches;
4. falls back to broader category matches;
5. falls back to a general pool if no specific match is available.

The frontend can then show relevant psychologists and let the student continue into the appointment request flow.

## Safety And Privacy

Before user content is sent to the model, the backend redacts common sensitive identifiers such as email addresses, phone numbers, URLs, OIB, JMBAG and address-like patterns. This is a minimization step, not full anonymization.

The assistant has a crisis mode and fallback crisis responses for high-risk messages. In crisis situations the system emphasizes immediate human help and local emergency contacts. It does not automatically contact a human operator.

## Fallbacks

The LLM integration includes:

- primary and backup model configuration;
- request timeouts;
- quota and timeout handling;
- local heuristic responses for common support, category and crisis cases.

These fallbacks keep the demo usable when the external model is slow or unavailable, while still making it clear that the full assistant experience depends on OpenAI configuration.
