const { createClient } = require('@supabase/supabase-js');
try {
  const supabase = createClient('http://localhost:9999', undefined);
  console.log("Success");
} catch (e) {
  console.log("Error:", e.message);
}
