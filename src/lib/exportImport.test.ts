import { test, expect } from 'vitest'
import {
  bumpSemver,
  compareSemver,
  createSnapshot,
  importCharacter,
  parseCharacterJSON,
  parseSemver,
  resolveUpdatedVersion,
  restoreFromSnapshot,
  serializeSemver,
  updateExistingCharacterFromImport,
  versionedFilename,
} from '@/lib/exportImport'
import { createDefaultCharacter } from '@/constants/gameData'
import type { VersionSnapshot } from '@/types'

// ---- versionedFilename ----------------------------------------------------------------

test('versionedFilename: basic semver', () => {
  expect(versionedFilename('Nacht', '1.0.0')).toBe('Nacht v1.0.0.json')
  expect(versionedFilename('Aria', '3.2.1')).toBe('Aria v3.2.1.json')
})

test('versionedFilename: sanitizes special characters in name', () => {
  expect(versionedFilename('Test/Char:Name', '2.0.0')).toBe('Test_Char_Name v2.0.0.json')
  expect(versionedFilename('Char<>Name', '5.0.0')).toBe('Char__Name v5.0.0.json')
})

test('versionedFilename: trims whitespace on name and version', () => {
  expect(versionedFilename('  Nacht  ', '1.0.0')).toBe('Nacht v1.0.0.json')
  expect(versionedFilename('Nacht', '  9.1.2  ')).toBe('Nacht v9.1.2.json')
})

test('versionedFilename: preserves dots and dashes in name', () => {
  expect(versionedFilename('Dr. Strange', '1.0.0')).toBe('Dr. Strange v1.0.0.json')
  expect(versionedFilename('Jean-Luc', '2.0.0')).toBe('Jean-Luc v2.0.0.json')
})

// ---- parseSemver / serializeSemver ---------------------------------------------------

test('validateSemver: accepts strict MAJOR.MINOR.PATCH', () => {
  expect(serializeSemver('1.0.0')).toBe('1.0.0')
  expect(serializeSemver('9.1.2')).toBe('9.1.2')
  expect(serializeSemver('  10.20.30  ')).toBe('10.20.30')
})

test('validateSemver: accepts and normalizes legacy numeric shorthand', () => {
  // Numeric-only inputs are accepted and expanded to MAJOR.0.0.
  // This avoids breaking the export dialog for characters that were saved
  // with the old numeric format.
  expect(serializeSemver('1')).toBe('1.0.0')
  expect(serializeSemver('5')).toBe('5.0.0')
})

test('validateSemver: rejects malformed input', () => {
  expect(serializeSemver('')).toBeNull()
  expect(serializeSemver('1.0')).toBeNull()
  expect(serializeSemver('1.0.0.0')).toBeNull()
  expect(serializeSemver('9. 1.2')).toBeNull()
  expect(serializeSemver('abc')).toBeNull()
  expect(serializeSemver('1.two.3')).toBeNull()
})

test('validateSemver: tolerates surrounding whitespace', () => {
  expect(serializeSemver('  1.0.0  ')).toBe('1.0.0')
  expect(serializeSemver('\t9.1.2\n')).toBe('9.1.2')
})

test('parseSemver: returns components for valid input', () => {
  expect(parseSemver('9.1.2')).toEqual({ major: 9, minor: 1, patch: 2 })
  expect(parseSemver('10.20.30')).toEqual({ major: 10, minor: 20, patch: 30 })
})

test('parseSemver: handles legacy numeric-only values', () => {
  // Old characters stored version as a plain number. Parsing them should
  // not throw; they become MAJOR.0.0.
  expect(parseSemver('1')).toEqual({ major: 1, minor: 0, patch: 0 })
  expect(parseSemver(1 as unknown as string)).toEqual({ major: 1, minor: 0, patch: 0 })
  expect(parseSemver('5')).toEqual({ major: 5, minor: 0, patch: 0 })
})

test('parseSemver: returns null for invalid input', () => {
  expect(parseSemver('1.0')).toBeNull()
  expect(parseSemver('foo')).toBeNull()
})

test('bumpSemver: bumps from legacy numeric format', () => {
  expect(bumpSemver('1')).toBe('1.0.1')
  expect(bumpSemver('5')).toBe('5.0.1')
  expect(bumpSemver('5', 'minor')).toBe('5.1.0')
})

// ---- bumpSemver ------------------------------------------------------------------------

test('bumpSemver: defaults to patch increment', () => {
  expect(bumpSemver('1.0.0')).toBe('1.0.1')
  expect(bumpSemver('9.1.2')).toBe('9.1.3')
})

test('bumpSemver: respects level argument', () => {
  expect(bumpSemver('1.0.0', 'minor')).toBe('1.1.0')
  expect(bumpSemver('1.0.0', 'major')).toBe('2.0.0')
  expect(bumpSemver('1.2.3', 'minor')).toBe('1.3.0')
  expect(bumpSemver('9.1.2', 'major')).toBe('10.0.0')
})

