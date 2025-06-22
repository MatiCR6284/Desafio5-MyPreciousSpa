import express from 'express';
import { Pool } from 'pg';
import 'dotenv/config';
import cors from 'cors';
import fs from 'fs';

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());

const pool = new Pool({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});

app.use((req, res, next) => {
  const log = `${new Date().toISOString()} - [${req.method}] ${req.url}\n`;
  console.log(log);
  fs.appendFile('access.log', log, (err) => {
    if (err) console.error('Error al guardar el log:', err);
  });
  next();
});

app.get('/joyas/', async (req, res) => {
  try {
    let { limits = 10, page = 1, order_by = 'id_ASC' } = req.query;
    limits = Number(limits) || 10;
    page = Number(page) || 1;

    // Validar campo y dirección
    const camposValidos = ['id', 'nombre', 'precio', 'stock'];
    const direccionesValidas = ['ASC', 'DESC'];
    let [campo, direccion] = order_by.split('_');
    if (!camposValidos.includes(campo)) campo = 'id';
    if (!direccionesValidas.includes(direccion)) direccion = 'ASC';

    const offset = (page - 1) * limits;

    const query = `SELECT * FROM inventario ORDER BY ${campo} ${direccion} LIMIT $1 OFFSET $2`;
    const { rows } = await pool.query(query, [limits, offset]);

    const HATEOAS = rows.map((j) => ({
      name: j.nombre,
      href: `http://localhost:${PORT}/joyas/${j.id}`,
    }));

    res.json({ total: rows.length, results: HATEOAS });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/joyas/filtros', async (req, res) => {
  try {
    const { precio_max, precio_min, categoria, metal } = req.query;

    let filtros = [];
    let values = [];
    let i = 1;

    if (precio_max) {
      filtros.push(`precio <= $${i++}`);
      values.push(precio_max);
    }

    if (precio_min) {
      filtros.push(`precio >= $${i++}`);
      values.push(precio_min);
    }

    if (categoria) {
      filtros.push(`categoria = $${i++}`);
      values.push(categoria);
    }

    if (metal) {
      filtros.push(`metal = $${i++}`);
      values.push(metal);
    }

    const query = `SELECT * FROM inventario${filtros.length ? ' WHERE ' + filtros.join(' AND ') : ''}`;
    const { rows } = await pool.query(query, values);

    res.json(rows);
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
