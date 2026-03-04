/**
 * Test new pipelines
 */

const pipeline = require('./src/core/pipeline')
const gateway = require('./src/core/gateway')

async function testBrandAssetKit() {
  console.log('\n=== Testing Brand Asset Kit ===')

  // Initialize gateway
  await gateway.refreshTools()

  const def = pipeline.getPipeline('brand-asset-kit')
  console.log('Pipeline definition:', JSON.stringify(def, null, 2))

  // Test with a sample image
  const result = await pipeline.execute(def, {
    url: 'https://via.placeholder.com/512x512.png',
    projectName: 'test-brand'
  })

  console.log('\nResult:', JSON.stringify(result, null, 2))
}

async function testVideoLearningComplete() {
  console.log('\n=== Testing Video Learning Complete ===')

  const def = pipeline.getPipeline('video-learning-complete')
  console.log('Pipeline definition:', JSON.stringify(def, null, 2))

  // This would need a real YouTube URL and would take a while
  console.log('\nSkipping execution (requires real video URL and takes minutes)')
}

async function main() {
  try {
    await testBrandAssetKit()
    await testVideoLearningComplete()
    console.log('\n✅ Pipeline tests complete')
  } catch (err) {
    console.error('\n❌ Test failed:', err)
    process.exit(1)
  }
}

main()
