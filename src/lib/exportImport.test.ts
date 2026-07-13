import { test, expect } from 'vitest'
import {
  versionedFilename,
  parseCharacterJSON,
  importCharacter,
  createSnapshot,
  restoreFromSnapshot,
} from '@/lib/exportImport'
import { createDefaultCharacter } from '@/constants/gameData'
import type { VersionSnapshot } from '@/types'

test('versionedFilename: basic name', () => {
  expect(versionedFilename('Nacht', 1)).toBe('Nacht v1.json')
  expect(versionedFilename('Aria', 3)).toBe('Aria v3.json')
})

test('versionedFilename: sanitizes special characters', () => {
  expect(versionedFilename('Test/Char:Name', 2)).toBe('Test_Char_Name v2.json')
  expect(versionedFilename('Char<>Name', 5)).toBe('Char__Name v5.json')
})

test('versionedFilename: trims whitespace', () => {
  expect(versionedFilename('  Nacht  ', 1)).toBe('Nacht v1.json')
})

test('versionedFilename: preserves dots and dashes', () => {
  expect(versionedFilename('Dr. Strange', 1)).toBe('Dr. Strange v1.json')
  expect(versionedFilename('Jean-Luc', 2)).toBe('Jean-Luc v2.json')
})

test('parseCharacterJSON: valid JSON returns character', () => {
  const char = createDefaultCharacter()
  char.name = 'Test Hero'
  const json = JSON.stringify(char)
  const parsed = parseCharacterJSON(json)
  expect(parsed.name).toBe('Test Hero')
  expect(parsed.id).toBe(char.id)
})

test('parseCharacterJSON: invalid JSON throws', () => {
  expect(() => parseCharacterJSON('not json')).toThrow()
})

test('parseCharacterJSON: missing required fields throws', () => {
  expect(() => parseCharacterJSON('{"foo":"bar"}')).toThrow(
    /missing required fields/i,
  )
})

test('importCharacter: assigns fresh id', () => {
  const char = createDefaultCharacter()
  const originalId = char.id
  const json = JSON.stringify(char)
  const imported = importCharacter(json)
  expect(imported.id).not.toBe(originalId)
  expect(imported.name).toBe(char.name)
})

test('importCharacter: imported character has all fields', () => {
  const char = createDefaultCharacter()
  char.name = 'Imported Hero'
  char.milestones = 5
  const imported = importCharacter(JSON.stringify(char))
  expect(imported.milestones).toBe(5)
  expect(imported.attributes).toEqual(char.attributes)
  expect(imported.skills).toEqual(char.skills)
})

test('createSnapshot: captures character data at a point in time', () => {
  const char = createDefaultCharacter()
  char.name = 'Snapshot Test'
  char.version = 3
  const snap = createSnapshot(char)
  expect(snap.characterId).toBe(char.id)
  expect(snap.version).toBe(3)
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

test('restoreFromSnapshot: bumps version and preserves data', () => {
  const char = createDefaultCharacter()
  char.name = 'Version 2 Char'
  char.version = 2

  const snap: VersionSnapshot = {
    id: 'snap-1',
    characterId: char.id,
    version: 2,
    createdAt: new Date().toISOString(),
    data: structuredClone(char),
  }

  const restored = restoreFromSnapshot(snap)
  expect(restored.version).toBe(3) // snapshot.version + 1
  expect(restored.name).toBe('Version 2 Char')
  expect(restored.updatedAt).toBeTruthy()
})

test('restoreFromSnapshot: deep-clones snapshot data', () => {
  const char = createDefaultCharacter()
  char.name = 'Original'

  const snap: VersionSnapshot = {
    id: 'snap-1',
    characterId: char.id,
    version: 1,
    createdAt: new Date().toISOString(),
    data: structuredClone(char),
  }

  const restored = restoreFromSnapshot(snap)
  restored.name = 'Changed'
  expect(snap.data.name).toBe('Original')
})
