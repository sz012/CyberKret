import assert from 'node:assert/strict'
import { test } from 'node:test'
import { makeTimeline, sceneAt } from '../src/demo/timeline.ts'

test('the silent presentation lasts 96 seconds and includes the whole opening film', () => {
  const timeline = makeTimeline()
  assert.equal(timeline[0].end, 18)
  assert.equal(timeline.at(-1)?.end, 96)
  assert.equal(sceneAt(16.8, timeline), 0)
  assert.equal(sceneAt(18, timeline), 1)
  assert.equal(sceneAt(96, timeline), 6)
})

test('a longer voiceover extends its scene and shifts later scenes without gaps', () => {
  const timeline = makeTimeline({ 1: 19.5, 4: 24 })
  assert.equal(timeline[1].duration, 20.5)
  assert.equal(timeline[2].start, 38.5)
  assert.equal(timeline[4].duration, 25)
  for (let index = 1; index < timeline.length; index++) {
    assert.equal(timeline[index].start, timeline[index - 1].end)
    assert.equal(sceneAt(timeline[index].start - 0.01, timeline), index - 1)
    assert.equal(sceneAt(timeline[index].start, timeline), index)
  }
})

test('short clips leave time to read the scene', () => {
  assert.deepEqual(makeTimeline({ 1: 4, 6: 2 }), makeTimeline())
})
