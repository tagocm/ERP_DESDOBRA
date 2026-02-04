import { processMobileExpenseInbox } from '@/lib/mobile/processor'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

function parseArgs(argv: string[]) {
    const args = new Map<string, string | boolean>()
    for (let i = 0; i < argv.length; i++) {
        const token = argv[i]
        if (!token.startsWith('--')) continue
        const key = token.slice(2)
        const next = argv[i + 1]
        if (!next || next.startsWith('--')) {
            args.set(key, true)
        } else {
            args.set(key, next)
            i++
        }
    }
    return args
}

async function main() {
    const args = parseArgs(process.argv.slice(2))

    const limitRaw = args.get('limit')
    const limit = typeof limitRaw === 'string' ? Number(limitRaw) : undefined
    const companyId = typeof args.get('company') === 'string' ? (args.get('company') as string) : undefined
    const dryRun = args.get('dry-run') === true

    const result = await processMobileExpenseInbox({
        limit: Number.isFinite(limit) ? limit : undefined,
        companyId,
        dryRun,
    })

    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ ok: true, result }, null, 2))
}

main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err)
    process.exitCode = 1
})
