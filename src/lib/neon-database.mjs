// Server-side SQL adapter for the small query surface used by MenuPro's BFF.
// Values are always parameters; identifiers are validated and quoted.
const identifier = value => {
  if (!/^[a-z_][a-z0-9_]*$/.test(value)) throw new Error('Invalid SQL identifier');
  return '"' + value + '"';
};
const tableName = value => {
  if (!value.startsWith('menupro_')) throw new Error('Only MenuPro objects are allowed');
  return 'public.' + identifier(value);
};
const relations = {
  'menupro_menus:menupro_menu_sections': { key: 'menu_id', many: true },
  'menupro_menu_sections:menupro_menu_items': { key: 'section_id', many: true },
  'menupro_operational_alerts:menupro_operational_incidents': { key: 'incident_id', many: false },
};
export function splitFields(text) {
  let depth = 0, start = 0; const fields = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '(') depth++;
    if (text[i] === ')') depth--;
    if (depth < 0) throw new Error('Invalid field expression');
    if (text[i] === ',' && depth === 0) { fields.push(text.slice(start, i)); start = i + 1; }
  }
  if (depth !== 0) throw new Error('Invalid field expression');
  fields.push(text.slice(start)); return fields.map(value => value.trim());
}
function projection(table, fields, alias = 't', level = 0) {
  return splitFields(fields).map(field => {
    if (field === '*') return alias + '.*';
    const relation = /^([a-z_][a-z0-9_]*):([a-z_][a-z0-9_]*)\((.+)\)$/.exec(field);
    if (!relation) return alias + '.' + identifier(field);
    const [, label, child, columns] = relation;
    const config = relations[table + ':' + child];
    if (!config || level > 2) throw new Error('Unsupported relation');
    const childAlias = 'r' + level;
    const condition = config.many ? childAlias + '.' + identifier(config.key) + '=' + alias + '.id'
      : childAlias + '.id=' + alias + '.' + identifier(config.key);
    const nested = projection(child, columns, childAlias, level + 1);
    const query = 'SELECT ' + nested + ' FROM ' + tableName(child) + ' ' + childAlias + ' WHERE ' + condition;
    return (config.many
      ? "COALESCE((SELECT jsonb_agg(row_to_json(nested_row)) FROM (" + query + ") nested_row),'[]'::jsonb)"
      : '(SELECT row_to_json(nested_row) FROM (' + query + ') nested_row)') + ' AS ' + identifier(label);
  }).join(',');
}
function dbError(error) {
  return { code: typeof error.code === 'string' ? error.code : 'DATABASE_ERROR', message: error.message || 'Database error' };
}

