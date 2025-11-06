const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Base de datos SQLite
const db = new sqlite3.Database(':memory:');

// Inicializar base de datos con datos de ejemplo
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        userId TEXT PRIMARY KEY,
        country TEXT,
        totalClicks INTEGER DEFAULT 0,
        lastClick TEXT
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS countries (
        countryCode TEXT PRIMARY KEY,
        countryName TEXT,
        totalClicks INTEGER DEFAULT 0
    )`);

    // Insertar datos de ejemplo
    const exampleCountries = [
        { code: 'mx', name: 'México', clicks: 15234 },
        { code: 'es', name: 'España', clicks: 12876 },
        { code: 'ar', name: 'Argentina', clicks: 9876 },
        { code: 'co', name: 'Colombia', clicks: 8765 },
        { code: 'cl', name: 'Chile', clicks: 7654 },
        { code: 'us', name: 'Estados Unidos', clicks: 6543 },
        { code: 'br', name: 'Brasil', clicks: 5432 },
        { code: 'pe', name: 'Perú', clicks: 4321 },
        { code: 'fr', name: 'Francia', clicks: 3210 },
        { code: 'de', name: 'Alemania', clicks: 2109 }
    ];

    const stmt = db.prepare(`INSERT OR IGNORE INTO countries (countryCode, countryName, totalClicks) VALUES (?, ?, ?)`);
    exampleCountries.forEach(country => {
        stmt.run(country.code, country.name, country.clicks);
    });
    stmt.finalize();
});

// Rutas de la API
app.post('/api/click', (req, res) => {
    const { userId, countryCode, countryName } = req.body;
    
    console.log('Registrando click para:', userId, countryCode, countryName);

    // Actualizar usuario
    db.run(`INSERT OR REPLACE INTO users (userId, country, totalClicks, lastClick) 
            VALUES (?, ?, COALESCE((SELECT totalClicks FROM users WHERE userId = ?), 0) + 1, datetime('now'))`,
        [userId, countryName, userId], function(err) {
            if (err) {
                console.error('Error usuario:', err);
                return res.status(500).json({ error: err.message });
            }
            
            // Actualizar país
            db.run(`INSERT OR REPLACE INTO countries (countryCode, countryName, totalClicks) 
                    VALUES (?, ?, COALESCE((SELECT totalClicks FROM countries WHERE countryCode = ?), 0) + 1)`,
                [countryCode, countryName, countryCode], function(err) {
                    if (err) {
                        console.error('Error país:', err);
                        return res.status(500).json({ error: err.message });
                    }
                    
                    // Obtener datos actualizados
                    db.all(`SELECT countryCode, countryName, totalClicks 
                           FROM countries 
                           ORDER BY totalClicks DESC 
                           LIMIT 10`, (err, leaderboard) => {
                        if (err) {
                            console.error('Error leaderboard:', err);
                            return res.status(500).json({ error: err.message });
                        }
                        
                        db.get(`SELECT SUM(totalClicks) as total FROM countries`, (err, total) => {
                            if (err) {
                                console.error('Error total:', err);
                                return res.status(500).json({ error: err.message });
                            }
                            
                            db.get(`SELECT totalClicks FROM users WHERE userId = ?`, [userId], (err, user) => {
                                if (err) {
                                    console.error('Error user clicks:', err);
                                    return res.status(500).json({ error: err.message });
                                }

                                const response = {
                                    userClicks: user?.totalClicks || 0,
                                    totalClicks: total?.total || 0,
                                    leaderboard: leaderboard || []
                                };

                                console.log('Respuesta:', response);
                                res.json(response);
                            });
                        });
                    });
                });
        });
});

app.get('/api/leaderboard', (req, res) => {
    db.all(`SELECT countryCode, countryName, totalClicks 
           FROM countries 
           ORDER BY totalClicks DESC 
           LIMIT 10`, (err, leaderboard) => {
        if (err) {
            console.error('Error leaderboard:', err);
            return res.status(500).json({ error: err.message });
        }
        
        db.get(`SELECT SUM(totalClicks) as total FROM countries`, (err, total) => {
            if (err) {
                console.error('Error total:', err);
                return res.status(500).json({ error: err.message });
            }

            res.json({
                leaderboard: leaderboard || [],
                totalClicks: total?.total || 0
            });
        });
    });
});

app.get('/api/user/:userId', (req, res) => {
    db.get(`SELECT totalClicks FROM users WHERE userId = ?`, [req.params.userId], (err, user) => {
        if (err) {
            console.error('Error user:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json({ userClicks: user?.totalClicks || 0 });
    });
});

// Ruta principal - servir el frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 PopCat Click ejecutándose en puerto ${PORT}`);
    console.log(`📊 Base de datos inicializada con datos de ejemplo`);
});