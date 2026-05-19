require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static('../frontend/public'));

const limiter = rateLimit({ windowMs: 60_000, max: 100, message: { error: 'Muitas requisições. Aguarde 1 minuto.' } });
app.use('/api/', limiter);

// ─── Pool dinâmico por requisição ─────────────────────────────────────────────
function createPool(config) {
  return new Pool({
    host:     config.host     || 'localhost',
    port:     parseInt(config.port) || 5432,
    user:     config.user     || 'postgres',
    password: config.password || '',
    database: config.database || 'postgres',
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
    max: 3,
  });
}

// ─── Validação e sanitização ───────────────────────────────────────────────────
function sanitizeIdentifier(name) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(`Identificador inválido: "${name}"`);
  }
  return name;
}

function buildSearchQuery(table, columns, searchTerm, searchType) {
  const safeTable = sanitizeIdentifier(table);
  const safeCols  = columns.map(sanitizeIdentifier);

  let cleanTerm = searchTerm.trim();

  // Normaliza CPF/CNPJ removendo máscara para busca mais abrangente
  const onlyDigits = cleanTerm.replace(/\D/g, '');

  const conditions = [];
  const params     = [];

  safeCols.forEach((col) => {
    if (searchType === 'exact') {
      params.push(cleanTerm);
      conditions.push(`CAST(${col} AS TEXT) = $${params.length}`);
      if (onlyDigits && onlyDigits !== cleanTerm) {
        params.push(onlyDigits);
        conditions.push(`CAST(${col} AS TEXT) = $${params.length}`);
      }
    } else {
      params.push(`%${cleanTerm}%`);
      conditions.push(`CAST(${col} AS TEXT) ILIKE $${params.length}`);
      if (onlyDigits && onlyDigits !== cleanTerm) {
        params.push(`%${onlyDigits}%`);
        conditions.push(`CAST(${col} AS TEXT) ILIKE $${params.length}`);
      }
    }
  });

  const where = conditions.join(' OR ');
  const sql   = `SELECT * FROM ${safeTable} WHERE ${where} LIMIT 500`;

  return { sql, params };
}

// ─── Rotas ────────────────────────────────────────────────────────────────────

/** POST /api/connect — testa conexão e retorna tabelas + colunas */
app.post('/api/connect', async (req, res) => {
  const { host, port, user, password, database } = req.body;

  if (!host || !user || !database) {
    return res.status(400).json({ error: 'host, user e database são obrigatórios.' });
  }

  const pool = createPool({ host, port, user, password, database });
  try {
    await pool.query('SELECT 1');

    const tablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const tables = {};
    for (const row of tablesResult.rows) {
      const t = row.table_name;
      const colResult = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `, [t]);
      tables[t] = colResult.rows.map(r => ({ name: r.column_name, type: r.data_type }));
    }

    res.json({ success: true, database, tables });
  } catch (err) {
    res.status(400).json({ error: `Falha na conexão: ${err.message}` });
  } finally {
    await pool.end().catch(() => {});
  }
});

/** POST /api/search — pesquisa nos dados */
app.post('/api/search', async (req, res) => {
  const { connection, table, columns, searchTerm, searchType = 'like' } = req.body;

  if (!connection || !table || !columns?.length || !searchTerm) {
    return res.status(400).json({ error: 'Parâmetros incompletos.' });
  }
  if (searchTerm.length < 2) {
    return res.status(400).json({ error: 'Termo de busca deve ter ao menos 2 caracteres.' });
  }

  const pool = createPool(connection);
  try {
    const { sql, params } = buildSearchQuery(table, columns, searchTerm, searchType);
    const result = await pool.query(sql, params);
    res.json({ rows: result.rows, total: result.rowCount, sql: sql.replace(/\s+/g, ' ') });
  } catch (err) {
    res.status(400).json({ error: err.message });
  } finally {
    await pool.end().catch(() => {});
  }
});

/** POST /api/query — query SQL livre (somente SELECT) */
app.post('/api/query', async (req, res) => {
  const { connection, sql } = req.body;

  if (!connection || !sql) {
    return res.status(400).json({ error: 'Parâmetros incompletos.' });
  }

  const trimmed = sql.trim().toUpperCase();
  const allowed = ['SELECT', 'WITH', 'EXPLAIN'];
  if (!allowed.some(kw => trimmed.startsWith(kw))) {
    return res.status(403).json({ error: 'Apenas consultas SELECT / WITH / EXPLAIN são permitidas.' });
  }

  const pool = createPool(connection);
  try {
    const result = await pool.query(sql);
    res.json({ rows: result.rows, total: result.rowCount });
  } catch (err) {
    res.status(400).json({ error: err.message });
  } finally {
    await pool.end().catch(() => {});
  }
});

/** GET /api/health */
app.get('/api/health', (_, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

app.listen(PORT, () => console.log(`🚀 DB Explorer rodando em http://localhost:${PORT}`));
