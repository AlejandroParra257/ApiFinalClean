const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// ==================== CONFIGURACIÓN DE SWAGGER ====================
// Determinar la URL base para Swagger (Render asigna RENDER_EXTERNAL_URL)
const baseUrl = process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000';

const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'API Final - Gestión de Usuarios (5soptima)',
            version: '1.0.0',
            description: 'API para la tabla `usuarios` con UUID, roles y estado activo.',
        },
        servers: [
            {
                url: baseUrl,
                description: process.env.RENDER_EXTERNAL_URL ? 'Servidor en Render' : 'Servidor Local'
            }
        ],
        components: {
            schemas: {
                Usuario: {
                    type: 'object',
                    required: ['nombre', 'email', 'password'],
                    properties: {
                        id: { type: 'string', description: 'UUID generado automáticamente' },
                        nombre: { type: 'string' },
                        email: { type: 'string' },
                        password: { type: 'string' },
                        rol_id: { type: 'integer', default: 3 },
                        activo: { type: 'boolean', default: true },
                        fecha_registro: { type: 'string', format: 'date-time' },
                        ultimo_acceso: { type: 'string', format: 'date-time', nullable: true }
                    }
                }
            }
        }
    },
    apis: ['./index.js'],
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/doc', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// ==================== ENDPOINTS ====================

/**
 * @swagger
 * tags:
 *   name: Usuarios
 *   description: CRUD completo de usuarios (tabla real)
 */

/**
 * @swagger
 * /api/usuarios:
 *   get:
 *     summary: Obtener todos los usuarios
 *     tags: [Usuarios]
 *     responses:
 *       200:
 *         description: Lista de usuarios
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Usuario'
 */
app.get('/api/usuarios', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM usuarios');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/usuarios:
 *   post:
 *     summary: Crear un nuevo usuario (el id UUID se genera automáticamente)
 *     tags: [Usuarios]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nombre, email, password]
 *             properties:
 *               nombre: { type: string }
 *               email: { type: string }
 *               password: { type: string }
 *               rol_id: { type: integer, default: 3 }
 *     responses:
 *       201:
 *         description: Usuario creado exitosamente
 */
app.post('/api/usuarios', async (req, res) => {
    const { nombre, email, password, rol_id = 3 } = req.body;
    try {
        // Generamos un UUID automático con UUID() de MySQL y lo insertamos explícitamente
        await db.query(
            `INSERT INTO usuarios (id, nombre, email, password, rol_id, activo, fecha_registro)
             VALUES (UUID(), ?, ?, ?, ?, 1, NOW())`,
            [nombre, email, password, rol_id]
        );
        // Recuperamos el usuario recién creado usando su email (único)
        const [nuevo] = await db.query('SELECT * FROM usuarios WHERE email = ?', [email]);
        res.status(201).json(nuevo[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/usuarios/{id}:
 *   put:
 *     summary: Actualizar un usuario por su UUID
 *     tags: [Usuarios]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre: { type: string }
 *               email: { type: string }
 *               password: { type: string }
 *               rol_id: { type: integer }
 *               activo: { type: boolean }
 *     responses:
 *       200:
 *         description: Usuario actualizado
 */
app.put('/api/usuarios/:id', async (req, res) => {
    const { id } = req.params;
    const { nombre, email, password, rol_id, activo } = req.body;
    try {
        const campos = [];
        const valores = [];
        if (nombre !== undefined) { campos.push('nombre = ?'); valores.push(nombre); }
        if (email !== undefined) { campos.push('email = ?'); valores.push(email); }
        if (password !== undefined) { campos.push('password = ?'); valores.push(password); }
        if (rol_id !== undefined) { campos.push('rol_id = ?'); valores.push(rol_id); }
        if (activo !== undefined) { campos.push('activo = ?'); valores.push(activo); }
        if (campos.length === 0) {
            return res.status(400).json({ error: 'No hay campos para actualizar' });
        }
        valores.push(id);
        await db.query(`UPDATE usuarios SET ${campos.join(', ')} WHERE id = ?`, valores);
        res.json({ message: 'Usuario actualizado exitosamente' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/usuarios/{id}:
 *   delete:
 *     summary: Eliminar un usuario por su UUID
 *     tags: [Usuarios]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Usuario eliminado
 */
app.delete('/api/usuarios/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM usuarios WHERE id = ?', [id]);
        res.json({ message: 'Usuario eliminado exitosamente' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== INICIAR SERVIDOR ====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    console.log(`📝 Documentación Swagger: http://localhost:${PORT}/doc`);
});