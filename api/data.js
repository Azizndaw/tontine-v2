// Vercel Serverless Function: /api/data
export default async function handler(req, res) {
  // Configurer les en-têtes CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  // Si Supabase n'est pas encore configuré dans Vercel Env Vars
  if (!supabaseUrl || !supabaseKey) {
    if (req.method === 'GET') {
      return res.status(200).json({
        configured: false,
        participants: null,
        costs: null,
        _notice: "Variables SUPABASE_URL et SUPABASE_KEY non définies sur Vercel."
      });
    }
    return res.status(200).json({ configured: false, success: false });
  }

  const headers = {
    'Content-Type': 'application/json',
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
  };

  try {
    if (req.method === 'GET') {
      const response = await fetch(`${supabaseUrl}/rest/v1/tontine_store?id=eq.main&select=data`, {
        headers,
      });

      if (!response.ok) {
        throw new Error(`Erreur Supabase: ${response.statusText}`);
      }

      const rows = await response.json();
      if (rows && rows.length > 0 && rows[0].data) {
        return res.status(200).json(rows[0].data);
      } else {
        return res.status(200).json({ participants: [], costs: {} });
      }
    } else if (req.method === 'POST') {
      const payload = req.body;
      const response = await fetch(`${supabaseUrl}/rest/v1/tontine_store`, {
        method: 'POST',
        headers: {
          ...headers,
          'Prefer': 'resolution=merge-duplicates',
        },
        body: JSON.stringify([{
          id: 'main',
          data: payload,
          updated_at: new Date().toISOString()
        }]),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Erreur sauvegarde Supabase: ${errText}`);
      }

      return res.status(200).json({ success: true });
    } else {
      return res.status(405).json({ error: 'Méthode non autorisée' });
    }
  } catch (error) {
    console.error('Erreur API /api/data:', error);
    return res.status(500).json({ error: error.message });
  }
}
