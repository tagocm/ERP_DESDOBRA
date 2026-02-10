import fs from 'fs';
import path from 'path';

console.log('--- Env Diagnostic ---');

const envLocalPath = path.resolve(process.cwd(), '.env.local');
const hasEnvLocal = fs.existsSync(envLocalPath);

console.log(`.env.local exists: ${hasEnvLocal}`);

function checkVar(name: string) {
    const value = process.env[name];
    const exists = !!value;
    let invalid = false;

    if (name.endsWith('_URL') && exists) {
        if (!value?.startsWith('http')) {
            invalid = true;
        }
    }

    console.log(`${name}: ${exists ? 'Present' : 'Missing'} ${invalid ? '[INVALID format]' : ''}`);
}

// Load env from .env.local manually if needed, but usually next loads it. 
// However for this script running via tsx, we might need dotenv if we want to see them without next.
// But the user constraint was 'validate presence', assuming running in a context where they are loaded 
// OR checking the file content if acceptable.
// Given security constraints, let's look for them in process.env (assuming user runs with dotenv or similar if local)
// OR simpler: just parse the file to see if keys exist, avoiding printing values.

if (hasEnvLocal) {
    const content = fs.readFileSync(envLocalPath, 'utf8');
    const lines = content.split('\n');
    const keys = new Set<string>();
    for (const line of lines) {
        const match = line.match(/^([A-Z_]+)=/);
        if (match) {
            keys.add(match[1]);
        }
    }

    const criticalVars = [
        'NEXT_PUBLIC_SUPABASE_URL',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        'SUPABASE_SERVICE_ROLE_KEY',
        'INTERNAL_API_TOKEN',
        'NODE_ENV'
    ];
    for (const v of criticalVars) {
        const presentInFile = keys.has(v);
        console.log(`${v}: ${presentInFile ? 'Defined in .env.local' : 'Not found in .env.local'}`);
    }
} else {
    console.log('Skipping variable check because .env.local is missing.');
}

console.log('----------------------');
