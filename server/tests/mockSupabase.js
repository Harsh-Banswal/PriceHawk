/**
 * In-memory Mock Supabase Client for testing Express routes and services.
 */

export function createMockSupabase() {
  const tables = {
    tracked_products: [],
    price_history: [],
    scrape_logs: [],
  };

  function createQuery(tableName) {
    if (!tables[tableName]) {
      tables[tableName] = [];
    }

    let items = [...tables[tableName]];
    let isSingle = false;
    let isUpsert = false;
    let isInsert = false;
    let isUpdate = false;
    let isDelete = false;
    let insertedRows = [];
    let updatePayload = null;

    const query = {
      select: () => query,
      eq: (column, value) => {
        items = items.filter((row) => row[column] === value);
        return query;
      },
      gte: (column, value) => {
        items = items.filter((row) => new Date(row[column]) >= new Date(value));
        return query;
      },
      lte: (column, value) => {
        items = items.filter((row) => new Date(row[column]) <= new Date(value));
        return query;
      },
      order: (column, { ascending = true } = {}) => {
        items.sort((a, b) => {
          if (a[column] < b[column]) return ascending ? -1 : 1;
          if (a[column] > b[column]) return ascending ? 1 : -1;
          return 0;
        });
        return query;
      },
      limit: (n) => {
        items = items.slice(0, n);
        return query;
      },
      single: () => {
        isSingle = true;
        return query;
      },
      insert: (rows) => {
        isInsert = true;
        const toInsert = Array.isArray(rows) ? rows : [rows];
        insertedRows = toInsert.map((row) => ({
          id: row.id || `mock-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          created_at: row.created_at || new Date().toISOString(),
          scraped_at: row.scraped_at || new Date().toISOString(),
          ...row,
        }));
        tables[tableName].push(...insertedRows);
        items = [...insertedRows];
        return query;
      },
      upsert: (payload, { onConflict } = {}) => {
        isUpsert = true;
        const row = Array.isArray(payload) ? payload[0] : payload;
        const conflictVal = onConflict ? row[onConflict] : null;
        const existingIdx = conflictVal
          ? tables[tableName].findIndex((r) => r[onConflict] === conflictVal)
          : -1;

        if (existingIdx >= 0) {
          tables[tableName][existingIdx] = {
            ...tables[tableName][existingIdx],
            ...row,
            updated_at: new Date().toISOString(),
          };
          items = [tables[tableName][existingIdx]];
        } else {
          const newRow = {
            id: row.id || `mock-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            created_at: new Date().toISOString(),
            ...row,
          };
          tables[tableName].push(newRow);
          items = [newRow];
        }
        return query;
      },
      update: (payload) => {
        isUpdate = true;
        updatePayload = payload;
        // Applied to matching items
        items = items.map((item) => {
          const idx = tables[tableName].findIndex((r) => r.id === item.id);
          if (idx >= 0) {
            tables[tableName][idx] = { ...tables[tableName][idx], ...payload };
            return tables[tableName][idx];
          }
          return { ...item, ...payload };
        });
        return query;
      },
      delete: () => {
        isDelete = true;
        const idsToDelete = new Set(items.map((i) => i.id));
        tables[tableName] = tables[tableName].filter((r) => !idsToDelete.has(r.id));
        return query;
      },
      then: (onfulfilled, onrejected) => {
        const result = {
          data: isSingle ? (items[0] || null) : items,
          error: null,
        };
        return Promise.resolve(result).then(onfulfilled, onrejected);
      },
    };

    return query;
  }

  return {
    from: (tableName) => createQuery(tableName),
    _tables: tables,
  };
}

export default createMockSupabase;