test('bumpSemver: handles large version numbers', () => {
  expect(bumpSemver('999.0.0', 'major')).toBe('1000.0.0')
  expect(bumpSemver('0.0.0')).toBe('0.0.1')
})

// ---- compareSemver ----------------------------------------------------------------

test('compareSemver: equal versions return 0', () => {
  expect(compareSemver('1.0.0', '1.0.0')).toBe(0)
  expect(compareSemver('5.2.3', '5.2.3')).toBe(0)
})

test('compareSemver: compares major', () => {
  expect(compareSemver('2.0.0', '1.0.0')).toBeGreaterThan(0)
  expect(compareSemver('1.0.0', '2.0.0')).toBeLessThan(0)
})

test('compareSemver: compares minor when major equal', () => {
  expect(compareSemver('1.2.0', '1.1.0')).toBeGreaterThan(0)
  expect(compareSemver('1.1.0', '1.2.0')).toBeLessThan(0)
})

test('compareSemver: compares patch when major/minor equal', () => {
  expect(compareSemver('1.1.3', '1.1.2')).toBeGreaterThan(0)
  expect(compareSemver('1.1.2', '1.1.3')).toBeLessThan(0)
})

test('compareSemver: treats invalid as 0.0.0', () => {
  expect(compareSemver('', '1.0.0')).toBeLessThan(0)
  expect(compareSemver('1.0.0', '')).toBeGreaterThan(0)
})

// ---- resolveUpdatedVersion ----------------------------------------------------

test('resolveUpdatedVersion: uses imported version when newer', () => {
  expect(resolveUpdatedVersion('1.0.0', '1.2.0')).toBe('1.2.0')
  expect(resolveUpdatedVersion('1.0.0', '2.0.0')).toBe('2.0.0')
})

test('resolveUpdatedVersion: bumps existing version when imported older', () => {
  expect(resolveUpdatedVersion('1.5.0', '1.2.0')).toBe('1.5.1')
})

test('resolveUpdatedVersion: bumps existing version when versions equal', () => {
  expect(resolveUpdatedVersion('1.0.0', '1.0.0')).toBe('1.0.1')
})

// ---- Character serialization roundtrip --------------------------------------------

test('parseCharacterJSON: valid JSON returns character', () => {
  const char = createDefaultCharacter()
  char.name = 'Test Hero'
  const json = JSON.stringify(char)
  const parsed = parseCharacterJSON(json)
  expect(parsed.name).toBe('Test Hero')
  expect(parsed.id).toBe(char.id)
})

test('parseCharacterJSON: rejects JSON with numeric version (legacy shape)', () => {
  // The shape check requires `version` to be a string, so legacy exports
  // with numeric versions are rejected.
  const json = JSON.stringify({
    id: 'x',
    name: 'Legacy',
    version: 1,
    milestones: 0,
    attributes: {},
    skills: {},
    config: {},
  })
  expect(() => parseCharacterJSON(json)).toThrow(/missing required fields/i)
})

test('parseCharacterJSON: valid JSON with string version passes shape check', () => {
  const json = JSON.stringify({
    id: 'x',
    name: 'Modern',
    version: '1.0.0',
    milestones: 0,
    attributes: {},
    skills: {},
    config: {},
  })
  expect(() => parseCharacterJSON(json)).not.toThrow()
})

test('parseCharacterJSON: invalid JSON throws', () => {
  expect(() => parseCharacterJSON('not json')).toThrow()
})

test('parseCharacterJSON: missing required fields throws', () => {
  expect(() => parseCharacterJSON('{"foo":"bar"}')).toThrow(/missing required fields/i)
})

test('importCharacter: assigns fresh id', () => {
  const char = createDefaultCharacter()
  const originalId = char.id
  const json = JSON.stringify(char)
  const imported = importCharacter(json)
  expect(imported.id).not.toBe(originalId)
  expect(imported.name).toBe(char.name)
})

test('importCharacter: imported character preserves version string', () => {
  const char = createDefaultCharacter()
  char.name = 'Imported Hero'
  char.version = '9.1.2'
  char.milestones = 5
  const imported = importCharacter(JSON.stringify(char))
  expect(imported.version).toBe('9.1.2')
  expect(imported.milestones).toBe(5)
  expect(imported.attributes).toEqual(char.attributes)
  expect(imported.skills).toEqual(char.skills)
})

// ---- createSnapshot --------------------------------------------------------------------

test('createSnapshot: captures character version string at a point in time', () => {
  const char = createDefaultCharacter()
  char.name = 'Snapshot Test'
  char.version = '3.2.1'
  const snap = createSnapshot(char)
  expect(snap.characterId).toBe(char.id)
  expect(snap.version).toBe('3.2.1')
  expect(snap.data.name).toBe('Snapshot Test')
  expect(snap.id).toBeTruthy()
  expect(snap.createdAt).toBeTruthy()
})

