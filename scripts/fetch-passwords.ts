import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchPasswords() {
  try {
    console.log('Fetching data from password table...\n');

    const { data, error } = await supabase
      .from('password')
      .select('*');

    if (error) {
      console.error('Error fetching passwords:', error);
      return;
    }

    console.log('Password table data:');
    console.log('===================\n');

    if (data && data.length > 0) {
      console.log(`Found ${data.length} record(s):\n`);
      data.forEach((record, index) => {
        console.log(`Record ${index + 1}:`);
        console.log(JSON.stringify(record, null, 2));
        console.log('-------------------\n');
      });
    } else {
      console.log('No records found in password table.');
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

fetchPasswords();
