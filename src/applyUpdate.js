/**
 * Safe Device Settings Update
 *
 * Safely updates device settings with strict validation ordering,
 * optimistic concurrency control, and immutable state transitions.
 *
 * @param {Object} current - Current persisted device state
 * @param {Object} actor - Authenticated actor performing the update
 * @param {Object} request - Incoming update request
 * @returns {Object} Result object with HTTP-style status and updated record or error
 */
function applyUpdate(current, actor, request) {
  // =========================================================================
  // STEP 1: Permission Validation
  // The actor is authorized only when BOTH conditions are true:
  // - actor.role === "editor"
  // - actor.siteId === current.siteId
  // =========================================================================
  if (
    !actor ||
    typeof actor !== 'object' ||
    actor.role !== 'editor' ||
    !current ||
    typeof current !== 'object' ||
    actor.siteId !== current.siteId
  ) {
    return {
      status: 403,
      error: 'FORBIDDEN'
    };
  }

  // =========================================================================
  // STEP 2: Request Structure Validation
  // The request must contain EXACTLY these top-level keys:
  // - deviceId
  // - expectedVersion
  // - settings
  // Missing, extra, or unknown keys must be rejected with 422.
  // =========================================================================
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    return {
      status: 422,
      error: 'INVALID_INPUT'
    };
  }

  const requestKeys = Object.keys(request);
  if (requestKeys.length !== 3) {
    return {
      status: 422,
      error: 'INVALID_INPUT'
    };
  }

  const requiredKeys = ['deviceId', 'expectedVersion', 'settings'];
  for (const key of requiredKeys) {
    if (!Object.prototype.hasOwnProperty.call(request, key)) {
      return {
        status: 422,
        error: 'INVALID_INPUT'
      };
    }
  }

  // deviceId: must be a non-empty string and not whitespace-only
  if (typeof request.deviceId !== 'string' || request.deviceId.trim() === '') {
    return {
      status: 422,
      error: 'INVALID_INPUT'
    };
  }

  // expectedVersion: must be a positive integer number (not boolean, not float, > 0)
  if (
    typeof request.expectedVersion !== 'number' ||
    !Number.isInteger(request.expectedVersion) ||
    request.expectedVersion <= 0
  ) {
    return {
      status: 422,
      error: 'INVALID_INPUT'
    };
  }

  // settings: must be an object, non-empty, not null, not an array
  if (
    !request.settings ||
    typeof request.settings !== 'object' ||
    Array.isArray(request.settings) ||
    Object.keys(request.settings).length === 0
  ) {
    return {
      status: 422,
      error: 'INVALID_INPUT'
    };
  }

  // =========================================================================
  // STEP 3: Settings Validation
  // Only 'language' and 'volume' are allowed.
  // =========================================================================
  const allowedSettings = ['language', 'volume'];
  const settingsKeys = Object.keys(request.settings);

  for (const key of settingsKeys) {
    if (!allowedSettings.includes(key)) {
      return {
        status: 422,
        error: 'INVALID_INPUT'
      };
    }
  }

  // Validate language if provided
  if (Object.prototype.hasOwnProperty.call(request.settings, 'language')) {
    const allowedLanguages = ['en', 'hi', 'kn'];
    if (!allowedLanguages.includes(request.settings.language)) {
      return {
        status: 422,
        error: 'INVALID_INPUT'
      };
    }
  }

  // Validate volume if provided
  if (Object.prototype.hasOwnProperty.call(request.settings, 'volume')) {
    const vol = request.settings.volume;
    if (
      typeof vol !== 'number' ||
      !Number.isInteger(vol) ||
      vol < 0 ||
      vol > 5
    ) {
      return {
        status: 422,
        error: 'INVALID_INPUT'
      };
    }
  }

  // =========================================================================
  // STEP 4: Identity and Version Validation
  // =========================================================================
  // Device identity check
  if (request.deviceId !== current.deviceId) {
    return {
      status: 404,
      error: 'NOT_FOUND'
    };
  }

  // Optimistic concurrency / version check
  if (request.expectedVersion !== current.version) {
    return {
      status: 409,
      error: 'CONFLICT'
    };
  }

  // =========================================================================
  // STEP 5: Successful Update (Immutable Merge)
  // =========================================================================
  const updatedRecord = {
    ...current,
    version: current.version + 1,
    settings: {
      ...current.settings,
      ...request.settings
    }
  };

  return {
    status: 200,
    record: updatedRecord
  };
}

module.exports = {
  applyUpdate
};
