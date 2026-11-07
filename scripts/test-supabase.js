const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jzpgknlbroofetpwsicp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp6cGdrbmxicm9vZmV0cHdzaWNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1NDYyOTAsImV4cCI6MjEwOTEyMjI5MH0.qpDiFItDQshyvmxnXTChBpjK4DsyOeB6ZOEs2hU7z1A';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log('Testing connection to Supabase...');
  
  // 1. Check properties
  const { data: properties, error: propErr } = await supabase.from('properties').select('*');
  console.log('Properties:', { count: properties?.length, error: propErr?.message || null });

  // 2. Check landlords
  const { data: landlords, error: landErr } = await supabase.from('landlords').select('*');
  console.log('Landlords:', { count: landlords?.length, error: landErr?.message || null });

  // 3. Check units
  const { data: units, error: unitErr } = await supabase.from('units').select('*');
  console.log('Units:', { count: units?.length, error: unitErr?.message || null });

  // 4. Check invoices
  const { data: invoices, error: invErr } = await supabase.from('invoices').select('*');
  console.log('Invoices:', { count: invoices?.length, error: invErr?.message || null });

  // 5. Check transactions
  const { data: transactions, error: txErr } = await supabase.from('transactions').select('*');
  console.log('Transactions:', { count: transactions?.length, error: txErr?.message || null });

  // 6. Check property_balances view
  const { data: balances, error: balErr } = await supabase.from('property_balances').select('*');
  console.log('Property Balances View:', { count: balances?.length, error: balErr?.message || null });

  // 7. Check storage buckets
  const { data: buckets, error: bucketErr } = await supabase.storage.listBuckets();
  console.log('Storage Buckets:', { buckets: buckets?.map(b => b.name), error: bucketErr?.message || null });
}

test().catch(console.error);