class Query {
  constructor(run, table) {
    tableName(table); this.run = run; this.table = table; this.operation = 'select'; this.fields = '*';
    this.filters = []; this.sort = []; this.values = []; this.returnRows = false; this.offset = 0; this.maximum = null; this.cardinality = 'many'; this.countExact = false;
  }
  select(fields = '*', options = {}) { this.fields = fields; this.returnRows = true; this.countExact = options.count === 'exact'; return this; }
  insert(rows) { this.operation = 'insert'; this.rows = rows; return this; }
  update(row) { this.operation = 'update'; this.rows = [row]; return this; }
  delete() { this.operation = 'delete'; return this; }
  eq(key, value) { this.filters.push({ key, op: '=', value }); return this; }
  is(key, value) { if (value !== null && typeof value !== 'boolean') throw new Error('Invalid IS filter'); this.filters.push({ key, op: 'is', value }); return this; }
  in(key, value) { if (!Array.isArray(value)) throw new Error('Invalid IN filter'); this.filters.push({ key, op: 'in', value }); return this; }
  or(expression) {
    const filters = splitFields(expression).map(part => {
      const match = /^([a-z_][a-z0-9_]*)\.(eq|is|in)\.(.+)$/.exec(part);
      if (!match) throw new Error('Invalid OR filter');
      const [, key, op, raw] = match;
      if (op === 'is' && raw !== 'null') throw new Error('Unsupported OR filter');
      if (op === 'in' && !/^\([^()]*\)$/.test(raw)) throw new Error('Invalid IN filter');
      return { key, op: op === 'eq' ? '=' : op, value: op === 'is' ? null : op === 'in' ? raw.slice(1,-1).split(',') : raw };
    });
    this.filters.push({ alternatives: filters }); return this;
  }
  order(key, options = {}) { this.sort.push(identifier(key) + (options.ascending === false ? ' DESC' : ' ASC')); return this; }
  limit(value) { if (!Number.isInteger(value) || value < 0 || value > 10000) throw new Error('Invalid limit'); this.maximum = value; return this; }
  range(start, end) { if (!Number.isInteger(start) || start < 0 || !Number.isInteger(end) || end < start) throw new Error('Invalid range'); this.offset = start; return this.limit(end - start + 1); }
  single() { this.cardinality = 'one'; return this; }
  maybeSingle() { this.cardinality = 'optional'; return this; }
  compile() {
    const params = []; const bind = value => { params.push(value); return '$' + params.length; };
    const filter = entry => {
      if (entry.alternatives) return '(' + entry.alternatives.map(filter).join(' OR ') + ')';
      const key = 't.' + identifier(entry.key);
      if (entry.op === 'is') return key + ' IS ' + (entry.value === null ? 'NULL' : entry.value ? 'TRUE' : 'FALSE');
      if (entry.op === 'in') return entry.value.length ? key + ' IN (' + entry.value.map(bind).join(',') + ')' : 'FALSE';
      return key + '=' + bind(entry.value);
    };
    const where = this.filters.length ? ' WHERE ' + this.filters.map(filter).join(' AND ') : '';
    const target = tableName(this.table) + ' AS t';
    const encoded = (key, value) => key === 'tags' || key === 'theme' ? JSON.stringify(value) : value;
    let sql;
    if (this.operation === 'select') {
      sql = 'SELECT ' + projection(this.table, this.fields) + (this.countExact ? ',count(*) OVER() AS "__menupro_count"' : '') + ' FROM ' + target + where;
      if (this.sort.length) sql += ' ORDER BY ' + this.sort.map(value => 't.' + value).join(',');
      if (this.maximum !== null) sql += ' LIMIT ' + bind(this.maximum);
      if (this.offset) sql += ' OFFSET ' + bind(this.offset);
    } else {
      if (this.operation === 'insert') {
        if (!Array.isArray(this.rows) || !this.rows.length) throw new Error('Insert requires rows');
        const keys = [...new Set(this.rows.flatMap(row => Object.keys(row).filter(key => row[key] !== undefined)))];
        sql = 'INSERT INTO ' + target + '(' + keys.map(identifier).join(',') + ') VALUES ' + this.rows.map(row => '(' + keys.map(key => row[key] === undefined ? 'DEFAULT' : bind(encoded(key,row[key]))).join(',') + ')').join(',');
      } else if (this.operation === 'update') {
        const keys = Object.keys(this.rows[0]).filter(key => this.rows[0][key] !== undefined);
        if (!keys.length) throw new Error('Empty update');
        sql = 'UPDATE ' + target + ' SET ' + keys.map(key => identifier(key) + '=' + bind(encoded(key,this.rows[0][key]))).join(',') + where;
      } else sql = 'DELETE FROM ' + target + where;
      if (this.returnRows) sql += ' RETURNING ' + projection(this.table,this.fields);
    }
    return { text: sql, values: params };
  }
  /** @returns {Promise<{data:any,error:{code:string,message:string}|null,count:number|null}>} */
  async execute() {
    try {
      const result = await this.run(this.compile());
      const count = this.countExact ? Number(result.rows[0]?.__menupro_count ?? 0) : null;
      for (const row of result.rows) delete row.__menupro_count;
      if (this.cardinality !== 'many' && (result.rows.length > 1 || (this.cardinality === 'one' && result.rows.length !== 1))) {
        return { data: null, error: { code: 'PGRST116', message: 'Expected a single row' }, count };
      }
      return { data: this.cardinality === 'many' ? result.rows : result.rows[0] ?? null, error: null, count };
    } catch (error) { return { data: null, error: dbError(error), count: null }; }
  }
  /**
   * @template [TResult1={data:any,error:{code:string,message:string}|null,count:number|null}]
   * @template [TResult2=never]
   * @param {((value:{data:any,error:{code:string,message:string}|null,count:number|null}) => TResult1 | PromiseLike<TResult1>) | null} [resolve]
   * @param {((reason:any) => TResult2 | PromiseLike<TResult2>) | null} [reject]
   * @returns {Promise<TResult1|TResult2>}
   */
  then(resolve, reject) { return this.execute().then(resolve,reject); }
}

export function createDatabase(run) {
  return {
    from: table => new Query(run,table),
    /** @returns {Promise<{data:any,error:{code:string,message:string}|null}>} */
    async rpc(name, args = {}) {
      try {
        const keys = Object.keys(args).filter(key => args[key] !== undefined);
        const text = 'SELECT ' + tableName(name) + '(' + keys.map((key,index) => identifier(key) + ' => $' + (index+1)).join(',') + ') AS data';
        const result = await run({ text, values: keys.map(key => args[key]) });
        return { data: result.rows[0]?.data ?? null, error: null };
      } catch (error) { return { data: null, error: dbError(error) }; }
    },
  };
}
