# Live Coding Lecture API Documentation

## Table of Contents
- [Replay API Endpoints](#replay-api-endpoints)
  - [Get All Lecture Sessions](#get-all-lecture-sessions)
  - [Get Instructor Changes](#get-instructor-changes)
  - [Get Session Details](#get-session-details)
- [How to Read ChangeSet Examples](#how-to-read-changeset-examples)
  - [Overview](#overview)
  - [Examples](#examples)
  - [Notes](#notes)

## Replay API Endpoints

### Get All Lecture Sessions
```http
GET /lecture-sessions
```
Returns a list of all lecture sessions.

**Response:**
```json
{
  "sessions": [
    {
      "id": "string",
      "name": "string",
      "startTime": "string (ISO date)",
      "status": "OPEN" | "CLOSED"
    }
  ]
}
```

### Get Instructor Changes
```http
GET /instructor-changes/:sessionId/:docversion
```
Returns all instructor code changes since the specified document version.

**Parameters:**
- `sessionId`: ID of the lecture session
- `docversion`: Document version number (0 for all changes)

**Response:**
```json
{
  "changes": [
    {
      "change": "string (JSON-encoded ChangeSet)",
      "file_name": "string",
      "change_number": "number",
      "change_ts": "number (timestamp)"
    }
  ]
}
```

### Get Session Details
```http
GET /lecture-sessions/:sessionId
```
Returns detailed information about a specific lecture session.

**Parameters:**
- `sessionId`: ID of the lecture session

**Response:**
```json
{
  "id": "string",
  "name": "string",
  "createdAt": "string (ISO date)",
  "isFinished": "boolean"
}
```


## How to Read ChangeSet Examples

### Overview

Each array in the `ChangeSet` represents a single change operation. The structure is generally one of the following:


| Form                | Meaning                                 |
|---------------------|--------------------------------------------------|
| `[index, [offset, "char"]]` | Insert `"char"` at position `index` (offset `offset`) |
| `[[offset, "char"]]`        | Insert `"char"` at position 0 (offset `offset`)       |
| `[index, [offset]]`         | Possibly a deletion or cursor move at position `index` |
| `[[offset]]`                | Possibly a deletion or cursor move at position 0       |

---

### Examples

- `[[0,"@"]]` → Insert `"@"` at position 0.
- `[1,[0," "]]` → Insert `" "` at position 1 (offset 0).
- `[1,[1]]` → Possibly a deletion or cursor move at position 1.
- `[[1]]` → Possibly a deletion or cursor move at position 0.

---

### Notes

- The exact meaning of changes without a character (e.g., `[1, [1]]` or `[[1]]`) depends on the implementation in the replay logic.
- For more details, see the code that applies changes (typically using `ChangeSet.fromJSON` in CodeMirror).