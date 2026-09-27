const { applyUpdate } = require('../src/applyUpdate');

describe('applyUpdate', () => {
  let baseCurrent;
  let baseActor;
  let baseRequest;

  beforeEach(() => {
    baseCurrent = {
      deviceId: 'D01',
      siteId: 'S01',
      version: 3,
      settings: {
        language: 'en',
        volume: 2
      }
    };

    baseActor = {
      siteId: 'S01',
      role: 'editor'
    };

    baseRequest = {
      deviceId: 'D01',
      expectedVersion: 3,
      settings: {
        volume: 4
      }
    };
  });

  // =========================================================================
  // Core Required Tests
  // =========================================================================
  describe('Core Assessment Requirements', () => {
    test('Test 1 — Successful partial update', () => {
      const result = applyUpdate(baseCurrent, baseActor, baseRequest);

      expect(result).toEqual({
        status: 200,
        record: {
          deviceId: 'D01',
          siteId: 'S01',
          version: 4,
          settings: {
            language: 'en',
            volume: 4
          }
        }
      });
      expect(result.status).toBe(200);
      expect(result.record.version).toBe(4);
      expect(result.record.settings.volume).toBe(4);
      expect(result.record.settings.language).toBe('en');
      expect(result.record.deviceId).toBe('D01');
      expect(result.record.siteId).toBe('S01');
    });

    test('Test 2 — Version conflict (optimistic concurrency)', () => {
      const requestWithStaleVersion = {
        deviceId: 'D01',
        expectedVersion: 2,
        settings: {
          volume: 4
        }
      };

      const currentSnapshot = structuredClone(baseCurrent);
      const result = applyUpdate(baseCurrent, baseActor, requestWithStaleVersion);

      expect(result).toEqual({
        status: 409,
        error: 'CONFLICT'
      });
      expect(baseCurrent).toEqual(currentSnapshot);
    });
  });

  // =========================================================================
  // Step 1: Permission Validation Tests
  // =========================================================================
  describe('Step 1 — Permission Validation', () => {
    test('rejects viewer role with 403 FORBIDDEN', () => {
      const viewerActor = { siteId: 'S01', role: 'viewer' };
      const result = applyUpdate(baseCurrent, viewerActor, baseRequest);

      expect(result).toEqual({
        status: 403,
        error: 'FORBIDDEN'
      });
    });

    test('rejects mismatched siteId with 403 FORBIDDEN', () => {
      const wrongSiteActor = { siteId: 'S02', role: 'editor' };
      const result = applyUpdate(baseCurrent, wrongSiteActor, baseRequest);

      expect(result).toEqual({
        status: 403,
        error: 'FORBIDDEN'
      });
    });

    test('rejects missing or malformed actor with 403 FORBIDDEN', () => {
      expect(applyUpdate(baseCurrent, null, baseRequest)).toEqual({
        status: 403,
        error: 'FORBIDDEN'
      });
      expect(applyUpdate(baseCurrent, {}, baseRequest)).toEqual({
        status: 403,
        error: 'FORBIDDEN'
      });
    });
  });

  // =========================================================================
  // Step 2: Request Structure Validation Tests
  // =========================================================================
  describe('Step 2 — Request Structure Validation', () => {
    test('rejects missing required top-level keys with 422 INVALID_INPUT', () => {
      const missingExpectedVersion = {
        deviceId: 'D01',
        settings: { volume: 3 }
      };
      expect(applyUpdate(baseCurrent, baseActor, missingExpectedVersion)).toEqual({
        status: 422,
        error: 'INVALID_INPUT'
      });

      const missingDeviceId = {
        expectedVersion: 3,
        settings: { volume: 3 }
      };
      expect(applyUpdate(baseCurrent, baseActor, missingDeviceId)).toEqual({
        status: 422,
        error: 'INVALID_INPUT'
      });

      const missingSettings = {
        deviceId: 'D01',
        expectedVersion: 3
      };
      expect(applyUpdate(baseCurrent, baseActor, missingSettings)).toEqual({
        status: 422,
        error: 'INVALID_INPUT'
      });
    });

    test('rejects unknown / extra top-level keys with 422 INVALID_INPUT', () => {
      const extraKeyRequest = {
        ...baseRequest,
        extraProperty: 'disallowed'
      };
      expect(applyUpdate(baseCurrent, baseActor, extraKeyRequest)).toEqual({
        status: 422,
        error: 'INVALID_INPUT'
      });
    });

    test('rejects empty or whitespace-only deviceId with 422 INVALID_INPUT', () => {
      expect(applyUpdate(baseCurrent, baseActor, { ...baseRequest, deviceId: '' })).toEqual({
        status: 422,
        error: 'INVALID_INPUT'
      });
      expect(applyUpdate(baseCurrent, baseActor, { ...baseRequest, deviceId: '   ' })).toEqual({
        status: 422,
        error: 'INVALID_INPUT'
      });
    });

    test('rejects non-string deviceId with 422 INVALID_INPUT', () => {
      expect(applyUpdate(baseCurrent, baseActor, { ...baseRequest, deviceId: 123 })).toEqual({
        status: 422,
        error: 'INVALID_INPUT'
      });
      expect(applyUpdate(baseCurrent, baseActor, { ...baseRequest, deviceId: null })).toEqual({
        status: 422,
        error: 'INVALID_INPUT'
      });
      expect(applyUpdate(baseCurrent, baseActor, { ...baseRequest, deviceId: true })).toEqual({
        status: 422,
        error: 'INVALID_INPUT'
      });
    });

    test('rejects invalid expectedVersion with 422 INVALID_INPUT', () => {
      const invalidVersions = [0, -1, 1.5, '3', true, false, null, undefined, NaN, Infinity];
      for (const invalidVersion of invalidVersions) {
        const result = applyUpdate(baseCurrent, baseActor, {
          ...baseRequest,
          expectedVersion: invalidVersion
        });
        expect(result).toEqual({
          status: 422,
          error: 'INVALID_INPUT'
        });
      }
    });

    test('rejects empty, null, or non-object settings with 422 INVALID_INPUT', () => {
      expect(applyUpdate(baseCurrent, baseActor, { ...baseRequest, settings: {} })).toEqual({
        status: 422,
        error: 'INVALID_INPUT'
      });
      expect(applyUpdate(baseCurrent, baseActor, { ...baseRequest, settings: null })).toEqual({
        status: 422,
        error: 'INVALID_INPUT'
      });
      expect(applyUpdate(baseCurrent, baseActor, { ...baseRequest, settings: [] })).toEqual({
        status: 422,
        error: 'INVALID_INPUT'
      });
      expect(applyUpdate(baseCurrent, baseActor, { ...baseRequest, settings: 'volume: 4' })).toEqual({
        status: 422,
        error: 'INVALID_INPUT'
      });
    });

    test('rejects invalid request types (null, undefined, array, string) safely with 422', () => {
      expect(applyUpdate(baseCurrent, baseActor, null)).toEqual({
        status: 422,
        error: 'INVALID_INPUT'
      });
      expect(applyUpdate(baseCurrent, baseActor, undefined)).toEqual({
        status: 422,
        error: 'INVALID_INPUT'
      });
      expect(applyUpdate(baseCurrent, baseActor, [])).toEqual({
        status: 422,
        error: 'INVALID_INPUT'
      });
      expect(applyUpdate(baseCurrent, baseActor, 'hello')).toEqual({
        status: 422,
        error: 'INVALID_INPUT'
      });
    });
  });

  // =========================================================================
  // Step 3: Settings Validation Tests
  // =========================================================================
  describe('Step 3 — Settings Validation', () => {
    test('rejects unknown settings keys with 422 INVALID_INPUT', () => {
      const requestWithUnknownSetting = {
        deviceId: 'D01',
        expectedVersion: 3,
        settings: {
          volume: 4,
          brightness: 80
        }
      };
      expect(applyUpdate(baseCurrent, baseActor, requestWithUnknownSetting)).toEqual({
        status: 422,
        error: 'INVALID_INPUT'
      });
    });

    test('accepts valid languages (en, hi, kn)', () => {
      for (const lang of ['en', 'hi', 'kn']) {
        const result = applyUpdate(baseCurrent, baseActor, {
          deviceId: 'D01',
          expectedVersion: 3,
          settings: { language: lang }
        });
        expect(result.status).toBe(200);
        expect(result.record.settings.language).toBe(lang);
        expect(result.record.settings.volume).toBe(2); // Preserved
      }
    });

    test('rejects invalid languages with 422 INVALID_INPUT', () => {
      const invalidLangs = ['fr', 'english', 'EN', true, null, 123, ''];
      for (const invalidLang of invalidLangs) {
        const result = applyUpdate(baseCurrent, baseActor, {
          deviceId: 'D01',
          expectedVersion: 3,
          settings: { language: invalidLang }
        });
        expect(result).toEqual({
          status: 422,
          error: 'INVALID_INPUT'
        });
      }
    });

    test('accepts valid boundary volume values (0 and 5)', () => {
      const minResult = applyUpdate(baseCurrent, baseActor, {
        deviceId: 'D01',
        expectedVersion: 3,
        settings: { volume: 0 }
      });
      expect(minResult.status).toBe(200);
      expect(minResult.record.settings.volume).toBe(0);

      const maxResult = applyUpdate(baseCurrent, baseActor, {
        deviceId: 'D01',
        expectedVersion: 3,
        settings: { volume: 5 }
      });
      expect(maxResult.status).toBe(200);
      expect(maxResult.record.settings.volume).toBe(5);
    });

    test('rejects invalid volume values with 422 INVALID_INPUT', () => {
      const invalidVolumes = [-1, 6, 2.5, '4', true, false, null, NaN, Infinity];
      for (const invalidVol of invalidVolumes) {
        const result = applyUpdate(baseCurrent, baseActor, {
          deviceId: 'D01',
          expectedVersion: 3,
          settings: { volume: invalidVol }
        });
        expect(result).toEqual({
          status: 422,
          error: 'INVALID_INPUT'
        });
      }
    });

    test('allows updating both language and volume simultaneously', () => {
      const result = applyUpdate(baseCurrent, baseActor, {
        deviceId: 'D01',
        expectedVersion: 3,
        settings: {
          language: 'hi',
          volume: 5
        }
      });
      expect(result).toEqual({
        status: 200,
        record: {
          deviceId: 'D01',
          siteId: 'S01',
          version: 4,
          settings: {
            language: 'hi',
            volume: 5
          }
        }
      });
    });
  });

  // =========================================================================
  // Step 4: Identity Validation Tests
  // =========================================================================
  describe('Step 4 — Identity and Version Validation', () => {
    test('returns 404 NOT_FOUND when deviceId does not match current record', () => {
      const wrongDeviceRequest = {
        deviceId: 'D99',
        expectedVersion: 3,
        settings: { volume: 4 }
      };
      const result = applyUpdate(baseCurrent, baseActor, wrongDeviceRequest);

      expect(result).toEqual({
        status: 404,
        error: 'NOT_FOUND'
      });
    });
  });

  // =========================================================================
  // Validation Ordering Verification
  // =========================================================================
  describe('Validation Order Enforcement', () => {
    test('permission failure takes precedence over invalid request structure', () => {
      const invalidActor = { siteId: 'S01', role: 'viewer' };
      const brokenRequest = { bad: 'data' };
      const result = applyUpdate(baseCurrent, invalidActor, brokenRequest);

      // Must fail permission first (403), not structure (422)
      expect(result).toEqual({
        status: 403,
        error: 'FORBIDDEN'
      });
    });

    test('request structure failure takes precedence over device identity mismatch', () => {
      const malformedWrongDevice = {
        deviceId: '   ', // invalid structure
        expectedVersion: 3,
        settings: { volume: 4 }
      };
      const result = applyUpdate(baseCurrent, baseActor, malformedWrongDevice);

      // Must fail structure first (422), not not_found (404)
      expect(result).toEqual({
        status: 422,
        error: 'INVALID_INPUT'
      });
    });

    test('settings validation failure takes precedence over device identity mismatch', () => {
      const invalidSettingsWrongDevice = {
        deviceId: 'D99', // wrong device
        expectedVersion: 3,
        settings: { volume: 99 } // invalid settings (step 3)
      };
      const result = applyUpdate(baseCurrent, baseActor, invalidSettingsWrongDevice);

      // Must fail settings validation first (422), not identity (404)
      expect(result).toEqual({
        status: 422,
        error: 'INVALID_INPUT'
      });
    });

    test('device identity mismatch takes precedence over version conflict', () => {
      const wrongDeviceWrongVersion = {
        deviceId: 'D99', // wrong device (step 4a)
        expectedVersion: 999, // wrong version (step 4b)
        settings: { volume: 4 }
      };
      const result = applyUpdate(baseCurrent, baseActor, wrongDeviceWrongVersion);

      // Must fail device identity first (404), not conflict (409)
      expect(result).toEqual({
        status: 404,
        error: 'NOT_FOUND'
      });
    });
  });

  // =========================================================================
  // Immutability Verification
  // =========================================================================
  describe('Immutability Guarantee', () => {
    test('never mutates current, actor, or request on successful update', () => {
      const currentSnapshot = structuredClone(baseCurrent);
      const actorSnapshot = structuredClone(baseActor);
      const requestSnapshot = structuredClone(baseRequest);

      const result = applyUpdate(baseCurrent, baseActor, baseRequest);

      expect(result.status).toBe(200);
      expect(baseCurrent).toEqual(currentSnapshot);
      expect(baseActor).toEqual(actorSnapshot);
      expect(baseRequest).toEqual(requestSnapshot);

      // Ensure returned record is a new reference
      expect(result.record).not.toBe(baseCurrent);
      expect(result.record.settings).not.toBe(baseCurrent.settings);
    });

    test('never mutates inputs on failed validation or conflict', () => {
      const currentSnapshot = structuredClone(baseCurrent);
      const actorSnapshot = structuredClone(baseActor);
      const conflictRequest = {
        deviceId: 'D01',
        expectedVersion: 1,
        settings: { volume: 5 }
      };
      const requestSnapshot = structuredClone(conflictRequest);

      const result = applyUpdate(baseCurrent, baseActor, conflictRequest);

      expect(result.status).toBe(409);
      expect(baseCurrent).toEqual(currentSnapshot);
      expect(baseActor).toEqual(actorSnapshot);
      expect(conflictRequest).toEqual(requestSnapshot);
    });
  });
});