test('createSnapshot: snapshot is a deep clone (not mutated by later changes)', () => {
  const char = createDefaultCharacter()
  char.name = 'Original'
  const snap = createSnapshot(char)
  // Mutate the original after snapshot
  char.name = 'Changed'
  expect(snap.data.name).toBe('Original')
})

// ---- restoreFromSnapshot ---------------------------------------------------------------

test('restoreFromSnapshot: bumps patch version and preserves data', () => {
  const char = createDefaultCharacter()
  char.name = 'Version 2 Char'
  char.version = '2.0.5'

  const snap: VersionSnapshot = {
    id: 'snap-1',
    characterId: char.id,
    version: '2.0.5',
    createdAt: new Date().toISOString(),
    data: structuredClone(char),
  }

  const restored = restoreFromSnapshot(snap)
  expect(restored.version).toBe('2.0.6') // patch bump
  expect(restored.name).toBe('Version 2 Char')
  expect(restored.updatedAt).toBeTruthy()
})

test('restoreFromSnapshot: bumps patch across minor/major boundaries', () => {
  const char = createDefaultCharacter()
  char.name = 'Boundary Char'

  const snap: VersionSnapshot = {
    id: 'snap-1',
    characterId: char.id,
    version: '1.9.9',
    createdAt: new Date().toISOString(),
    data: structuredClone(char),
  }

  const restored = restoreFromSnapshot(snap)
  expect(restored.version).toBe('1.9.10') // patch bump, not 2.0.0
})

test('restoreFromSnapshot: deep-clones snapshot data', () => {
  const char = createDefaultCharacter()
  char.name = 'Original'

  const snap: VersionSnapshot = {
    id: 'snap-1',
    characterId: char.id,
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    data: structuredClone(char),
  }

  const restored = restoreFromSnapshot(snap)
  restored.name = 'Changed'
  expect(snap.data.name).toBe('Original')
})

// ---- updateExistingCharacterFromImport ---------------------------------------------

test('updateExistingCharacterFromImport: preserves id, name, and live-play state', () => {
  const existing = createDefaultCharacter()
  existing.name = 'Nacht'
  existing.id = 'persist-this-id'
  existing.playerName = 'Lucas'
  existing.version = '1.0.0'
  existing.currentHP = 5
  existing.currentEND = 3
  existing.currentAP = 2
  existing.currentFP = 1
  existing.tempHP = 4
  existing.mortalWounds = ['Sprain', null]
  existing.deathSaves = { successes: 1, failures: 2 }

  const imported = createDefaultCharacter()
  imported.version = '1.2.0'
  imported.attributes = { ...imported.attributes, POW: 8 }
  imported.skills = { ...imported.skills, Sneak: 6 }
  imported.backstory = 'Updated lore'

  const updated = updateExistingCharacterFromImport(
    existing,
    JSON.stringify(imported),
  )

  // Preserved from existing:
  expect(updated.id).toBe('persist-this-id')
  expect(updated.name).toBe('Nacht')
  expect(updated.playerName).toBe('Lucas')
  expect(updated.currentHP).toBe(5)
  expect(updated.currentEND).toBe(3)
  expect(updated.currentAP).toBe(2)
  expect(updated.currentFP).toBe(1)
  expect(updated.tempHP).toBe(4)
  expect(updated.mortalWounds).toEqual(['Sprain', null])
  expect(updated.deathSaves).toEqual({ successes: 1, failures: 2 })

  // Taken from imported:
  expect(updated.attributes.POW).toBe(8)
  expect(updated.skills.Sneak).toBe(6)
  expect(updated.backstory).toBe('Updated lore')

  // Version resolves to imported (newer):
  expect(updated.version).toBe('1.2.0')
})

test('updateExistingCharacterFromImport: bumps existing version when imported older', () => {
  const existing = createDefaultCharacter()
  existing.version = '2.0.0'

  const imported = createDefaultCharacter()
  imported.version = '1.5.0'

  const updated = updateExistingCharacterFromImport(
    existing,
    JSON.stringify(imported),
  )
  expect(updated.version).toBe('2.0.1')
})

test('updateExistingCharacterFromImport: bumps existing version when versions equal', () => {
  const existing = createDefaultCharacter()
  existing.version = '3.0.0'

  const imported = createDefaultCharacter()
  imported.version = '3.0.0'

  const updated = updateExistingCharacterFromImport(
    existing,
    JSON.stringify(imported),
  )
  expect(updated.version).toBe('3.0.1')
})

test('updateExistingCharacterFromImport: sets updatedAt fresh', () => {
  const existing = createDefaultCharacter()
  existing.updatedAt = '2020-01-01T00:00:00.000Z'
  const imported = createDefaultCharacter()
  imported.version = '5.0.0'

  const updated = updateExistingCharacterFromImport(
    existing,
    JSON.stringify(imported),
  )
  expect(updated.updatedAt).not.toBe('2020-01-01T00:00:00.000Z')
})
