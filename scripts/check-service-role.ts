import dotenv from 'dotenv';
import path from 'path';

// Load env explicitly
const result = dotenv.config({ path: '.env.local' });

if (result.error) {
    console.error("Error loading .env.local:", result.error);
} else {
    console.log(".env.local loaded successfully.");
}

const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!key) {
    console.error("❌ SUPABASE_SERVICE_ROLE_KEY is MISSING in process.env");
} else {
    console.log(`✅ SUPABASE_SERVICE_ROLE_KEY is present (Length: ${key.length})`);
    console.log(`Prefix: ${key.substring(0, 10)}...`);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!url) {
    console.error("❌ NEXT_PUBLIC_SUPABASE_URL is MISSING");
} else {
    console.log(`✅ NEXT_PUBLIC_SUPABASE_URL is present: ${url}`);
}
