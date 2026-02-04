// Usage: npx tsx scripts/mobile/test-ping.ts <valid_token>

async function runTest() {
    const token = process.argv[2]
    const baseUrl = 'http://localhost:3000/api/mobile/ping'

    console.log('🚀 Running Mobile Ping Tests...')

    // 1. Test 401 Unauthorized
    console.log('\nTesting 401 (Invalid Token)...')
    try {
        const resInvalid = await fetch(baseUrl, {
            headers: { 'Authorization': 'Bearer mb_invalid' }
        })
        console.log(`Status: ${resInvalid.status}`)
        const data = await resInvalid.json()
        if (resInvalid.status === 401 && data.error === 'Unauthorized') {
            console.log('✅ 401 Test Passed')
        } else {
            console.error('❌ 401 Test Failed', data)
        }
    } catch (e) {
        console.error('❌ 401 Test Request Error:', e)
    }

    // 2. Test 200 OK
    if (token) {
        console.log(`\nTesting 200 (Valid Token: ${token.substring(0, 10)}...)...`)
        try {
            const resValid = await fetch(baseUrl, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            console.log(`Status: ${resValid.status}`)
            const data = await resValid.json()
            if (resValid.status === 200 && data.ok === true && data.company_id) {
                console.log('✅ 200 Test Passed')
                console.log('Response:', JSON.stringify(data, null, 2))
            } else {
                console.error('❌ 200 Test Failed', data)
            }
        } catch (e) {
            console.error('❌ 200 Test Request Error:', e)
        }
    } else {
        console.log('\n⚠️ Skipping 200 test (no valid token provided)')
    }
}

runTest()
