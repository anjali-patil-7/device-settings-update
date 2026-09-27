# Safe Device Settings Update

## Overview
A lightweight, robust pure JavaScript module implementing safe updates to learning device settings (language and volume). The module strictly enforces validation ordering, actor authorization, strict request structure gating, optimistic concurrency control (version matching), and immutable state transitions.

## Stack
* Node.js
* JavaScript (CommonJS)
* Jest
* npm

## Installation
```bash
npm install
```

## Run tests
```bash
npm test
```

## Design choices
* **Authorization first**: Actor permissions (`role === 'editor'` and matching `siteId`) are validated before any payload or identity inspection to prevent unauthorized actors from probing record existence or state.
* **Strict request validation**: Only exact required top-level keys (`deviceId`, `expectedVersion`, `settings`) are permitted. Any unexpected keys, empty strings, invalid types, or missing fields immediately trigger a `422 INVALID_INPUT` response.
* **Settings whitelist**: Only known device settings (`language`, `volume`) are accepted. Allowed language codes (`en`, `hi`, `kn`) and volume ranges (integer 0–5) are strictly enforced against unexpected types or values.
* **Optimistic concurrency**: The incoming `expectedVersion` is compared to the current device version. Any mismatch yields `409 CONFLICT` without mutating state, safeguarding against race conditions and concurrent overwrites.
* **Immutable updates**: The function never mutates `current`, `actor`, or `request`. On successful update, a clean new record object with an incremented version is returned.
* **Partial settings merge**: Settings provided in the request update the record, while unmentioned settings retain their previous values intact.

## UI Save Flow
* **Accessible labels**: Form inputs for language and volume are paired with clear `<label>` elements and ARIA descriptors.
* **Keyboard usability**: All controls and the Save action are fully navigable and operable via standard keyboard interactions (`Tab`, `Space`, `Enter`).
* **Pending state**: When Save is triggered, the action button is disabled, and an accessible loading indicator informs the user that an update is in flight.
* **Validation errors**: Server validation errors (`422`) are mapped directly next to their respective form controls with clear corrective guidance.
* **Conflict recovery**: Upon receiving a `409 CONFLICT`, the UI informs the user that another staff member has updated the device and provides an action to reload latest data and review diffs before retrying.
* **Confirmed server state**: The UI maintains distinct state containers for confirmed server data versus local unsaved edits.
* **No unsaved values as saved**: Only after an HTTP `200` response with the updated record is received does the UI commit the new values to confirmed state and show a success confirmation.

## Time spent
Time spent: [REPLACE_WITH_ACTUAL_TIME_IN_MINUTES, e.g. 45] minutes

## Unfinished work
None for the requested scope.

## Known limitation
This module is an in-memory pure function designed for unit validation and optimistic concurrency control; it does not implement persistence transactions, distributed locking, or a real HTTP network server.

## AI / Documentation Usage
* **AI assistance**: Used Google AI Studio coding agent for scaffolding the pure function, implementing strict validation ordering, designing Jest test cases, and drafting documentation.
* **Documentation**: Referenced official Node.js docs for `Number.isInteger`, `Object.prototype.hasOwnProperty`, and Jest documentation for assertions.
* **Manual verification**: Manually inspected validation order precedence, confirmed immutability across success and error paths, tested status codes (200, 403, 404, 409, 422), verified partial settings preservation, and ran the automated Jest test suite.
